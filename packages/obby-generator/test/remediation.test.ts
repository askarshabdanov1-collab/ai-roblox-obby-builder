import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  assertValidGeneratorConfiguration,
  assertValidMechanicCatalog,
  assertValidNormalizedGenerationRequest,
  estimateGenerationWorkUnits,
  generateObby,
  hashGeneratorPreimage,
} from "@obby/obby-generator";
import type {
  GenerationBundle,
  GeneratorConfiguration,
  NormalizedGenerationRequest,
} from "@obby/obby-generator";
import { describe, expect, it } from "vitest";

const baseRequest = {
  schemaVersion: "0.1" as const,
  requestId: "remediation",
  workingName: "Remediation Obby",
  genre: "obby" as const,
  theme: "space" as const,
  targetAudience: "general" as const,
  targetSessionDurationMinutes: 12,
  stageCount: 15,
  difficulty: "medium" as const,
  checkpointFrequency: 5,
  assetPolicy: "native-parts-only" as const,
  excludedMechanics: ["moving-platform"],
  seed: 17,
};

function configuration(
  difficultyDeltaLimit: number,
  maxWorkUnits = DEFAULT_GENERATOR_CONFIGURATION.limits.maxWorkUnits,
): GeneratorConfiguration {
  const preimage = {
    ...DEFAULT_GENERATOR_CONFIGURATION,
    configurationId: `g0-delta-${difficultyDeltaLimit}-work-${maxWorkUnits}`,
    difficultyDeltaLimit,
    limits: {
      ...DEFAULT_GENERATOR_CONFIGURATION.limits,
      maxWorkUnits,
    },
  };
  return {
    ...preimage,
    configurationHash: hashGeneratorPreimage(preimage, "configurationHash"),
  };
}

