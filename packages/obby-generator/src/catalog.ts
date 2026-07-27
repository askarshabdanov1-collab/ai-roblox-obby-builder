import { compareUnicodeScalars } from "@obby/canonical-json";
import { hashGeneratorPreimage } from "@obby/obby-generator-contracts";
import type {
  GeneratorConfiguration,
  MechanicCatalog,
  MechanicDefinition,
} from "@obby/obby-generator-contracts";

const LIMITS = {
  maxRequestBytes: 65_536,
  maxConfigurationBytes: 65_536,
  maxCatalogBytes: 524_288,
  maxStageCount: 50 as const,
  maxRouteNodes: 52,
  maxTransitions: 51,
  maxCheckpoints: 49,
  maxHazards: 50,
  maxMechanicDefinitions: 64,
  maxFindings: 64,
  maxLimitations: 64,
  maxAssetIntents: 128,
  maxOutputBytes: 4_194_304,
  maxOutputPathLength: 240,
  maxWorkUnits: 25_000,
} as const;

const configurationPreimage = {
  schemaVersion: "0.1" as const,
  configurationId: "g0-reference-default",
  generatorVersion: "g0-reference-v1" as const,
  prngAlgorithm: "mulberry32-v1" as const,
  allowDeferredMechanics: false,
  difficultyDeltaLimit: 2,
  limits: LIMITS,
};
export const DEFAULT_GENERATOR_CONFIGURATION: GeneratorConfiguration =
  Object.freeze({
    ...configurationPreimage,
    configurationHash: hashGeneratorPreimage(
      configurationPreimage,
      "configurationHash",
    ),
  });

type MechanicSeed = Omit<MechanicDefinition, "mechanicDefinitionHash">;
const seeds: MechanicSeed[] = [
  ["static-jumps", "Static jumps", "g1-static-supported", 1, 5, 3, 4],
  ["narrow-platforms", "Narrow platforms", "g1-static-supported", 2, 5, 2, 2],
  ["height-changes", "Height changes", "g1-static-supported", 1, 5, 3, 3],
  ["turning-jumps", "Turning jumps", "g1-static-supported", 2, 5, 2, 2],
  ["stepping-stones", "Stepping stones", "g1-static-supported", 1, 4, 3, 3],
  ["balance-beam", "Balance beam", "g1-static-supported", 2, 5, 2, 2],
  ["hazard-avoidance", "Hazard avoidance", "g1-static-supported", 1, 5, 3, 3],
  [
    "checkpoint-recovery",
    "Checkpoint recovery",
    "g1-static-supported",
    1,
    5,
    2,
    1,
  ],
  ["finish-approach", "Finish approach", "g1-static-supported", 1, 5, 1, 1],
  [
    "disappearing-platform",
    "Disappearing platform intent",
    "future-runtime-supported",
    2,
    5,
    1,
    1,
  ],
  ["moving-platform", "Moving platform intent", "deferred", 3, 5, 1, 1],
  ["spinner", "Spinner intent", "deferred", 3, 5, 1, 1],
  ["timed-door", "Timed door intent", "deferred", 3, 5, 1, 1],
].map(
  ([
    mechanicId,
    label,
    capability,
    minimumDifficulty,
    maximumDifficulty,
    repetitionLimit,
    selectionWeight,
  ]) => ({
    schemaVersion: "0.1",
    mechanicId: mechanicId as string,
    mechanicVersion: "1",
    label: label as string,
    capability: capability as MechanicDefinition["capability"],
    minimumDifficulty:
      minimumDifficulty as MechanicDefinition["minimumDifficulty"],
    maximumDifficulty:
      maximumDifficulty as MechanicDefinition["maximumDifficulty"],
    requiredCapabilities:
      capability === "g1-static-supported"
        ? ["native-parts"]
        : ["runtime-mechanic"],
    compatibleHazardKinds:
      capability === "g1-static-supported"
        ? ["fall-void", "kill-part"]
        : mechanicId === "moving-platform"
          ? ["moving-obstacle-intent"]
          : ["timed-contact-intent"],
    forbiddenAdjacentMechanicIds:
      mechanicId === "balance-beam" ? ["narrow-platforms"] : [],
    accessibilityImplications:
      mechanicId === "spinner" ? ["reduced-motion"] : [],
    repetitionLimit: repetitionLimit as number,
    selectionWeight: selectionWeight as number,
  }),
);

const mechanics = seeds
  .map((seed): MechanicDefinition => ({
    ...seed,
    mechanicDefinitionHash: hashGeneratorPreimage(
      seed,
      "mechanicDefinitionHash",
    ),
  }))
  .sort((left, right) =>
    compareUnicodeScalars(left.mechanicId, right.mechanicId),
  );
const catalogPreimage = {
  schemaVersion: "0.1" as const,
  catalogId: "g0-native-parts-mechanics",
  catalogVersion: "g0-v1" as const,
  mechanics,
};
export const DEFAULT_MECHANIC_CATALOG: MechanicCatalog = Object.freeze({
  ...catalogPreimage,
  catalogHash: hashGeneratorPreimage(catalogPreimage, "catalogHash"),
});
