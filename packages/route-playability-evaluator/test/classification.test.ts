import {
  hashControllerProfile,
  hashEvidenceContent,
  type EvidenceRecordContract,
} from "@obby/obby-evaluator-contracts";
import { describe, expect, it } from "vitest";

import {
  classifyCoarseTransition,
  classifyCoarseTransitionWithEvidence,
  CoarseTransitionValidationError,
  createDefaultControllerProfile,
  evaluateRoutePlayability,
  unavailableLandingRegion,
  type CoarseTransitionInput,
} from "../src/index.js";
import {
  manifestFixture,
  rehashManifest,
  requiredFixture,
} from "./fixtures.js";

function evaluationAt(x: number, y: number, z: number) {
  const manifest = manifestFixture();
  const first = requiredFixture(
    manifest.layers.gameplay.objects.find(
      (object) => object.id === "JumpPlatform01",
    ),
    "first platform",
  );
  first.transform.position = { x, y, z };
  manifest.worldBounds.minimum = { x: -100, y: -100, z: -100 };
  manifest.worldBounds.maximum = { x: 100, y: 100, z: 100 };
  rehashManifest(manifest);
  return evaluateRoutePlayability({
    manifest,
    controllerProfile: createDefaultControllerProfile(),
  });
}

function firstClassificationAt(x: number, y: number, z: number) {
  return requiredFixture(
    evaluationAt(x, y, z).transitionStates[0],
    "first transition state",
  );
}

function baseTransition(): CoarseTransitionInput {
  const transition = structuredClone(
    requiredFixture(
      evaluationAt(0, 4, 16).transitions[0],
      "first normalized transition",
    ),
  );
  for (const field of [
    "horizontalSeparation",
    "verticalRise",
    "downwardDrop",
  ] as const) {
    const measurement = transition[field];
    if (measurement.status === "available") measurement.evidenceHashes = [];
    else measurement.missingEvidenceHashes = [];
  }
  return transition;
}

function evidenceBackedTransition(
  evaluated: ReturnType<typeof evaluationAt>,
): CoarseTransitionInput {
  return structuredClone(
    requiredFixture(
      evaluated.transitions[0],
      "first evidence-backed transition",
    ),
  );
}

function selectedTransitionEvidence(
  evaluated: ReturnType<typeof evaluationAt>,
): Extract<EvidenceRecordContract, { kind: "route-transition" }> {
  const selected = requiredFixture(
    evaluated.evidence.find(
      (record) =>
        record.kind === "route-transition" &&
        record.payload.transitionId === evaluated.transitions[0]?.transitionId,
    ),
    "first normalized transition",
  );
  if (selected.kind !== "route-transition") {
    throw new Error("fixture route-transition evidence is missing");
  }
  return selected;
}

function classificationEvidence(
  evaluated: ReturnType<typeof evaluationAt>,
): EvidenceRecordContract[] {
  return evaluated.evidence.filter((record) =>
    ["geometry-fact", "route-graph", "route-transition"].includes(record.kind),
  );
}

function expectedManifestHash(
  evaluated: ReturnType<typeof evaluationAt>,
): `sha256:${string}` {
  return requiredFixture(evaluated.evidence[0], "evaluation evidence")
    .manifestHash as `sha256:${string}`;
}

function evidenceBindingFixture() {
  const evaluated = evaluationAt(0, 4, 16);
  const evidenceRecords = classificationEvidence(evaluated);
  const transition = evidenceBackedTransition(evaluated);
  const transitionRecord = selectedTransitionEvidence(evaluated);
  const geometryRecord = requiredFixture(
    evidenceRecords.find((record) => record.kind === "geometry-fact"),
    "geometry evidence",
  );
  const routeRecord = requiredFixture(
    evidenceRecords.find((record) => record.kind === "route-graph"),
    "route evidence",
  );
  return {
    evaluated,
    evidenceRecords,
    transition,
    transitionRecord,
    geometryRecord,
    routeRecord,
    manifestHash: expectedManifestHash(evaluated),
  };
}

function rehashEvidence(
  record: EvidenceRecordContract,
): EvidenceRecordContract {
  const clone = structuredClone(record);
  clone.evidenceContentHash = hashEvidenceContent(clone).hash;
  return clone;
}

