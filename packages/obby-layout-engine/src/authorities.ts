import {
  DEFAULT_MECHANIC_CATALOG,
  snapshotPlainData,
} from "@obby/obby-generator";
import type {
  LayoutConfiguration,
  MechanicLayoutDefinition,
  NumericParameter,
} from "@obby/obby-layout-contracts";
import {
  hashLayoutConfiguration,
  hashMechanicLayoutDefinition,
} from "@obby/obby-layout-contracts";
import { createDefaultControllerProfile } from "@obby/route-playability-evaluator";

const numericParameter = (
  parameterId: string,
  unit: NumericParameter["unit"],
  minimum: number,
  maximum: number,
  value: number,
): NumericParameter => ({ parameterId, unit, minimum, maximum, value });

const controllerProfile = createDefaultControllerProfile();

export const LAYOUT_GLOBAL_PARAMETER_UNITS = Object.freeze({
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
} satisfies Readonly<Record<string, NumericParameter["unit"]>>);

export const MECHANIC_RECIPE_PARAMETER_UNITS = Object.freeze({
  "lateral-amplitude": "studs",
  "platform-length": "studs",
  "platform-thickness": "studs",
  "platform-width": "studs",
  "route-object-count": "count",
  "route-span-fraction": "ratio",
  "vertical-amplitude": "studs",
  "yaw-step-degrees": "degrees",
} satisfies Readonly<Record<string, NumericParameter["unit"]>>);

const configurationPreimage = {
  schemaVersion: "0.1" as const,
  configurationId: "g1b-layout-reference-v2",
  configurationVersion: "g1a-layout-contract-v1" as const,
  layoutAlgorithm: {
    algorithmId: "g1-layout-v1" as const,
    routePackingStrategy: "bounded-serpentine-grid-v1" as const,
    routePackingVersion: "1" as const,
    derivedIdStrategy: "source-ordinal-pascal-v1" as const,
  },
  numericPolicy: {
    units: "studs" as const,
    coordinatePrecisionDecimalPlaces: 6 as const,
    measurementToleranceStuds: 1e-9,
  },
  numericParameters: [
    numericParameter("character-root-offset", "studs", 2, 8, 3),
    numericParameter("decorative-zone-depth", "studs", 4, 32, 8),
    numericParameter("decorative-zone-height", "studs", 4, 64, 12),
    numericParameter("decorative-zone-offset", "studs", 4, 32, 8),
    numericParameter("decorative-zone-width", "studs", 4, 32, 8),
    numericParameter("fall-void-depth", "studs", 4, 128, 24),
    numericParameter("fall-void-margin", "studs", 0.25, 64, 1),
    numericParameter("hazard-size", "studs", 2, 32, 6),
    numericParameter("hazard-thickness", "studs", 0.5, 8, 1),
    numericParameter("packing-cell-depth", "studs", 16, 128, 24),
    numericParameter("packing-cell-width", "studs", 16, 128, 24),
    numericParameter("packing-columns", "count", 1, 16, 8),
    numericParameter("route-base-center-y", "studs", -16, 64, 1),
    numericParameter("spawn-size", "studs", 6, 32, 12),
    numericParameter("spawn-thickness", "studs", 1, 8, 2),
    numericParameter("world-bounds-padding", "studs", 0, 32, 2),
  ],
  reachabilityPolicy: {
    requiredTransitionOutcome: "feasible-under-model" as const,
    indeterminatePolicy: "block" as const,
    controllerProfileRef: {
      profileId: controllerProfile.profileId,
      profileVersion: controllerProfile.profileVersion,
      controllerProfileHash: controllerProfile.controllerProfileHash,
    },
  },
  limits: {
    maxStages: 50 as const,
    maxGameplayObjects: 501 as const,
    maxDecorativeZones: 128 as const,
    maxWorldExtent: 2048 as const,
    maxPartSize: 256 as const,
    maxOutputBytes: 4_194_304 as const,
    maxWorkUnits: 100_000,
  },
};

export const DEFAULT_LAYOUT_CONFIGURATION = snapshotPlainData(
  {
    ...configurationPreimage,
    configurationHash: hashLayoutConfiguration(configurationPreimage).hash,
  },
  "default layout configuration",
) as LayoutConfiguration;

export const DEFAULT_LAYOUT_CONTROLLER_PROFILE = snapshotPlainData(
  controllerProfile,
  "default layout controller profile",
) as ReturnType<typeof createDefaultControllerProfile>;

type RecipeValues = {
  count: number;
  length: number;
  width: number;
  thickness: number;
  lateral: number;
  vertical: number;
  yaw: number;
};

function recipeValues(mechanicId: string, level: number): RecipeValues {
  const scaled = Math.min(4, level);
  switch (mechanicId) {
    case "narrow-platforms":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "height-changes":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: scaled,
        yaw: 0,
      };
    case "turning-jumps":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "stepping-stones":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "balance-beam":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "hazard-avoidance":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "checkpoint-recovery":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    case "finish-approach":
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
    default:
      return {
        count: 3,
        length: 6,
        width: 6,
        thickness: 2,
        lateral: 0,
        vertical: 0,
        yaw: 0,
      };
  }
}

function profileParameters(
  mechanicId: string,
  level: number,
): NumericParameter[] {
  const values = recipeValues(mechanicId, level);
  return [
    numericParameter("lateral-amplitude", "studs", 0, 4, values.lateral),
    numericParameter("platform-length", "studs", 6, 14, values.length),
    numericParameter("platform-thickness", "studs", 1, 4, values.thickness),
    numericParameter("platform-width", "studs", 6, 14, values.width),
    numericParameter("route-object-count", "count", 1, 3, values.count),
    numericParameter("route-span-fraction", "ratio", 0.1, 0.4, 0.35),
    numericParameter("vertical-amplitude", "studs", 0, 4, values.vertical),
    numericParameter("yaw-step-degrees", "degrees", 0, 45, values.yaw),
  ];
}

const definitions = DEFAULT_MECHANIC_CATALOG.mechanics
  .filter((mechanic) => mechanic.capability === "g1-static-supported")
  .map((mechanic): MechanicLayoutDefinition => {
    const preimage = {
      schemaVersion: "0.1" as const,
      mechanicLayoutDefinitionId: `layout-${mechanic.mechanicId}-v2`,
      definitionVersion: "2.0.0",
      sourceMechanic: {
        mechanicId: mechanic.mechanicId,
        mechanicVersion: mechanic.mechanicVersion,
        mechanicDefinitionHash: mechanic.mechanicDefinitionHash,
      },
      capability: "g1-static-supported" as const,
      layoutAlgorithmId: "g1-layout-v1" as const,
      routeObjectBudget: {
        minimum: 3,
        maximum: 3,
      },
      supportedShapes: ["Block"] as ["Block"],
      difficultyProfiles: [1, 2, 3, 4, 5].map((difficultyLevel) => ({
        difficultyLevel,
        parameters: profileParameters(mechanic.mechanicId, difficultyLevel) as [
          NumericParameter,
          ...NumericParameter[],
        ],
      })) as MechanicLayoutDefinition["difficultyProfiles"],
    };
    return {
      ...preimage,
      mechanicLayoutDefinitionHash: hashMechanicLayoutDefinition(preimage).hash,
    };
  });

export const DEFAULT_MECHANIC_LAYOUT_DEFINITIONS = snapshotPlainData(
  definitions,
  "default mechanic layout definitions",
) as readonly MechanicLayoutDefinition[];
