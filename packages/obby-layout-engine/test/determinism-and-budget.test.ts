import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
  hashGeneratorPreimage,
} from "@obby/obby-generator";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  LayoutEngineError,
  deriveLayoutDomainSeed,
  estimateLayoutWorkUnits,
  generateLayout,
  preflightLayoutWorkAdmission,
} from "../src/index.js";
import {
  BASE_LAYOUT_REQUEST,
  canonicalLayout,
  layoutConfigurationWithBudget,
  layoutFor,
  sourceBundle,
} from "./helpers.js";

describe("G1b determinism and bounded work", () => {
  it("domain-separates stable layout randomness", () => {
    const source = sourceBundle();
    const hashes = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.map(
      (definition) => definition.mechanicLayoutDefinitionHash,
    );
    const first = deriveLayoutDomainSeed(
      source.obbySpec.seedIdentity,
      DEFAULT_LAYOUT_CONFIGURATION.configurationHash,
      hashes,
      "stage:01:recipe",
    );
    expect(
      deriveLayoutDomainSeed(
        source.obbySpec.seedIdentity,
        DEFAULT_LAYOUT_CONFIGURATION.configurationHash,
        [...hashes].reverse(),
        "stage:01:recipe",
      ),
    ).toBe(first);
    expect(
      deriveLayoutDomainSeed(
        source.obbySpec.seedIdentity,
        DEFAULT_LAYOUT_CONFIGURATION.configurationHash,
        hashes,
        "stage:01:decoration",
      ),
    ).not.toBe(first);
  });

  it("passes N and N+1 with identical bytes and rejects N-1 before generation", () => {
    const source = sourceBundle();
    const admission = preflightLayoutWorkAdmission(
      source,
      DEFAULT_LAYOUT_CONFIGURATION,
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    );
    const expected = estimateLayoutWorkUnits({
      stageCount: source.obbySpec.stages.length,
      definitionCount: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.length,
      hazardCount: source.obbySpec.hazards.length,
      assetIntentCount: source.obbySpec.assetIntents.length,
    });
    expect(admission.requiredWorkUnits).toBe(expected);
    let callbackInvoked = false;
    expect(() =>
      generateLayout(
        source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        layoutConfigurationWithBudget(expected - 1),
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
        { onWorkAdmitted: () => (callbackInvoked = true) },
      ),
    ).toThrow(expect.objectContaining({ code: "maximum-work-units" }));
    expect(callbackInvoked).toBe(false);
    const exact = layoutFor(source, layoutConfigurationWithBudget(expected));
    const extra = layoutFor(
      source,
      layoutConfigurationWithBudget(expected + 1),
    );
    expect(canonicalLayout(extra)).toBe(canonicalLayout(exact));
  });

  it("rejects stale content-addressed layout authority before expansion", () => {
    const stale = structuredClone(DEFAULT_LAYOUT_CONFIGURATION);
    stale.numericParameters[0].value += 0.25;
    expect(() => layoutFor(sourceBundle(), stale)).toThrow(
      expect.objectContaining({ code: "stale-authority" }),
    );
  });

  it("retains one immutable snapshot across admitted callbacks", () => {
    const source = structuredClone(sourceBundle());
    const configuration = structuredClone(DEFAULT_LAYOUT_CONFIGURATION);
    const catalog = structuredClone(DEFAULT_MECHANIC_CATALOG);
    const generatorConfiguration = structuredClone(
      DEFAULT_GENERATOR_CONFIGURATION,
    );
    const definitions = structuredClone(
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    ) as (typeof DEFAULT_MECHANIC_LAYOUT_DEFINITIONS)[number][];
    const control = generateLayout(
      structuredClone(source),
      structuredClone(generatorConfiguration),
      structuredClone(catalog),
      structuredClone(configuration),
      structuredClone(definitions),
    );
    let observedAdmission: unknown;
    const output = generateLayout(
      source,
      generatorConfiguration,
      catalog,
      configuration,
      definitions,
      {
        onWorkAdmitted: (admission) => {
          observedAdmission = admission;
          source.obbySpec.stages.splice(1);
          configuration.limits.maxWorkUnits = 1;
          definitions.splice(1);
        },
      },
    );
    expect(Object.isFrozen(observedAdmission)).toBe(true);
    expect(canonicalLayout(output)).toBe(canonicalLayout(control));
  });

  it("documents controlled seed variation while preserving route identities and bounds", () => {
    const first = layoutFor(sourceBundle({ seed: 42 }));
    const second = layoutFor(sourceBundle({ seed: 43 }));
    expect(second.layoutBundleHash).not.toBe(first.layoutBundleHash);
    expect(second.layoutSpec.route.orderedObjectIds).toEqual(
      first.layoutSpec.route.orderedObjectIds,
    );
    expect(second.layoutSpec.stages.map((stage) => stage.ordinal)).toEqual(
      first.layoutSpec.stages.map((stage) => stage.ordinal),
    );
    expect(second.layoutSpec.worldBounds.maximum.x).toBeLessThanOrEqual(2048);
    expect(second.layoutSpec.worldBounds.maximum.z).toBeLessThanOrEqual(2048);
  });

  it("terminates at the 50-stage contract maximum inside all output budgets", () => {
    const source = sourceBundle({
      stageCount: 50,
      checkpointFrequency: 2,
      difficulty: "hard",
      seed: 9001,
    });
    const output = layoutFor(source);
    expect(output.layoutSpec.stages).toHaveLength(50);
    expect(output.layoutSpec.objects.length).toBeLessThanOrEqual(
      DEFAULT_LAYOUT_CONFIGURATION.limits.maxGameplayObjects,
    );
    expect(output.layoutSpec.decorativeZones.length).toBeLessThanOrEqual(
      DEFAULT_LAYOUT_CONFIGURATION.limits.maxDecorativeZones,
    );
    expect(
      new TextEncoder().encode(canonicalLayout(output)).byteLength,
    ).toBeLessThanOrEqual(DEFAULT_LAYOUT_CONFIGURATION.limits.maxOutputBytes);
  });

  it("returns typed deferred and unsupported mechanic failures", () => {
    const deferredConfigurationPreimage = {
      ...DEFAULT_GENERATOR_CONFIGURATION,
      configurationId: "g0-deferred-layout-test",
      allowDeferredMechanics: true,
    };
    const deferredConfiguration = {
      ...deferredConfigurationPreimage,
      configurationHash: hashGeneratorPreimage(
        deferredConfigurationPreimage,
        "configurationHash",
      ),
    };
    const deferredSource = generateObby(
      {
        ...BASE_LAYOUT_REQUEST,
        requestId: "g1b-deferred",
        supportedMechanicPreferences: ["moving-platform"],
        excludedMechanics: [],
      },
      deferredConfiguration,
      DEFAULT_MECHANIC_CATALOG,
    );
    expect(() =>
      generateLayout(
        deferredSource,
        deferredConfiguration,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_LAYOUT_CONFIGURATION,
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
      ),
    ).toThrow(expect.objectContaining({ code: "deferred-mechanic" }));

    const source = sourceBundle({
      supportedMechanicPreferences: ["static-jumps"],
    });
    const withoutStatic = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.filter(
      (definition) => definition.sourceMechanic.mechanicId !== "static-jumps",
    );
    expect(() =>
      generateLayout(
        source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_LAYOUT_CONFIGURATION,
        withoutStatic,
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-mechanic" }));
    expect(LayoutEngineError).toBeDefined();
  });
});
