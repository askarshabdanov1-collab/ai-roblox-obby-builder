import { hashControllerProfile } from "@obby/obby-evaluator-contracts";
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
        limitations: [],
        applicability: "broad-phase-only",
      },
      "measurement-value",
      "/horizontalSeparation/value",
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

  it("rejects missing or stale evidence references before evidence-backed classification", () => {
    const evaluated = evaluationAt(0, 4, 16);
    const transitionRecord = requiredFixture(
      evaluated.evidence.find((record) => record.kind === "route-transition"),
      "route transition evidence",
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
          [],
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
          [
            {
              ...transitionRecord,
              evidenceContentHash: `sha256:${"f".repeat(64)}`,
            },
          ],
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "input-evidence-identity",
        path: "/inputEvidenceRecords/0/evidenceContentHash",
      }),
    ]);
    const unrelatedTransitionRecord = requiredFixture(
      evaluated.evidence.find(
        (record) =>
          record.kind === "route-transition" &&
          record.evidenceContentHash !== transitionRecord.evidenceContentHash,
      ),
      "unrelated route transition evidence",
    );
    expect(
      issueFrom(() =>
        classifyCoarseTransitionWithEvidence(
          baseTransition(),
          createDefaultControllerProfile(),
          [unrelatedTransitionRecord],
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "transition-evidence-required",
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
