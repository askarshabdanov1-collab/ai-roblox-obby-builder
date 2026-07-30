import {
  DEFAULT_MECHANIC_CATALOG,
  type MechanicDefinition,
} from "@obby/obby-generator";
import {
  assertValidLayoutConfiguration,
  assertValidMechanicLayoutDefinition,
  hashLayoutConfiguration,
} from "@obby/obby-layout-contracts";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  NATIVE_PART_RECIPE_REGISTRY,
  expandNativePartRecipe,
} from "../src/index.js";

const staticMechanics = DEFAULT_MECHANIC_CATALOG.mechanics.filter(
  (mechanic) => mechanic.capability === "g1-static-supported",
);

const globalParameterUnits = {
  "character-root-offset": "studs",
  "decorative-zone-depth": "studs",
  "decorative-zone-height": "studs",
  "decorative-zone-offset": "studs",
  "decorative-zone-width": "studs",
  "fall-void-depth": "studs",
  "fall-void-margin": "studs",
  "hazard-size": "studs",
  "hazard-thickness": "studs",
  "packing-cell-depth": "studs",
  "packing-cell-width": "studs",
  "packing-columns": "count",
  "route-base-center-y": "studs",
  "spawn-size": "studs",
  "spawn-thickness": "studs",
  "world-bounds-padding": "studs",
} as const;

const recipeParameterUnits = {
  "lateral-amplitude": "studs",
  "platform-length": "studs",
  "platform-thickness": "studs",
  "platform-width": "studs",
  "route-object-count": "count",
  "route-span-fraction": "ratio",
  "vertical-amplitude": "studs",
  "yaw-step-degrees": "degrees",
} as const;

describe("G1b versioned recipe authorities", () => {
  it("publishes a valid content-addressed default LayoutConfiguration", () => {
    expect(() =>
      assertValidLayoutConfiguration(DEFAULT_LAYOUT_CONFIGURATION),
    ).not.toThrow();
    expect(DEFAULT_LAYOUT_CONFIGURATION.limits.maxStages).toBe(50);
    expect(
      Object.fromEntries(
        DEFAULT_LAYOUT_CONFIGURATION.numericParameters.map((parameter) => [
          parameter.parameterId,
          parameter.unit,
        ]),
      ),
    ).toEqual(globalParameterUnits);
  });

  it("has exactly one versioned native-Part recipe for every static mechanic", () => {
    expect(Object.keys(NATIVE_PART_RECIPE_REGISTRY).sort()).toEqual(
      staticMechanics.map((mechanic) => mechanic.mechanicId).sort(),
    );
    expect(
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.map(
        (definition) => definition.sourceMechanic.mechanicId,
      ).sort(),
    ).toEqual(staticMechanics.map((mechanic) => mechanic.mechanicId).sort());
    for (const mechanic of staticMechanics) {
      const recipe = NATIVE_PART_RECIPE_REGISTRY[mechanic.mechanicId];
      expect(recipe).toMatchObject({
        recipeVersion: "2.0.0",
        gameplayAuthority: "native-gameplay",
        primitiveFamily: "native-parts",
      });
    }
  });

  it.each(staticMechanics)(
    "binds $mechanicId to its exact G0 mechanic authority",
    (mechanic: MechanicDefinition) => {
      const definition = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.find(
        (candidate) =>
          candidate.sourceMechanic.mechanicId === mechanic.mechanicId,
      );
      expect(definition).toBeDefined();
      expect(() =>
        assertValidMechanicLayoutDefinition(definition),
      ).not.toThrow();
      expect(definition?.sourceMechanic).toEqual({
        mechanicId: mechanic.mechanicId,
        mechanicVersion: mechanic.mechanicVersion,
        mechanicDefinitionHash: mechanic.mechanicDefinitionHash,
      });
      expect(definition?.difficultyProfiles).toHaveLength(5);
      expect(
        definition?.difficultyProfiles.every((profile) =>
          profile.parameters.some(
            (parameter) => parameter.parameterId === "route-object-count",
          ),
        ),
      ).toBe(true);
      for (const profile of definition?.difficultyProfiles ?? [])
        expect(
          Object.fromEntries(
            profile.parameters.map((parameter) => [
              parameter.parameterId,
              parameter.unit,
            ]),
          ),
        ).toEqual(recipeParameterUnits);
    },
  );

  it("rejects a fresh-hash authority with an unsupported global parameter unit", async () => {
    const { generateLayout } = await import("../src/index.js");
    const { generateObby } = await import("@obby/obby-generator");
    const configuration = structuredClone(DEFAULT_LAYOUT_CONFIGURATION);
    const parameter = configuration.numericParameters.find(
      (candidate) => candidate.parameterId === "hazard-size",
    );
    if (parameter === undefined) throw new Error("hazard-size is missing");
    parameter.unit = "ratio";
    configuration.configurationHash =
      hashLayoutConfiguration(configuration).hash;
    expect(() =>
      generateLayout(
        generateObby({
          schemaVersion: "0.1",
          requestId: "unsupported-authority-test",
          workingName: "Unsupported authority test",
          genre: "obby",
          seed: 1,
        }),
        undefined,
        undefined,
        configuration,
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-authority" }));
  });

  it.each(staticMechanics)(
    "expands the $mechanicId recipe from its versioned definition",
    (mechanic: MechanicDefinition) => {
      const definition = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.find(
        (candidate) =>
          candidate.sourceMechanic.mechanicId === mechanic.mechanicId,
      );
      expect(definition).toBeDefined();
      if (definition === undefined)
        throw new Error(`missing ${mechanic.mechanicId} definition`);
      const objects = expandNativePartRecipe({
        mechanicId: mechanic.mechanicId,
        definition,
        difficultyLevel: 3,
        cell: { x: 16, z: 0 },
        incoming: { x: 1, z: 0 },
        outgoing: { x: 1, z: 0 },
        cellWidth: 16,
        cellDepth: 16,
        baseCenterY: 1,
        seed: 42,
        precisionDecimalPlaces: 6,
      });
      expect(objects).toHaveLength(3);
      expect(objects.every((object) => object.shape === "Block")).toBe(true);
    },
  );
});
