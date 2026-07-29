import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  GeneratorContractError,
  assertValidGenerationBundle,
  generateObby,
  hashGeneratorPreimage,
  normalizeGenerationRequest,
} from "@obby/obby-generator";

const request = {
  schemaVersion: "0.1" as const,
  requestId: "request-medium",
  workingName: "  Sky\u0301 Route  ",
  genre: "obby" as const,
  theme: "sky" as const,
  targetAudience: "general" as const,
  stageCount: 15,
  difficulty: "medium" as const,
  checkpointFrequency: 5,
  supportedMechanicPreferences: ["turning-jumps", "static-jumps"],
  excludedMechanics: ["moving-platform"],
  visualStylePreferences: ["high-readability", "bright"],
  assetPolicy: "native-parts-only" as const,
  accessibilityConstraints: ["color-independent-cues"],
  seed: 42,
  brief: "Preserved context only; never interpreted.",
};

describe("generator request normalization", () => {
  it("normalizes NFC text and semantic sets without mutating the caller", () => {
    const before = structuredClone(request);
    const normalized = normalizeGenerationRequest(request);
    expect(normalized.workingName).toBe("Ský Route");
    expect(normalized.supportedMechanicPreferences).toEqual([
      "static-jumps",
      "turning-jumps",
    ]);
    expect(request).toEqual(before);
  });

  it("applies documented defaults", () => {
    const normalized = normalizeGenerationRequest({
      schemaVersion: "0.1",
      requestId: "minimal",
      workingName: "Minimal",
      genre: "obby",
      seed: 0,
    });
    expect(normalized.stageCount).toBe(15);
    expect(normalized.checkpointFrequency).toBe(5);
    expect(normalized.difficulty).toBe("medium");
    expect(normalized.assetPolicy).toBe("native-parts-only");
  });

  it("treats omitted defaults and explicit defaults as the same semantic request", () => {
    const omittedRequest = {
      schemaVersion: "0.1",
      requestId: "omitted-defaults",
      workingName: "Defaults",
      genre: "obby",
      seed: 0,
    } as const;
    const explicitRequest = {
      schemaVersion: "0.1",
      requestId: "explicit-defaults",
      workingName: "Defaults",
      genre: "obby",
      theme: "classic",
      targetAudience: "general",
      targetSessionDurationMinutes: 12,
      stageCount: 15,
      difficulty: "medium",
      checkpointFrequency: 5,
      supportedMechanicPreferences: [],
      excludedMechanics: [],
      visualStylePreferences: [],
      assetPolicy: "native-parts-only",
      accessibilityConstraints: [],
      seed: 0,
    } as const;
    const omitted = normalizeGenerationRequest(omittedRequest);
    const explicit = normalizeGenerationRequest(explicitRequest);
    expect(explicit).toEqual(omitted);
    expect(evaluatorCanonicalStringify(generateObby(explicitRequest))).toBe(
      evaluatorCanonicalStringify(generateObby(omittedRequest)),
    );
  });

  it.each([
    [{ ...request, stageCount: 4 }, "stage-count"],
    [{ ...request, checkpointFrequency: 16 }, "checkpoint-frequency"],
    [{ ...request, genre: "simulator" }, "schema"],
    [
      { ...request, excludedMechanics: ["static-jumps"] },
      "contradictory-mechanics",
    ],
    [
      {
        ...request,
        accessibilityConstraints: ["reduced-motion", "motion-required"],
      },
      "contradictory-accessibility",
    ],
    [{ ...request, visualStylePreferences: ["unknown-style"] }, "schema"],
  ])("rejects invalid or contradictory request %#", (input, code) => {
    expect(() => normalizeGenerationRequest(input)).toThrow(
      expect.objectContaining({ code }),
    );
  });
});

