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
  preflightGenerationWorkAdmission,
} from "@obby/obby-generator";
import type {
  GenerationBundle,
  GenerationRequest,
  GeneratorConfiguration,
  MechanicCatalog,
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
    configurationId: `g0-delta-${difficultyDeltaLimit}`,
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

function nearMaximumCatalog(mechanicCount: number): MechanicCatalog {
  const template = required(
    DEFAULT_MECHANIC_CATALOG.mechanics.find(
      (mechanic) => mechanic.mechanicId === "static-jumps",
    ),
    "static mechanic template",
  );
  const mechanics = Array.from({ length: mechanicCount }, (_, index) => {
    const mechanic = {
      ...structuredClone(template),
      mechanicId: `audit-static-${String(index).padStart(2, "0")}`,
      label: `Audit static ${index}`,
      forbiddenAdjacentMechanicIds: [],
      repetitionLimit: 10,
    };
    return {
      ...mechanic,
      mechanicDefinitionHash: hashGeneratorPreimage(
        mechanic,
        "mechanicDefinitionHash",
      ),
    };
  });
  const catalog = {
    schemaVersion: "0.1" as const,
    catalogId: `audit-static-${mechanicCount}`,
    catalogVersion: "g0-v1" as const,
    mechanics,
  };
  return {
    ...catalog,
    catalogHash: hashGeneratorPreimage(catalog, "catalogHash"),
  };
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

  it("admits work before every covered operation and reports N-1/N/N+1 exactly", () => {
    const catalog = nearMaximumCatalog(49);
    const request = { ...baseRequest, stageCount: 50, excludedMechanics: [] };
    const requiredWorkUnits = estimateGenerationWorkUnits(50, 49);
    expect(requiredWorkUnits).toBe(24_700);

    const coveredOperations: string[] = [];
    let underfundedResult: GenerationBundle | undefined;
    expect(() => {
      underfundedResult = generateObby(
        request,
        configuration(2, requiredWorkUnits - 1),
        catalog,
        {
          onCoveredOperation: (operation) => coveredOperations.push(operation),
        },
      );
    }).toThrow(expect.objectContaining({ code: "maximum-work-units" }));
    expect(coveredOperations).toEqual([]);
    expect(underfundedResult).toBeUndefined();

    const admissions: object[] = [];
    const exactOperations: string[] = [];
    const exact = generateObby(
      request,
      configuration(2, requiredWorkUnits),
      catalog,
      {
        onWorkAdmitted: (admission) => admissions.push(admission),
        onCoveredOperation: (operation) => exactOperations.push(operation),
      },
    );
    const oneExtra = generateObby(
      request,
      configuration(2, requiredWorkUnits + 1),
      catalog,
      { onWorkAdmitted: (admission) => admissions.push(admission) },
    );
    const larger = generateObby(
      request,
      configuration(2, requiredWorkUnits + 300),
      catalog,
    );
    expect(admissions).toEqual([
      {
        requiredWorkUnits,
        admittedWorkUnits: requiredWorkUnits,
        availableWorkUnits: requiredWorkUnits,
        unusedWorkUnits: 0,
      },
      {
        requiredWorkUnits,
        admittedWorkUnits: requiredWorkUnits,
        availableWorkUnits: requiredWorkUnits + 1,
        unusedWorkUnits: 1,
      },
    ]);
    expect(exactOperations).toEqual([
      "input-snapshot",
      "configuration-validation",
      "catalog-validation",
      "request-normalization",
      "planning",
      "hashing",
      "prng-derivation",
      "graph-validation",
      "bundle-validation",
      "serialization-preparation",
    ]);
    expect(exact.obbySpec.stages).toHaveLength(50);
    expect(
      evaluatorCanonicalStringify(
        generateObby(request, configuration(2, requiredWorkUnits), catalog),
      ),
    ).toBe(evaluatorCanonicalStringify(exact));
    expect(evaluatorCanonicalStringify(oneExtra)).toBe(
      evaluatorCanonicalStringify(exact),
    );
    expect(evaluatorCanonicalStringify(larger)).toBe(
      evaluatorCanonicalStringify(exact),
    );
    expect(oneExtra.generationBundleHash).toBe(exact.generationBundleHash);
    expect(larger.generationBundleHash).toBe(exact.generationBundleHash);
    expect(oneExtra.obbySpec.obbySpecHash).toBe(exact.obbySpec.obbySpecHash);
    expect(larger.obbySpec.obbySpecHash).toBe(exact.obbySpec.obbySpecHash);
    expect(oneExtra.obbySpec.stages).toHaveLength(50);
    expect(estimateGenerationWorkUnits(50, 50)).toBe(25_000);
  });

  it("rejects accessors, proxies, inherited fields, and coercion hooks without executing them before admission", () => {
    const requiredWorkUnits = estimateGenerationWorkUnits(
      baseRequest.stageCount,
      DEFAULT_MECHANIC_CATALOG.mechanics.length,
    );
    const underfunded = configuration(2, requiredWorkUnits - 1);

    const cases: {
      label: string;
      request?: unknown;
      configuration?: unknown;
      catalog?: unknown;
      calls: () => number;
    }[] = [];
    const getterCase = (
      label: string,
      target: Record<string, unknown>,
      field: string,
      placement: "request" | "configuration" | "catalog",
    ) => {
      let calls = 0;
      Object.defineProperty(target, field, {
        enumerable: true,
        get: () => {
          calls += 1;
          hashGeneratorPreimage(baseRequest);
          return field === "stageCount" ? baseRequest.stageCount : undefined;
        },
      });
      cases.push({
        label,
        [placement]: target,
        calls: () => calls,
      });
    };

    getterCase(
      "request.stageCount",
      { ...baseRequest },
      "stageCount",
      "request",
    );
    getterCase(
      "configuration.limits",
      { ...underfunded },
      "limits",
      "configuration",
    );
    const limits = { ...underfunded.limits };
    getterCase("limits.maxWorkUnits", limits, "maxWorkUnits", "configuration");
    const limitsCase = cases.at(-1);
    if (limitsCase === undefined) throw new Error("missing limits getter case");
    limitsCase.configuration = { ...underfunded, limits };
    getterCase(
      "catalog.mechanics",
      { ...DEFAULT_MECHANIC_CATALOG },
      "mechanics",
      "catalog",
    );

    for (const testCase of cases) {
      expect(() =>
        generateObby(
          testCase.request ?? baseRequest,
          (testCase.configuration ?? underfunded) as GeneratorConfiguration,
          (testCase.catalog ?? DEFAULT_MECHANIC_CATALOG) as MechanicCatalog,
        ),
      ).toThrow(expect.objectContaining({ code: "validation" }));
      expect(testCase.calls(), testCase.label).toBe(0);
    }

    let inheritedCalls = 0;
    const inheritedPrototype = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(inheritedPrototype, "stageCount", {
      get: () => {
        inheritedCalls += 1;
        return baseRequest.stageCount;
      },
    });
    const inheritedRequest = Object.create(inheritedPrototype) as Record<
      string,
      unknown
    >;
    const inheritedDescriptors = Object.getOwnPropertyDescriptors(baseRequest);
    Reflect.deleteProperty(inheritedDescriptors, "stageCount");
    Object.defineProperties(inheritedRequest, inheritedDescriptors);
    expect(() => generateObby(inheritedRequest, underfunded)).toThrow(
      expect.objectContaining({ code: "validation" }),
    );
    expect(inheritedCalls).toBe(0);

    for (const field of ["request", "catalog"] as const) {
      let traps = 0;
      const value = new Proxy(
        field === "request" ? baseRequest : DEFAULT_MECHANIC_CATALOG,
        {
          get: (target, key, receiver) => {
            traps += 1;
            return Reflect.get(target, key, receiver) as unknown;
          },
          getOwnPropertyDescriptor: (target, key) => {
            traps += 1;
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
          getPrototypeOf: (target) => {
            traps += 1;
            return Reflect.getPrototypeOf(target);
          },
          ownKeys: (target) => {
            traps += 1;
            return Reflect.ownKeys(target);
          },
        },
      );
      expect(() =>
        generateObby(
          field === "request" ? value : baseRequest,
          underfunded,
          (field === "catalog"
            ? value
            : DEFAULT_MECHANIC_CATALOG) as MechanicCatalog,
        ),
      ).toThrow(expect.objectContaining({ code: "validation" }));
      expect(traps, field).toBe(0);
    }

    let indexCalls = 0;
    const mechanics = [...DEFAULT_MECHANIC_CATALOG.mechanics];
    Object.defineProperty(mechanics, "0", {
      enumerable: true,
      get: () => {
        indexCalls += 1;
        return DEFAULT_MECHANIC_CATALOG.mechanics[0];
      },
    });
    const accessorCatalog = { ...DEFAULT_MECHANIC_CATALOG, mechanics };
    expect(() =>
      generateObby(baseRequest, underfunded, accessorCatalog),
    ).toThrow(expect.objectContaining({ code: "validation" }));
    expect(indexCalls).toBe(0);
    expect(() =>
      generateObby(
        baseRequest,
        configuration(2, requiredWorkUnits),
        accessorCatalog,
      ),
    ).toThrow(expect.objectContaining({ code: "validation" }));
    expect(indexCalls).toBe(0);

    class MechanicArray extends Array<MechanicCatalog["mechanics"][number]> {}
    const subclassCatalog = {
      ...DEFAULT_MECHANIC_CATALOG,
      mechanics: MechanicArray.from(DEFAULT_MECHANIC_CATALOG.mechanics),
    };
    expect(() =>
      generateObby(baseRequest, underfunded, subclassCatalog),
    ).toThrow(expect.objectContaining({ code: "validation" }));

    for (const coercionKey of ["valueOf", Symbol.toPrimitive] as const) {
      let coercions = 0;
      const stageCount = {
        [coercionKey]: () => {
          coercions += 1;
          return baseRequest.stageCount;
        },
      };
      expect(() =>
        generateObby({ ...baseRequest, stageCount }, underfunded),
      ).toThrow(expect.objectContaining({ code: "validation" }));
      expect(coercions).toBe(0);
    }

    expect(Object.getOwnPropertyDescriptor([], "length")?.configurable).toBe(
      false,
    );
  });

  it.each(["onWorkAdmitted", "input-snapshot"] as const)(
    "snapshots all semantic input before the %s callback can mutate callers",
    (seam) => {
      const admittedStageCount = 5;
      const request: GenerationRequest = {
        ...baseRequest,
        stageCount: admittedStageCount,
        difficulty: "easy" as const,
        checkpointFrequency: 3,
        seed: 23,
      };
      const requiredWorkUnits = estimateGenerationWorkUnits(
        admittedStageCount,
        DEFAULT_MECHANIC_CATALOG.mechanics.length,
      );
      const config = configuration(2, requiredWorkUnits);
      const catalog = structuredClone(DEFAULT_MECHANIC_CATALOG);
      const control = generateObby(
        structuredClone(request),
        structuredClone(config),
        structuredClone(catalog),
      );
      let admitted: object | undefined;
      let phaseTrace: readonly string[] | undefined;
      let mutationRan = false;
      const mutateOriginals = () => {
        mutationRan = true;
        request.stageCount = 50;
        request.difficulty = "hard";
        request.checkpointFrequency = 2;
        request.assetPolicy = "approved-local-assets";
        request.seed = 999;
        config.limits.maxWorkUnits = 1;
        const firstMechanic = catalog.mechanics[0];
        if (firstMechanic === undefined) throw new Error("missing mechanic");
        firstMechanic.label = "Mutated after admission";
        catalog.mechanics.push(structuredClone(firstMechanic));
      };
      const output = generateObby(request, config, catalog, {
        onWorkAdmitted: (value) => {
          admitted = value;
          if (seam === "onWorkAdmitted") mutateOriginals();
        },
        onCoveredOperation: (operation) => {
          if (seam === "input-snapshot" && operation === "input-snapshot")
            mutateOriginals();
        },
        onPhaseTrace: (trace) => {
          phaseTrace = trace;
        },
      });
      expect(mutationRan).toBe(true);
      expect(Object.isFrozen(admitted)).toBe(true);
      expect(admitted).toEqual({
        requiredWorkUnits,
        admittedWorkUnits: requiredWorkUnits,
        availableWorkUnits: requiredWorkUnits,
        unusedWorkUnits: 0,
      });
      expect(output.obbySpec.stages).toHaveLength(5);
      expect(evaluatorCanonicalStringify(output)).toBe(
        evaluatorCanonicalStringify(control),
      );
      expect(phaseTrace).toEqual([
        "safe-shape-check",
        "snapshot-complete",
        "work-admission",
        "callbacks",
        "semantic-validation",
        "normalization",
        "generation",
      ]);
    },
  );

  it("maps callback exceptions to callback-failed without producing output", () => {
    let output: GenerationBundle | undefined;
    expect(() => {
      output = generateObby(baseRequest, undefined, undefined, {
        onWorkAdmitted: () => {
          throw new Error("private callback detail");
        },
      });
    }).toThrow(
      expect.objectContaining({
        code: "callback-failed",
        message: "generation callback failed",
      }),
    );
    expect(output).toBeUndefined();
  });

  it("gives budget admission precedence over semantic validation", () => {
    const invalidRequest = { ...baseRequest, workingName: "   " };
    const requiredWorkUnits = estimateGenerationWorkUnits(
      baseRequest.stageCount,
      DEFAULT_MECHANIC_CATALOG.mechanics.length,
    );
    const coveredOperations: string[] = [];
    const invalidConfiguration = configuration(2, requiredWorkUnits - 1);
    invalidConfiguration.generatorVersion = "invalid" as "g0-reference-v1";
    const invalidCatalog = structuredClone(DEFAULT_MECHANIC_CATALOG);
    invalidCatalog.mechanics.reverse();
    expect(() =>
      generateObby(invalidRequest, invalidConfiguration, invalidCatalog, {
        onCoveredOperation: (operation) => coveredOperations.push(operation),
      }),
    ).toThrow(expect.objectContaining({ code: "maximum-work-units" }));
    expect(coveredOperations).toEqual([]);

    expect(() =>
      generateObby(
        invalidRequest,
        configuration(2, requiredWorkUnits),
        DEFAULT_MECHANIC_CATALOG,
      ),
    ).toThrow(expect.objectContaining({ code: "schema" }));

    const ordered = preflightGenerationWorkAdmission(
      baseRequest,
      configuration(2, requiredWorkUnits),
      DEFAULT_MECHANIC_CATALOG,
    );
    const reversed = preflightGenerationWorkAdmission(
      {
        ...baseRequest,
        excludedMechanics: [...baseRequest.excludedMechanics].reverse(),
      },
      configuration(2, requiredWorkUnits),
      DEFAULT_MECHANIC_CATALOG,
    );
    expect(reversed).toEqual(ordered);
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
