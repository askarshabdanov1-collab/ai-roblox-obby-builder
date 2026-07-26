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
  return requiredFixture(
    evaluationAt(0, 4, 16).transitions[0],
    "first normalized transition",
  );
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

function rehashEvidence(
  record: EvidenceRecordContract,
): EvidenceRecordContract {
  const clone = structuredClone(record);
  clone.evidenceContentHash = hashEvidenceContent(clone).hash;
  return clone;
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

  it("canonicalizes duplicate and shuffled available measurement evidence hashes", () => {
    const base = baseTransition();
    if (base.horizontalSeparation.status !== "available") {
      throw new Error("fixture available measurement is missing");
    }
    const hashes = base.horizontalSeparation.evidenceHashes;
    expect(hashes.length).toBeGreaterThan(0);
    const result = classifyCoarseTransition(
      {
        ...base,
        horizontalSeparation: {
          ...base.horizontalSeparation,
          evidenceHashes: [...hashes].reverse().flatMap((hash) => [hash, hash]),
        },
      },
      createDefaultControllerProfile(),
    );
    expect(
      result.reproduction.normalizedInputs.horizontalSeparation,
    ).toMatchObject({
      status: "available",
      evidenceHashes: [...new Set(hashes)].toSorted(),
    });
  });

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

  it("validates a complete graph, ignores unrelated geometry, and emits only the exact transition evidence hash", () => {
    const evaluated = evaluationAt(0, 4, 16);
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
      baseTransition(),
      createDefaultControllerProfile(),
      {
        evidenceRecords: completeGraphWithUnrelated,
        expectedManifestHash: manifestHash,
      },
    );
    const shuffled = classifyCoarseTransitionWithEvidence(
      baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
          baseTransition(),
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