describe("reference Obby generator", () => {
  it("produces a byte-identical valid bundle for equivalent set ordering", () => {
    const first = generateObby(request);
    const second = generateObby({
      ...request,
      supportedMechanicPreferences: ["static-jumps", "turning-jumps"],
      visualStylePreferences: ["bright", "high-readability"],
    });
    assertValidGenerationBundle(
      first,
      DEFAULT_MECHANIC_CATALOG,
      DEFAULT_GENERATOR_CONFIGURATION,
    );
    expect(evaluatorCanonicalStringify(first)).toBe(
      evaluatorCanonicalStringify(second),
    );
    expect(first.obbySpec.stages).toHaveLength(15);
    expect(first.obbySpec.route.orderedNodeIds.at(-1)).toBe(
      first.obbySpec.finish.routeNodeId,
    );
  });

  it("varies mechanic decisions with a different seed while preserving fixed metadata", () => {
    const first = generateObby(request);
    const second = generateObby({ ...request, seed: 43 });
    expect(first.obbySpec.game.title).toBe(second.obbySpec.game.title);
    expect(first.obbySpec.obbySpecHash).not.toBe(second.obbySpec.obbySpecHash);
    expect(
      first.obbySpec.mechanicIntents.map((intent) => intent.mechanicId),
    ).not.toEqual(
      second.obbySpec.mechanicIntents.map((intent) => intent.mechanicId),
    );
  });

  it("keeps route, checkpoint, difficulty, and hazard references closed", () => {
    const { obbySpec } = generateObby({
      ...request,
      stageCount: 30,
      difficulty: "hard",
    });
    const stageIds = new Set(obbySpec.stages.map((stage) => stage.stageId));
    expect(obbySpec.stages.map((stage) => stage.ordinal)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(obbySpec.route.transitions).toHaveLength(
      obbySpec.route.orderedNodeIds.length - 1,
    );
    expect(
      obbySpec.checkpoints.every((checkpoint) =>
        stageIds.has(checkpoint.stageId),
      ),
    ).toBe(true);
    expect(
      obbySpec.hazards.every((hazard) => stageIds.has(hazard.stageId)),
    ).toBe(true);
    expect(obbySpec.difficultyPlan.bands[0]?.band).toBe("tutorial");
    expect(
      obbySpec.difficultyPlan.bands.some((band) => band.band === "recovery"),
    ).toBe(true);
  });

  it("rejects stale hashes and excluded or unknown mechanics", () => {
    const bundle = generateObby(request);
    const stale = structuredClone(bundle);
    stale.obbySpec.game.title = "Changed";
    expect(() =>
      assertValidGenerationBundle(
        stale,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_GENERATOR_CONFIGURATION,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid-reference" }));
    expect(() =>
      generateObby({
        ...request,
        supportedMechanicPreferences: ["unknown-mechanic"],
      }),
    ).toThrow(GeneratorContractError);
  });

  it("uses only buildable mechanics unless deferred capabilities are explicitly permitted", () => {
    const normal = generateObby(request);
    expect(
      normal.obbySpec.limitations.some(
        (item) => item.code === "deferred-mechanic",
      ),
    ).toBe(false);
    const configurationPreimage = {
      ...DEFAULT_GENERATOR_CONFIGURATION,
      configurationId: "g0-reference-with-deferred",
      allowDeferredMechanics: true,
    };
    const allowedConfiguration = {
      ...configurationPreimage,
      configurationHash: hashGeneratorPreimage(
        configurationPreimage,
        "configurationHash",
      ),
    };
    const deferred = generateObby(
      {
        ...request,
        supportedMechanicPreferences: ["moving-platform"],
        excludedMechanics: [],
      },
      allowedConfiguration,
      DEFAULT_MECHANIC_CATALOG,
    );
    expect(
      deferred.obbySpec.limitations.some(
        (item) => item.code === "deferred-mechanic",
      ),
    ).toBe(true);
    assertValidGenerationBundle(
      deferred,
      DEFAULT_MECHANIC_CATALOG,
      allowedConfiguration,
    );
  });
});