function issuesFrom(action: () => unknown) {
  try {
    action();
    throw new Error("expected coarse-transition rejection");
  } catch (caught) {
    expect(caught).toBeInstanceOf(CoarseTransitionValidationError);
    return (caught as CoarseTransitionValidationError).issues;
  }
}

function unavailable(
  reasonCode:
    | "missing-horizontal-separation"
    | "missing-vertical-rise"
    | "missing-downward-drop",
) {
  return {
    status: "unavailable" as const,
    reasonCode,
    missingEvidenceHashes: [],
    limitations: [`${reasonCode} fixture evidence is unavailable.`],
  };
}

describe("coarse model-relative transition classification", () => {
  it.each([
    [16, 4, 0],
    [-16, 4, 0],
    [0, 4, 16],
    [0, 4, -16],
    [11.071067811865, 4, 11.071067811865],
  ])("classifies a supported direction (%s, %s, %s)", (x, y, z) => {
    expect(firstClassificationAt(x, y, z).state).toBe("feasible-under-model");
  });

  it.each([
    ["horizontalSeparation", "maximumHorizontalGap"],
    ["verticalRise", "maximumRise"],
    ["downwardDrop", "maximumDownwardDrop"],
  ] as const)(
    "applies inclusive exact, inside-tolerance, and outside-tolerance boundaries for %s",
    (field, profileField) => {
      const profile = createDefaultControllerProfile();
      const base = baseTransition();
      const maximum = profile[profileField].value;
      const tolerance = profile.tolerancePolicy.comparisonToleranceStuds;
      const classify = (value: number) =>
        classifyCoarseTransition(
          { ...base, [field]: { ...base[field], value } },
          profile,
        );
      expect(classify(maximum).state).toBe("feasible-under-model");
      expect(classify(maximum + tolerance / 2).state).toBe(
        "feasible-under-model",
      );
      expect(classify(maximum + tolerance * 2).state).toBe(
        "infeasible-under-model",
      );
    },
  );

  it.each([
    ["horizontalSeparation", 7, "horizontal-gap-exceeds-profile"],
    ["verticalRise", 6, "vertical-rise-exceeds-profile"],
    ["downwardDrop", 21, "downward-drop-exceeds-profile"],
  ] as const)(
    "classifies excessive %s relative to the profile",
    (field, value, reason) => {
      const profile = createDefaultControllerProfile();
      const base = baseTransition();
      const result = classifyCoarseTransition(
        { ...base, [field]: { ...base[field], value } },
        profile,
      );
      expect(result.state).toBe("infeasible-under-model");
      expect(result.reasonCodes).toContain(reason);
      expect(result.limitations.join(" ")).toContain("model");
      expect(result.limitations.join(" ")).not.toContain("impossible");
    },
  );

  it.each([
    ["horizontalSeparation", "missing-horizontal-separation"],
    ["verticalRise", "missing-vertical-rise"],
    ["downwardDrop", "missing-downward-drop"],
  ] as const)(
    "returns deterministic indeterminate evidence when %s is explicitly unavailable",
    (field, reason) => {
      const base = baseTransition();
      const first = classifyCoarseTransition(
        { ...base, [field]: unavailable(reason) },
        createDefaultControllerProfile(),
      );
      const second = classifyCoarseTransition(
        { ...base, [field]: unavailable(reason) },
        createDefaultControllerProfile(),
      );
      expect(first.state).toBe("indeterminate");
      expect(first.reasonCodes).toContain(reason);
      expect(first.reproduction).toEqual(second.reproduction);
      expect(first.limitations).toEqual(second.limitations);
    },
  );

  it.each([
    ["missing status", { value: 1 }, "status", "/horizontalSeparation/status"],
    [
      "unknown status",
      { status: "future" },
      "status",
      "/horizontalSeparation/status",
    ],
    [
      "unavailable without reason",
      { status: "unavailable", missingEvidenceHashes: [], limitations: [] },
      "reason-code",
      "/horizontalSeparation/reasonCode",
    ],
    [
      "unavailable without limitations",
      {
        status: "unavailable",
        reasonCode: "missing-horizontal-separation",
        missingEvidenceHashes: [],
      },
      "limitations",
      "/horizontalSeparation/limitations",
    ],
    [
      "available without value",
      {
        status: "available",
        method: "world-aabb-horizontal-separation",
        approximationKind: "conservative-lower-bound",
        toleranceStuds: 1e-9,
        evidenceHashes: [],
        limitations: [],
        applicability: "broad-phase-only",
      },
      "measurement-value",
      "/horizontalSeparation/value",
    ],
    [
      "available without evidence hashes",
      (() => {
        const candidate = baseTransition().horizontalSeparation;
        if (candidate.status !== "available") {
          throw new Error("fixture available measurement is missing");
        }
        const measurement = { ...candidate } as Record<string, unknown>;
        delete measurement.evidenceHashes;
        return measurement;
      })(),
      "content-hashes",
      "/horizontalSeparation/evidenceHashes",
    ],
    [
      "malformed available evidence hash",
      {
        ...baseTransition().horizontalSeparation,
        evidenceHashes: ["sha256:not-a-hash"],
      },
      "content-hashes",
      "/horizontalSeparation/evidenceHashes",
    ],
    [
      "mixed available evidence fields",
      {
        ...baseTransition().horizontalSeparation,
        missingEvidenceHashes: [],
      },
      "additional-property",
      "/horizontalSeparation/missingEvidenceHashes",
    ],
    [
      "mixed unavailable fields",
      {
        ...unavailable("missing-horizontal-separation"),
        value: 1,
      },
      "additional-property",
      "/horizontalSeparation/value",
    ],
    [
      "malformed unavailable evidence hash",
      {
        ...unavailable("missing-horizontal-separation"),
        missingEvidenceHashes: ["sha256:not-a-hash"],
      },
      "content-hashes",
      "/horizontalSeparation/missingEvidenceHashes",
    ],
    [
      "extra available field",
      {
        ...baseTransition().horizontalSeparation,
        unexpected: true,
      },
      "additional-property",
      "/horizontalSeparation/unexpected",
    ],
  ])(
    "rejects malformed measurement input: %s",
    (_name, measurement, code, path) => {
      try {
        classifyCoarseTransition(
          {
            ...baseTransition(),
            horizontalSeparation: measurement,
          } as unknown as CoarseTransitionInput,
          createDefaultControllerProfile(),
        );
        throw new Error("expected malformed measurement rejection");
      } catch (caught) {
        expect(caught).toBeInstanceOf(CoarseTransitionValidationError);
        expect((caught as CoarseTransitionValidationError).issues).toEqual([
          expect.objectContaining({ code, path }),
        ]);
      }
    },
  );

  it("accepts the documented empty evidence list for standalone available measurements", () => {
    const base = baseTransition();
    if (base.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    const result = classifyCoarseTransition(
      {
        ...base,
        horizontalSeparation: {
          ...base.horizontalSeparation,
          evidenceHashes: [],
        },
      },
      createDefaultControllerProfile(),
    );
    expect(result.inputEvidenceHashes).toEqual([]);
    expect(
      result.reproduction.normalizedInputs.horizontalSeparation,
    ).toMatchObject({ status: "available", evidenceHashes: [] });
  });

  it("rejects a standalone available measurement with an emitted evidence hash", () => {
    const transition = baseTransition();
    if (transition.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    transition.horizontalSeparation.evidenceHashes = [
      requiredFixture(
        evaluationAt(0, 4, 16).evidence[0],
        "standalone evidence fixture",
      ).evidenceContentHash as `sha256:${string}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransition(transition, createDefaultControllerProfile()),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "standalone-evidence-not-allowed",
        path: "/horizontalSeparation/evidenceHashes",
      }),
    ]);
  });

  it("rejects a standalone available measurement with a nonexistent evidence hash", () => {
    const transition = baseTransition();
    if (transition.verticalRise.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    transition.verticalRise.evidenceHashes = [`sha256:${"f".repeat(64)}`];
    expect(
      issuesFrom(() =>
        classifyCoarseTransition(transition, createDefaultControllerProfile()),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "standalone-evidence-not-allowed",
        path: "/verticalRise/evidenceHashes",
      }),
    ]);
  });

  it("rejects a standalone unavailable measurement with missing-evidence hashes", () => {
    const transition = baseTransition();
    transition.downwardDrop = {
      ...unavailable("missing-downward-drop"),
      missingEvidenceHashes: [`sha256:${"a".repeat(64)}`],
    };
    expect(
      issuesFrom(() =>
        classifyCoarseTransition(transition, createDefaultControllerProfile()),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "standalone-evidence-not-allowed",
        path: "/downwardDrop/missingEvidenceHashes",
      }),
    ]);
  });

  it("keeps every standalone measurement evidence list empty in normalized output", () => {
    const result = classifyCoarseTransition(
      {
        ...baseTransition(),
        downwardDrop: unavailable("missing-downward-drop"),
      },
      createDefaultControllerProfile(),
    );
    expect(result.inputEvidenceHashes).toEqual([]);
    for (const measurement of [
      result.reproduction.normalizedInputs.horizontalSeparation,
      result.reproduction.normalizedInputs.verticalRise,
      result.reproduction.normalizedInputs.downwardDrop,
    ]) {
      expect(
        measurement.status === "available"
          ? measurement.evidenceHashes
          : measurement.missingEvidenceHashes,
      ).toEqual([]);
    }
  });

  it("validates and canonically normalizes unavailableLandingRegion hashes without mutating callers", () => {
    const high = `sha256:${"f".repeat(64)}` as const;
    const low = `sha256:${"0".repeat(63)}1` as const;
    const caller = [high, low, high];
    const snapshot = [...caller];
    expect(unavailableLandingRegion(["fixture"], caller)).toMatchObject({
      missingEvidenceHashes: [low, high],
    });
    expect(caller).toEqual(snapshot);
    expect(
      issuesFrom(() =>
        unavailableLandingRegion(
          ["fixture"],
          ["not-a-content-hash" as `sha256:${string}`],
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "content-hashes",
        path: "/missingEvidenceHashes",
      }),
    ]);
  });

  it("binds full-evaluation measurements to emitted geometry and route evidence", () => {
    const evaluated = evaluationAt(0, 4, 16);
    const emitted = new Map(
      evaluated.evidence.map((record) => [
        record.evidenceContentHash,
        record.kind,
      ]),
    );
    for (const transition of evaluated.transitions) {
      for (const measurement of [
        transition.horizontalSeparation,
        transition.verticalRise,
        transition.downwardDrop,
      ]) {
        expect(measurement.status).toBe("available");
        if (measurement.status !== "available") continue;
        expect(measurement.evidenceHashes).toEqual(
          [...new Set(measurement.evidenceHashes)].toSorted(),
        );
        expect(
          measurement.evidenceHashes
            .map((hash) => emitted.get(hash))
            .toSorted(),
        ).toEqual(["geometry-fact", "route-graph"]);
      }
    }
  });

  it("returns indeterminate for an unsupported measurement method", () => {
    const base = baseTransition();
    const result = classifyCoarseTransition(
      {
        ...base,
        horizontalSeparation: {
          ...base.horizontalSeparation,
          method: "future-unsupported-method",
        } as never,
      },
      createDefaultControllerProfile(),
    );
    expect(result.state).toBe("indeterminate");
    expect(result.reasonCodes).toContain("unsupported-surface-measurement");
  });

  it("returns indeterminate when landing-region evidence is unavailable", () => {
    const result = classifyCoarseTransition(
      {
        ...baseTransition(),
        landingRegion: {
          status: "unavailable",
          reasonCode: "insufficient-landing-evidence",
          missingEvidenceHashes: [],
          limitations: ["Destination landing region evidence is unavailable."],
        },
      },
      createDefaultControllerProfile(),
    );
    expect(result.state).toBe("indeterminate");
    expect(result.reasonCodes).toContain("insufficient-landing-evidence");
  });

  it("makes landing margin content-addressed and behaviorally meaningful", () => {
    const base = baseTransition();
    const defaultProfile = createDefaultControllerProfile();
    const largeMarginProfile = structuredClone(defaultProfile);
    largeMarginProfile.requiredLandingMargin.value = 100;
    largeMarginProfile.controllerProfileHash =
      hashControllerProfile(largeMarginProfile).hash;
    const defaultResult = classifyCoarseTransition(base, defaultProfile);
    const largeResult = classifyCoarseTransition(base, largeMarginProfile);
    expect(defaultProfile.controllerProfileHash).not.toBe(
      largeMarginProfile.controllerProfileHash,
    );
    expect(defaultResult.state).toBe("feasible-under-model");
    expect(largeResult.state).toBe("infeasible-under-model");
    expect(largeResult.reasonCodes).toContain("landing-region-too-small");
  });

  it("applies exact, inside-tolerance, and outside-tolerance landing-span boundaries", () => {
    const profile = createDefaultControllerProfile();
    const base = baseTransition();
    const tolerance = profile.tolerancePolicy.comparisonToleranceStuds;
    const landing = (spanAStuds: number) => ({
      status: "available" as const,
      method: "exact-planar-intrinsic-edge-spans-v1" as const,
      approximationKind: "exact-native-primitive" as const,
      spanAStuds,
      spanBStuds: 6,
      toleranceStuds: tolerance,
      limitations: ["Exact fixture landing region."],
    });
    expect(
      classifyCoarseTransition({ ...base, landingRegion: landing(4) }, profile)
        .state,
    ).toBe("feasible-under-model");
    expect(
      classifyCoarseTransition(
        { ...base, landingRegion: landing(4 - tolerance / 2) },
        profile,
      ).state,
    ).toBe("feasible-under-model");
    expect(
      classifyCoarseTransition(
        { ...base, landingRegion: landing(4 - tolerance * 2) },
        profile,
      ).state,
    ).toBe("infeasible-under-model");
  });

  it("returns indeterminate for unsupported curved-to-curved surfaces and landing", () => {
    const base = baseTransition();
    const curved = {
      kind: "spherical-surface" as const,
      shape: "Ball" as const,
      center: { x: 0, y: 0, z: 0 },
      radius: 2,
      topPoint: { x: 0, y: 2, z: 0 },
      maximumY: 2,
      approximationKind: "exact-native-primitive" as const,
    };
    const result = classifyCoarseTransition(
      { ...base, sourceSurface: curved, destinationSurface: curved },
      createDefaultControllerProfile(),
    );
    expect(result.state).toBe("indeterminate");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "unsupported-surface-measurement",
        "insufficient-landing-evidence",
      ]),
    );
  });

  it("exposes one complete public classification identity and reproduction contract", () => {
    const evaluation = evaluationAt(0, 4, 16);
    const result = requiredFixture(
      evaluation.transitionStates[0],
      "first transition state",
    );
    const emittedHashes = new Set(
      evaluation.evidence.map((record) => record.evidenceContentHash),
    );
    expect(result.transitionId.length).toBeGreaterThan(0);
    expect(result.sourceObjectId).toBe("Spawn");
    expect(result.destinationObjectId).toBe("JumpPlatform01");
    expect(result.controllerProfileId).toBe("e1-r15-provisional");
    expect(result.controllerProfileVersion).toBe("1.0.0");
    expect(result.controllerProfileHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.confidenceSemantics).toBe(
      "deterministic-rule-result-not-probability",
    );
    expect(result.reproduction.methodId).toBe("coarse-transition-classifier");
    expect(result.reproduction.methodVersion).toBe("2.0.0");
    expect(result.inputEvidenceHashes).toHaveLength(1);
    expect(result.inputEvidenceHashes).not.toContain(
      result.controllerProfileHash,
    );
    expect(result.inputEvidenceHashes).not.toContain(
      result.reproduction.normalizedInputHash,
    );
    expect(
      result.inputEvidenceHashes.every((hash) => emittedHashes.has(hash)),
    ).toBe(true);
    expect(result.reproduction.inputEvidenceHashes).toEqual(
      result.inputEvidenceHashes,
    );
  });

  it("keeps standalone classification evidence-free with a dedicated normalized input identity", () => {
    const result = classifyCoarseTransition(
      baseTransition(),
      createDefaultControllerProfile(),
    );
    expect(result.inputEvidenceHashes).toEqual([]);
    expect(result.reproduction.inputEvidenceHashes).toEqual([]);
    expect(result.reproduction.normalizedInputHash).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
  });

  it("rejects nonexistent measurement evidence in an otherwise valid complete graph", () => {
    const fixture = evidenceBindingFixture();
    if (fixture.transition.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    fixture.transition.horizontalSeparation.evidenceHashes = [
      `sha256:${"f".repeat(64)}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: fixture.evidenceRecords,
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "measurement-evidence-not-found",
        path: "/horizontalSeparation/evidenceHashes/0",
      }),
    ]);
  });

  it("rejects unrelated same-manifest geometry as measurement evidence", () => {
    const fixture = evidenceBindingFixture();
    const unrelated = rehashEvidence({
      ...fixture.geometryRecord,
      evidenceId: "e1b:geometry:unrelated-measurement",
      limitations: [
        ...fixture.geometryRecord.limitations,
        "Unrelated measurement fixture.",
      ],
    });
    if (fixture.transition.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    fixture.transition.horizontalSeparation.evidenceHashes = [
      unrelated.evidenceContentHash as `sha256:${string}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [...fixture.evidenceRecords, unrelated],
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "measurement-evidence-unrelated",
        path: "/horizontalSeparation/evidenceHashes/0",
      }),
    ]);
  });

  it("rejects wrong-manifest measurement evidence", () => {
    const fixture = evidenceBindingFixture();
    const wrongManifest = rehashEvidence({
      ...fixture.geometryRecord,
      evidenceId: "e1b:geometry:wrong-manifest",
      manifestHash: `sha256:${"a".repeat(64)}`,
    });
    if (fixture.transition.verticalRise.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    fixture.transition.verticalRise.evidenceHashes = [
      wrongManifest.evidenceContentHash as `sha256:${string}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [...fixture.evidenceRecords, wrongManifest],
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "measurement-evidence-wrong-manifest",
        path: "/verticalRise/evidenceHashes/0",
      }),
    ]);
  });

  it("rejects wrong-subject measurement evidence", () => {
    const fixture = evidenceBindingFixture();
    const wrongSubject = rehashEvidence({
      ...fixture.geometryRecord,
      evidenceId: "e1b:geometry:wrong-subject",
      subject: { kind: "object", objectId: "FinishPlatform" },
    });
    if (fixture.transition.downwardDrop.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    fixture.transition.downwardDrop.evidenceHashes = [
      wrongSubject.evidenceContentHash as `sha256:${string}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [...fixture.evidenceRecords, wrongSubject],
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "measurement-evidence-wrong-subject",
        path: "/downwardDrop/evidenceHashes/0",
      }),
    ]);
  });

  it("rejects a non-source evidence kind used as measurement evidence", () => {
    const fixture = evidenceBindingFixture();
    const wrongKind = requiredFixture(
      fixture.evaluated.evidence.find(
        (record) => record.kind === "coarse-transition-state",
      ),
      "coarse transition evidence",
    );
    if (fixture.transition.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    fixture.transition.horizontalSeparation.evidenceHashes = [
      wrongKind.evidenceContentHash as `sha256:${string}`,
    ];
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: fixture.evaluated.evidence,
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "measurement-evidence-kind-not-allowed",
        path: "/horizontalSeparation/evidenceHashes/0",
      }),
    ]);
  });

  it("accepts only declared direct-parent measurement evidence and normalizes it without mutation", () => {
    const fixture = evidenceBindingFixture();
    if (fixture.transition.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    const legitimate = [
      fixture.routeRecord.evidenceContentHash,
      fixture.geometryRecord.evidenceContentHash,
      fixture.routeRecord.evidenceContentHash,
    ] as `sha256:${string}`[];
    fixture.transition.horizontalSeparation.evidenceHashes = legitimate;
    const snapshot = [...legitimate];
    const result = classifyCoarseTransitionWithEvidence(
      fixture.transition,
      createDefaultControllerProfile(),
      {
        evidenceRecords: fixture.evidenceRecords,
        expectedManifestHash: fixture.manifestHash,
      },
    );
    expect(legitimate).toEqual(snapshot);
    expect(
      result.reproduction.normalizedInputs.horizontalSeparation,
    ).toMatchObject({
      status: "available",
      evidenceHashes: [...new Set(legitimate)].toSorted(),
    });
    expect(fixture.transitionRecord.payload).toHaveProperty(
      "measurementSourceEvidenceHashes",
      [...new Set(legitimate)].toSorted(),
    );
  });

  it("content-addresses the declared measurement-source set independent of caller order", () => {
    const fixture = evidenceBindingFixture();
    const reversed = structuredClone(fixture.transitionRecord);
    reversed.payload.measurementSourceEvidenceHashes = [
      ...reversed.payload.measurementSourceEvidenceHashes,
    ].reverse() as [`sha256:${string}`, ...`sha256:${string}`[]];

    const baselineHash = hashEvidenceContent(fixture.transitionRecord);
    const reversedHash = hashEvidenceContent(reversed);
    expect(reversedHash.hash).toBe(baselineHash.hash);
    expect(reversedHash.canonicalBytes).toEqual(baselineHash.canonicalBytes);
  });

  it("rejects invalid parent subject scope before transition matching", () => {
    const fixture = evidenceBindingFixture();
    const wrongScopeGeometry = rehashEvidence({
      ...fixture.geometryRecord,
      evidenceId: "e1b:geometry:invalid-parent-scope",
      subject: { kind: "object", objectId: "FinishPlatform" },
    });
    const invalidTransition = rehashEvidence({
      ...fixture.transitionRecord,
      parentEvidenceHashes: fixture.transitionRecord.parentEvidenceHashes.map(
        (hash) =>
          hash === fixture.geometryRecord.evidenceContentHash
            ? wrongScopeGeometry.evidenceContentHash
            : hash,
      ),
    });
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [
              wrongScopeGeometry,
              fixture.routeRecord,
              invalidTransition,
            ],
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "input-evidence-graph",
        path: "/inputEvidenceRecords",
      }),
    ]);
  });

  it.each([
    [
      "source route index",
      (input: CoarseTransitionInput): void => {
        input.fromGlobalIndex += 1;
      },
    ],
    [
      "destination route index",
      (input: CoarseTransitionInput): void => {
        input.toGlobalIndex += 1;
      },
    ],
    [
      "source endpoint",
      (input: CoarseTransitionInput): void => {
        input.fromObjectId = "Checkpoint01";
      },
    ],
    [
      "destination endpoint",
      (input: CoarseTransitionInput): void => {
        input.toObjectId = "FinishPlatform";
      },
    ],
    [
      "transition ID",
      (input: CoarseTransitionInput): void => {
        input.transitionId += ".wrong";
      },
    ],
  ] as const)("rejects independently wrong %s", (_name, mutate) => {
    const fixture = evidenceBindingFixture();
    mutate(fixture.transition);
    expect(
      issuesFrom(() =>
        classifyCoarseTransitionWithEvidence(
          fixture.transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: fixture.evidenceRecords,
            expectedManifestHash: fixture.manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "transition-evidence-required",
        path: "/inputEvidenceRecords",
      }),
    ]);
  });

  it("keeps unrelated valid graph evidence byte-inert in the final classification", () => {
    const fixture = evidenceBindingFixture();
    const unrelated = rehashEvidence({
      ...fixture.geometryRecord,
      evidenceId: "e1b:geometry:byte-inert",
      limitations: [
        ...fixture.geometryRecord.limitations,
        "Byte-inert unrelated fixture.",
      ],
    });
    const baseline = classifyCoarseTransitionWithEvidence(
      fixture.transition,
      createDefaultControllerProfile(),
      {
        evidenceRecords: fixture.evidenceRecords,
        expectedManifestHash: fixture.manifestHash,
      },
    );
    const extended = classifyCoarseTransitionWithEvidence(
      fixture.transition,
      createDefaultControllerProfile(),
      {
        evidenceRecords: [unrelated, ...fixture.evidenceRecords].reverse(),
        expectedManifestHash: fixture.manifestHash,
      },
    );
    expect(JSON.stringify(extended)).toBe(JSON.stringify(baseline));
  });

  it("validates a complete graph, ignores unrelated geometry, and emits only the exact transition evidence hash", () => {
    const evaluated = evaluationAt(0, 4, 16);
    const transition = evidenceBackedTransition(evaluated);
    const evidenceRecords = classificationEvidence(evaluated);
    const manifestHash = expectedManifestHash(evaluated);
    const transitionRecord = requiredFixture(
      evaluated.evidence.find((record) => record.kind === "route-transition"),
      "route transition evidence",
    );
    const geometryRecord = requiredFixture(
      evidenceRecords.find((record) => record.kind === "geometry-fact"),
      "geometry evidence",
    );
    const unrelatedGeometryRecord = rehashEvidence({
      ...geometryRecord,
      evidenceId: "e1b:geometry:unrelated-fixture",
      limitations: [...geometryRecord.limitations, "Unrelated fixture."],
    });
    const completeGraphWithUnrelated = [
      ...evidenceRecords,
      unrelatedGeometryRecord,
    ];
    const first = classifyCoarseTransitionWithEvidence(
      transition,
      createDefaultControllerProfile(),
      {
        evidenceRecords: completeGraphWithUnrelated,
        expectedManifestHash: manifestHash,
      },
    );
    const shuffled = classifyCoarseTransitionWithEvidence(
      transition,
      createDefaultControllerProfile(),
      {
        evidenceRecords: [...completeGraphWithUnrelated].reverse(),
        expectedManifestHash: manifestHash,
      },
    );
    expect(first.inputEvidenceHashes).toEqual([
      transitionRecord.evidenceContentHash,
    ]);
    expect(first.inputEvidenceHashes).not.toContain(
      unrelatedGeometryRecord.evidenceContentHash,
    );
    expect(shuffled).toEqual(first);
    expect(first.inputEvidenceHashes).not.toContain(
      first.controllerProfileHash,
    );
    expect(first.inputEvidenceHashes).not.toContain(
      first.reproduction.normalizedInputHash,
    );
  });

  it("rejects missing, stale, wrong-subject, wrong-manifest, invalid, and ambiguous transition evidence", () => {
    const evaluated = evaluationAt(0, 4, 16);
    const transition = evidenceBackedTransition(evaluated);
    const evidenceRecords = classificationEvidence(evaluated);
    const manifestHash = expectedManifestHash(evaluated);
    const transitionRecords = evidenceRecords.filter(
      (record) => record.kind === "route-transition",
    );
    const transitionRecord = requiredFixture(
      transitionRecords[0],
      "route transition evidence",
    );
    const geometryAndRoute = evidenceRecords.filter(
      (record) =>
        record.kind === "geometry-fact" || record.kind === "route-graph",
    );
    const issueFrom = (action: () => unknown) => {
      try {
        action();
        throw new Error("expected evidence-reference rejection");
      } catch (caught) {
        expect(caught).toBeInstanceOf(CoarseTransitionValidationError);
        return (caught as CoarseTransitionValidationError).issues;
      }
    };
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          { evidenceRecords: [], expectedManifestHash: manifestHash },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "input-evidence-required",
        path: "/inputEvidenceRecords",
      }),
    ]);
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [
              ...geometryAndRoute,
              {
                ...transitionRecord,
                evidenceContentHash: `sha256:${"f".repeat(64)}`,
              },
            ],
            expectedManifestHash: manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "input-evidence-graph",
        path: "/inputEvidenceRecords",
      }),
    ]);
    const unrelatedTransitionRecord = requiredFixture(
      transitionRecords[1],
      "unrelated route transition evidence",
    );
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [...geometryAndRoute, unrelatedTransitionRecord],
            expectedManifestHash: manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "transition-evidence-required",
        path: "/inputEvidenceRecords",
      }),
    ]);
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [transitionRecord],
            expectedManifestHash: manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "input-evidence-graph",
        path: "/inputEvidenceRecords",
      }),
    ]);
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords,
            expectedManifestHash: `sha256:${"a".repeat(64)}`,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "transition-evidence-required",
        path: "/inputEvidenceRecords",
      }),
    ]);
    const wrongSubject = rehashEvidence({
      ...transitionRecord,
      evidenceId: "e1b:route-transition:wrong-subject",
      subject: unrelatedTransitionRecord.subject,
    });
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [...geometryAndRoute, wrongSubject],
            expectedManifestHash: manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "transition-evidence-required",
        path: "/inputEvidenceRecords",
      }),
    ]);
    const conflicting = rehashEvidence({
      ...transitionRecord,
      evidenceId: "e1b:route-transition:conflicting",
      limitations: [...transitionRecord.limitations, "Conflicting fixture."],
    });
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          transition,
          createDefaultControllerProfile(),
          {
            evidenceRecords: [
              ...geometryAndRoute,
              transitionRecord,
              conflicting,
            ],
            expectedManifestHash: manifestHash,
          },
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "ambiguous-transition-evidence",
        path: "/inputEvidenceRecords",
      }),
    ]);
  });

  it("preserves wedge broad-phase metadata in normalized reproduction inputs", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const wedgeIndex = result.transitions.findIndex(
      (transition) =>
        transition.sourceSurface.kind === "wedge-surfaces" ||
        transition.destinationSurface.kind === "wedge-surfaces",
    );
    const wedge = requiredFixture(
      result.transitionStates[wedgeIndex],
      "wedge classification",
    );
    expect(["feasible-under-model", "infeasible-under-model"]).toContain(
      wedge.state,
    );
    expect(
      wedge.reproduction.normalizedInputs.horizontalSeparation.status,
    ).toBe("available");
    expect(
      wedge.reproduction.normalizedInputs.horizontalSeparation,
    ).toHaveProperty("applicability", "broad-phase-only");
  });
});