function refreshBundle(bundle: GenerationBundle): void {
  bundle.obbySpec.obbySpecHash = hashGeneratorPreimage(
    bundle.obbySpec,
    "obbySpecHash",
  );
  bundle.generationBundleHash = hashGeneratorPreimage(
    bundle,
    "generationBundleHash",
  );
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing ${label}`);
  return value;
}

describe("fail-closed normalized request validation", () => {
  const invalidCases: [
    string,
    string,
    (value: NormalizedGenerationRequest) => void,
  ][] = [
    ["empty working name", "schema", (value) => void (value.workingName = "")],
    ["negative seed", "schema", (value) => void (value.seed = -1)],
    [
      "seed above uint32",
      "schema",
      (value) => void (value.seed = 0x1_0000_0000),
    ],
    [
      "zero checkpoint frequency",
      "schema",
      (value) => void (value.checkpointFrequency = 0),
    ],
    [
      "negative session duration",
      "schema",
      (value) => void (value.targetSessionDurationMinutes = -1),
    ],
    [
      "duplicate mechanic set",
      "schema",
      (value) =>
        void (value.excludedMechanics = ["moving-platform", "moving-platform"]),
    ],
    [
      "unsorted mechanic set",
      "invariant",
      (value) =>
        void (value.excludedMechanics = ["spinner", "moving-platform"]),
    ],
    [
      "non-NFC text",
      "invariant",
      (value) => void (value.workingName = "Cafe\u0301"),
    ],
    [
      "preferred/excluded overlap",
      "contradictory-mechanics",
      (value) =>
        void (value.supportedMechanicPreferences = ["moving-platform"]),
    ],
    [
      "whitespace-only brief",
      "invariant",
      (value) => void (value.brief = "  "),
    ],
  ];

  it.each(invalidCases)(
    "rejects %s even with fresh content hashes",
    (_, code, mutate) => {
      const value = structuredClone(
        generateObby(baseRequest).normalizedRequest,
      );
      mutate(value);
      value.generationRequestHash = hashGeneratorPreimage(
        {
          schemaVersion: value.schemaVersion,
          workingName: value.workingName,
          genre: value.genre,
          theme: value.theme,
          targetAudience: value.targetAudience,
          targetSessionDurationMinutes: value.targetSessionDurationMinutes,
          stageCount: value.stageCount,
          difficulty: value.difficulty,
          checkpointFrequency: value.checkpointFrequency,
          supportedMechanicPreferences: value.supportedMechanicPreferences,
          excludedMechanics: value.excludedMechanics,
          visualStylePreferences: value.visualStylePreferences,
          assetPolicy: value.assetPolicy,
          accessibilityConstraints: value.accessibilityConstraints,
          seed: value.seed,
          ...(value.brief === undefined ? {} : { brief: value.brief }),
        },
        "generationRequestHash",
      );
      value.normalizedRequestId = `normalized-${value.generationRequestHash.slice(7, 23)}`;
      value.normalizedRequestHash = hashGeneratorPreimage(
        value,
        "normalizedRequestHash",
      );
      expect(() =>
        assertValidNormalizedGenerationRequest(value, DEFAULT_MECHANIC_CATALOG),
      ).toThrow(expect.objectContaining({ code }));
    },
  );

  it("requires catalog authority at the public validation boundary", () => {
    const value = generateObby(baseRequest).normalizedRequest;
    expect(() =>
      (
        assertValidNormalizedGenerationRequest as unknown as (
          input: unknown,
        ) => void
      )(value),
    ).toThrow(expect.objectContaining({ code: "invariant" }));
  });
});

describe("bundle, request, and spec semantic binding", () => {
  const mutations: [
    string,
    "invalid-reference" | "invariant",
    (bundle: GenerationBundle) => void,
  ][] = [
    [
      "working title",
      "invalid-reference",
      (bundle) => void (bundle.obbySpec.game.title = "Other"),
    ],
    [
      "target audience",
      "invalid-reference",
      (bundle) => void (bundle.obbySpec.game.targetAudience = "all-ages"),
    ],
    [
      "session duration",
      "invalid-reference",
      (bundle) => void (bundle.obbySpec.game.targetSessionDurationMinutes = 13),
    ],
    [
      "stage count",
      "invalid-reference",
      (bundle) => void bundle.obbySpec.stages.pop(),
    ],
    [
      "difficulty",
      "invalid-reference",
      (bundle) =>
        void (bundle.obbySpec.difficultyPlan.targetDifficulty = "hard"),
    ],
    [
      "checkpoint cadence",
      "invalid-reference",
      (bundle) => void (bundle.obbySpec.retentionIntent.checkpointCadence = 4),
    ],
    [
      "theme",
      "invariant",
      (bundle) =>
        void (required(
          bundle.obbySpec.visualStyleIntents.at(0),
          "visual intent",
        ).themeFamily = "lava"),
    ],
    [
      "asset policy",
      "invariant",
      (bundle) =>
        void (required(
          bundle.obbySpec.assetIntents.at(0),
          "asset intent",
        ).preferredSourcePolicy = "external-assets-allowed-later"),
    ],
    ["seed", "invalid-reference", (bundle) => void (bundle.obbySpec.seed = 18)],
    [
      "configuration identity",
      "invalid-reference",
      (bundle) =>
        void (bundle.obbySpec.configurationHash = `sha256:${"1".repeat(64)}`),
    ],
    [
      "catalog identity",
      "invalid-reference",
      (bundle) =>
        void (bundle.obbySpec.catalogHash = `sha256:${"2".repeat(64)}`),
    ],
    [
      "normalized identity",
      "invalid-reference",
      (bundle) =>
        void (bundle.obbySpec.normalizedRequestHash = `sha256:${"3".repeat(64)}`),
    ],
  ];

  it.each(mutations)(
    "rejects an independently mismatched %s",
    (_, code, mutate) => {
      const bundle = structuredClone(generateObby(baseRequest));
      mutate(bundle);
      refreshBundle(bundle);
      expect(() =>
        assertValidGenerationBundle(
          bundle,
          DEFAULT_MECHANIC_CATALOG,
          DEFAULT_GENERATOR_CONFIGURATION,
        ),
      ).toThrow(expect.objectContaining({ code }));
    },
  );

  it("rejects unrelated bundle request identity", () => {
    const bundle = structuredClone(generateObby(baseRequest));
    bundle.generationRequestHash = `sha256:${"4".repeat(64)}`;
    bundle.generationBundleHash = hashGeneratorPreimage(
      bundle,
      "generationBundleHash",
    );
    expect(() =>
      assertValidGenerationBundle(
        bundle,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_GENERATOR_CONFIGURATION,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid-reference" }));
  });
});

describe("configuration, catalog, and deterministic work", () => {
  it.each([1, 2])(
    "honors difficulty delta %i across the supported matrix",
    (delta) => {
      const config = configuration(delta);
      for (const difficulty of ["easy", "medium", "hard"] as const)
        for (const stageCount of [5, 15, 30, 50]) {
          const bundle = generateObby(
            { ...baseRequest, difficulty, stageCount },
            config,
            DEFAULT_MECHANIC_CATALOG,
          );
          assertValidGenerationBundle(bundle, DEFAULT_MECHANIC_CATALOG, config);
          const levels = bundle.obbySpec.difficultyPlan.bands.map(
            (band) => band.intentLevel,
          );
          expect(
            levels
              .slice(1)
              .every(
                (level, index) =>
                  Math.abs(level - (levels[index] ?? level)) <= delta,
              ),
          ).toBe(true);
        }
    },
    30_000,
  );

  it("enforces real generator work at N-1, N, and N+1", () => {
    const required = estimateGenerationWorkUnits(
      baseRequest.stageCount,
      DEFAULT_MECHANIC_CATALOG.mechanics.length,
    );
    expect(() =>
      generateObby(baseRequest, configuration(2, required - 1)),
    ).toThrow(expect.objectContaining({ code: "work-limit" }));
    expect(() =>
      generateObby(baseRequest, configuration(2, required)),
    ).not.toThrow();
    expect(() =>
      generateObby(baseRequest, configuration(2, required + 1)),
    ).not.toThrow();
    expect(estimateGenerationWorkUnits(50, 50)).toBe(25_000);
  });

  it("preserves checkpoint cardinality and reports deterministic frequency-one collision adjustment", () => {
    const bundle = generateObby({
      ...baseRequest,
      stageCount: 50,
      difficulty: "hard",
      checkpointFrequency: 1,
    });
    expect(bundle.obbySpec.checkpoints).toHaveLength(49);
    expect(bundle.obbySpec.checkpoints.map((item) => item.routeOrder)).toEqual(
      Array.from({ length: 49 }, (_, index) => index + 1),
    );
    expect(bundle.findings.map((item) => item.code)).toContain(
      "checkpoint-cadence-adjusted",
    );
  });

  it("places every recovery immediately after a target peak with cooldown", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const bands = generateObby({
        ...baseRequest,
        stageCount: 50,
        difficulty,
      }).obbySpec.difficultyPlan.bands;
      const peak = difficulty === "easy" ? 3 : difficulty === "medium" ? 4 : 5;
      const recoveries = bands
        .map((band, index) => ({ band, index }))
        .filter(({ band }) => band.band === "recovery");
      for (const { index } of recoveries)
        expect(bands[index - 1]?.intentLevel).toBe(peak);
      for (let index = 1; index < recoveries.length; index += 1)
        expect(
          required(recoveries.at(index), "recovery").index -
            required(recoveries.at(index - 1), "previous recovery").index,
        ).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects shuffled, duplicate, and capability-conflicting catalogs", () => {
    const shuffled = structuredClone(DEFAULT_MECHANIC_CATALOG);
    shuffled.mechanics.reverse();
    shuffled.catalogHash = hashGeneratorPreimage(shuffled, "catalogHash");
    expect(() => assertValidMechanicCatalog(shuffled)).toThrow();

    const duplicate = structuredClone(DEFAULT_MECHANIC_CATALOG);
    duplicate.mechanics[1] = structuredClone(
      required(duplicate.mechanics.at(0), "first mechanic"),
    );
    duplicate.catalogHash = hashGeneratorPreimage(duplicate, "catalogHash");
    expect(() => assertValidMechanicCatalog(duplicate)).toThrow();

    const conflicting = structuredClone(DEFAULT_MECHANIC_CATALOG);
    const staticMechanic = required(
      conflicting.mechanics.find(
        (mechanic) => mechanic.capability === "g1-static-supported",
      ),
      "static mechanic",
    );
    staticMechanic.requiredCapabilities = ["runtime-mechanic"];
    staticMechanic.mechanicDefinitionHash = hashGeneratorPreimage(
      staticMechanic,
      "mechanicDefinitionHash",
    );
    conflicting.catalogHash = hashGeneratorPreimage(conflicting, "catalogHash");
    expect(() => assertValidMechanicCatalog(conflicting)).toThrow();

    const incompatibleHazardCatalog = structuredClone(DEFAULT_MECHANIC_CATALOG);
    const staticWithMovingHazard = required(
      incompatibleHazardCatalog.mechanics.find(
        (mechanic) => mechanic.capability === "g1-static-supported",
      ),
      "static hazard mechanic",
    );
    staticWithMovingHazard.compatibleHazardKinds = ["moving-obstacle-intent"];
    staticWithMovingHazard.mechanicDefinitionHash = hashGeneratorPreimage(
      staticWithMovingHazard,
      "mechanicDefinitionHash",
    );
    incompatibleHazardCatalog.catalogHash = hashGeneratorPreimage(
      incompatibleHazardCatalog,
      "catalogHash",
    );
    expect(() =>
      assertValidMechanicCatalog(incompatibleHazardCatalog),
    ).toThrow();
  });

  it("sweeps 100 seeds across edge sizes, difficulties, frequencies, and delta policies", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const stageCount = required(
        [5, 6, 15, 30, 50].at(seed % 5),
        "stage-count matrix value",
      );
      const difficulty = required(
        (["easy", "medium", "hard"] as const).at(seed % 3),
        "difficulty matrix value",
      );
      const checkpointFrequency = seed % 2 === 0 ? 1 : stageCount;
      const config = configuration(seed % 2 === 0 ? 1 : 2);
      const bundle = generateObby(
        {
          ...baseRequest,
          seed,
          stageCount,
          difficulty,
          checkpointFrequency,
        },
        config,
      );
      assertValidGenerationBundle(bundle, DEFAULT_MECHANIC_CATALOG, config);
      expect(bundle.obbySpec.checkpoints).toHaveLength(
        Math.floor((stageCount - 1) / checkpointFrequency),
      );
    }
  }, 60_000);

  it("keeps same-seed/default-equivalent bytes and changes controlled seed semantics", () => {
    const same = generateObby(baseRequest);
    expect(evaluatorCanonicalStringify(generateObby(baseRequest))).toBe(
      evaluatorCanonicalStringify(same),
    );
    const different = generateObby({ ...baseRequest, seed: 18 });
    expect(different.obbySpec.obbySpecHash).not.toBe(
      same.obbySpec.obbySpecHash,
    );
    expect(different.obbySpec.stages).toHaveLength(same.obbySpec.stages.length);
    expect(different.normalizedRequest.assetPolicy).toBe(
      same.normalizedRequest.assetPolicy,
    );
  });

  it("accepts schema-valid generated configurations before use", () => {
    assertValidGeneratorConfiguration(configuration(1));
    assertValidGeneratorConfiguration(configuration(2));
  });

  it("rejects impossible all-excluded and only-deferred constraint sets deterministically", () => {
    const staticIds = DEFAULT_MECHANIC_CATALOG.mechanics
      .filter((mechanic) => mechanic.capability === "g1-static-supported")
      .map((mechanic) => mechanic.mechanicId);
    expect(() =>
      generateObby({
        ...baseRequest,
        excludedMechanics: DEFAULT_MECHANIC_CATALOG.mechanics.map(
          (mechanic) => mechanic.mechanicId,
        ),
      }),
    ).toThrow(expect.objectContaining({ code: "invariant" }));
    expect(() =>
      generateObby(
        {
          ...baseRequest,
          supportedMechanicPreferences: ["moving-platform"],
          excludedMechanics: staticIds,
        },
        {
          ...configuration(2),
          configurationId: "g0-only-deferred",
          allowDeferredMechanics: true,
          configurationHash: hashGeneratorPreimage(
            {
              ...configuration(2),
              configurationId: "g0-only-deferred",
              allowDeferredMechanics: true,
            },
            "configurationHash",
          ),
        },
      ),
    ).toThrow(expect.objectContaining({ code: "invariant" }));
  });
});
