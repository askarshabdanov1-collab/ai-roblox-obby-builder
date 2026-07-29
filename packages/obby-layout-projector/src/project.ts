import {
  canonicalizeEvaluatorSnapshot,
  snapshotEvaluatorInput,
} from "@obby/canonical-json";
import {
  assertValidPlaceSpecV03,
  computePlaceSpecV03Hash,
  type PlaceSpecV03,
} from "@obby/contracts";
import {
  assertValidGenerationBundle,
  type GenerationBundle,
  type GeneratorConfiguration,
  type MechanicCatalog,
} from "@obby/obby-generator-contracts";
import {
  assertValidLayoutBundle,
  type LayoutBundle,
  type LayoutConfiguration,
  type MechanicLayoutDefinition,
} from "@obby/obby-layout-contracts";
import { DEFAULT_LAYOUT_CONTROLLER_PROFILE } from "@obby/obby-layout-engine";

import {
  buildReachabilityEvidence,
  geometrySummary,
  normalizeLayoutGeometry,
} from "./reachability.js";
import {
  LayoutProjectionError,
  type ProjectLayoutOptions,
  type ProjectionWorkAdmission,
} from "./types.js";

const PALETTES = Object.freeze({
  "classic-high-contrast": ["#4CC9F0", "#4361EE", "#80ED99", "#FF4D6D"],
  "sky-high-contrast": ["#4CC9F0", "#4895EF", "#F9C74F", "#F94144"],
  "space-high-contrast": ["#7209B7", "#3A0CA3", "#4CC9F0", "#F72585"],
  "lava-high-contrast": ["#F77F00", "#FCBF49", "#90BE6D", "#D00000"],
  "jungle-high-contrast": ["#2A9D8F", "#588157", "#F4A261", "#E63946"],
} as const);

function safeSnapshot(input: unknown, label: string): unknown {
  try {
    return snapshotEvaluatorInput(input, {
      maxArrayLength: 4_096,
      maxCanonicalBytes: 4 * 1024 * 1024,
      maxDepth: 64,
      maxObjectProperties: 4_096,
      maxTotalNodes: 100_000,
    });
  } catch {
    throw new LayoutProjectionError(
      "input-snapshot",
      `${label} must be bounded immutable-compatible plain data`,
    );
  }
}

export function estimateProjectionWorkUnits(input: {
  stageCount: number;
  objectCount: number;
  routeCount: number;
  zoneCount: number;
  definitionCount: number;
}): number {
  return (
    16 +
    input.stageCount * 6 +
    input.objectCount * 8 +
    input.routeCount * 12 +
    input.zoneCount * 4 +
    input.definitionCount * 2
  );
}

function admitWork(
  layout: LayoutBundle,
  definitions: readonly MechanicLayoutDefinition[],
  maxWorkUnits: number,
): ProjectionWorkAdmission {
  const requiredWorkUnits = estimateProjectionWorkUnits({
    stageCount: layout.layoutSpec.stages.length,
    objectCount: layout.layoutSpec.objects.length,
    routeCount: layout.layoutSpec.route.orderedObjectIds.length,
    zoneCount: layout.layoutSpec.decorativeZones.length,
    definitionCount: definitions.length,
  });
  if (
    !Number.isSafeInteger(maxWorkUnits) ||
    maxWorkUnits < 0 ||
    requiredWorkUnits > maxWorkUnits
  )
    throw new LayoutProjectionError(
      "work-limit",
      "projection work exceeds the admitted deterministic work budget",
    );
  return Object.freeze({
    requiredWorkUnits,
    availableWorkUnits: maxWorkUnits,
    unusedWorkUnits: maxWorkUnits - requiredWorkUnits,
  });
}

function usedDefinitions(
  bundle: LayoutBundle,
  definitions: readonly MechanicLayoutDefinition[],
): readonly MechanicLayoutDefinition[] {
  const byHash = new Map(
    definitions.map((definition) => [
      definition.mechanicLayoutDefinitionHash,
      definition,
    ]),
  );
  return bundle.mechanicLayoutDefinitionRefs.map((reference) => {
    const definition = byHash.get(reference.mechanicLayoutDefinitionHash);
    if (
      definition?.mechanicLayoutDefinitionId !==
        reference.mechanicLayoutDefinitionId ||
      definition.definitionVersion !== reference.definitionVersion
    )
      throw new LayoutProjectionError(
        "stale-provenance",
        "LayoutBundle references an unavailable mechanic layout authority",
      );
    return definition;
  });
}

export function projectLayoutBundle(
  layoutBundleInput: unknown,
  sourceInput: unknown,
  generatorConfigurationInput: unknown,
  catalogInput: unknown,
  layoutConfigurationInput: unknown,
  definitionInputs: unknown,
  options: ProjectLayoutOptions = {},
): PlaceSpecV03 {
  const layoutBundleSnapshot = safeSnapshot(
    layoutBundleInput,
    "LayoutBundle",
  ) as { schemaVersion?: unknown; layoutSpec?: { layoutVersion?: unknown } };
  if (
    layoutBundleSnapshot.schemaVersion !== "0.1" ||
    layoutBundleSnapshot.layoutSpec?.layoutVersion !== "g1-layout-v1"
  )
    throw new LayoutProjectionError(
      "unsupported-version",
      "G1c supports only LayoutBundle 0.1 with g1-layout-v1",
    );
  const layoutBundle = layoutBundleSnapshot as LayoutBundle;
  const source = safeSnapshot(
    sourceInput,
    "GenerationBundle",
  ) as GenerationBundle;
  const generatorConfiguration = safeSnapshot(
    generatorConfigurationInput,
    "GeneratorConfiguration",
  ) as GeneratorConfiguration;
  const catalog = safeSnapshot(
    catalogInput,
    "MechanicCatalog",
  ) as MechanicCatalog;
  const layoutConfiguration = safeSnapshot(
    layoutConfigurationInput,
    "LayoutConfiguration",
  ) as LayoutConfiguration;
  const definitions = safeSnapshot(
    definitionInputs,
    "MechanicLayoutDefinition authorities",
  ) as readonly MechanicLayoutDefinition[];
  const admission = admitWork(
    layoutBundle,
    definitions,
    options.maxWorkUnits ?? layoutConfiguration.limits.maxWorkUnits,
  );
  try {
    options.onWorkAdmitted?.(admission);
  } catch {
    throw new LayoutProjectionError("invariant", "projection callback failed");
  }
  const referencedDefinitions = usedDefinitions(layoutBundle, definitions);
  try {
    assertValidGenerationBundle(source, catalog, generatorConfiguration);
    assertValidLayoutBundle(
      layoutBundle,
      source,
      generatorConfiguration,
      catalog,
      layoutConfiguration,
      referencedDefinitions,
    );
  } catch {
    throw new LayoutProjectionError(
      "stale-provenance",
      "G0 or G1 authority graph is invalid, stale, or not reference-closed",
    );
  }
  if (
    layoutBundle.sourceGenerationBundleHash !== source.generationBundleHash ||
    layoutBundle.layoutSpec.source.generationBundleHash !==
      source.generationBundleHash ||
    layoutBundle.layoutSpec.layoutConfigurationHash !==
      layoutConfiguration.configurationHash
  )
    throw new LayoutProjectionError(
      "stale-provenance",
      "LayoutBundle provenance does not match the supplied authorities",
    );

  const layout = layoutBundle.layoutSpec;
  const geometryById = normalizeLayoutGeometry(layout);
  const visual = source.obbySpec.visualStyleIntents[0];
  if (visual === undefined)
    throw new LayoutProjectionError(
      "invalid-reference",
      "ObbySpec has no visual style intent",
    );
  const palette = PALETTES[visual.paletteIntent];
  const difficultyById = new Map(
    source.obbySpec.difficultyPlan.bands.map((band) => [
      band.difficultyBandId,
      band.intentLevel,
    ]),
  );
  const sourceStageById = new Map(
    source.obbySpec.stages.map((stage) => [stage.stageId, stage]),
  );
  const objects = layout.objects.map((object, order) => {
    const geometry = geometryById.get(object.objectId);
    if (geometry === undefined)
      throw new LayoutProjectionError(
        "invariant",
        `normalized geometry is missing for object ${object.objectId}`,
      );
    const colorRole =
      object.role === "kill"
        ? "hazard"
        : object.role === "checkpoint" || object.role === "finish"
          ? "reward"
          : order % 2 === 0
            ? "primary"
            : "secondary";
    const colorIndex = { primary: 0, secondary: 1, reward: 2, hazard: 3 }[
      colorRole
    ];
    return {
      id: object.objectId,
      order,
      sourceReferences: object.sourceReferences,
      role: object.role,
      authority: object.authority,
      shape: object.shape,
      transform: {
        position: object.transform.position,
        rotation: object.transform.rotationDegrees,
      },
      size: object.size,
      collision: object.collision,
      appearance: {
        color: palette[colorIndex],
        colorRole,
        material:
          object.role === "kill"
            ? ("Neon" as const)
            : ("SmoothPlastic" as const),
      },
      geometry: geometrySummary(geometry),
    };
  }) as PlaceSpecV03["objects"];
  const stages = layout.stages.map((stage) => {
    const sourceStage = sourceStageById.get(stage.sourceStageId);
    const difficulty =
      sourceStage === undefined
        ? undefined
        : difficultyById.get(sourceStage.difficultyBandId);
    if (sourceStage === undefined || difficulty === undefined)
      throw new LayoutProjectionError(
        "invalid-reference",
        `stage ${stage.stageLayoutId} has stale G0 references`,
      );
    return {
      stageId: stage.stageLayoutId,
      sourceStageId: stage.sourceStageId,
      sourceRouteNodeId: stage.sourceRouteNodeId,
      sourceMechanicIntentId: stage.sourceMechanicIntentId,
      mechanicLayoutDefinitionHash: stage.mechanicLayoutDefinitionHash,
      order: stage.ordinal,
      difficulty,
      routeObjectIds: stage.routeObjectIds,
      ...(stage.checkpointObjectId === undefined
        ? {}
        : { checkpointObjectId: stage.checkpointObjectId }),
      hazardObjectIds: stage.hazardObjectIds,
      decorativeZoneIds: stage.decorativeZoneIds,
    };
  }) as PlaceSpecV03["stages"];
  const checkpointObjectIds = objects
    .filter((object) => object.role === "checkpoint")
    .map((object) => object.id);
  const reachability = buildReachabilityEvidence(
    layout,
    geometryById,
    DEFAULT_LAYOUT_CONTROLLER_PROFILE,
  );
  const preimage: Omit<PlaceSpecV03, "placeSpecHash"> = {
    schemaVersion: "0.3",
    projectionVersion: "g1c-layout-projection-v1",
    specId: `place-spec-${layout.layoutSpecHash.slice(7, 23)}`,
    name: source.obbySpec.game.title,
    genre: "obby",
    seed: source.obbySpec.seed,
    seedIdentity: source.obbySpec.seedIdentity,
    provenance: {
      generationBundleHash: source.generationBundleHash,
      obbySpecId: source.obbySpec.obbySpecId,
      obbySpecHash: source.obbySpec.obbySpecHash,
      generatorConfigurationHash: source.configurationHash,
      mechanicCatalogHash: source.catalogHash,
      layoutBundleHash: layoutBundle.layoutBundleHash,
      layoutSpecId: layout.layoutSpecId,
      layoutSpecHash: layout.layoutSpecHash,
      layoutConfigurationHash: layout.layoutConfigurationHash,
      mechanicLayoutDefinitionHashes: layout.mechanicLayoutDefinitionHashes,
    },
    coordinateSystem: layout.coordinateSystem,
    worldBounds: layout.worldBounds,
    characterPlacement: layout.characterPlacement,
    appearancePolicy: {
      policyId: "g1c-native-high-contrast-v1",
      sourceVisualStyleIntentId: visual.visualStyleIntentId,
      paletteIntent: visual.paletteIntent,
      primaryColor: palette[0],
      secondaryColor: palette[1],
      rewardColor: palette[2],
      hazardColor: palette[3],
      material: "SmoothPlastic",
      hazardMaterial: "Neon",
    },
    stages,
    route: {
      routeId: layout.route.routeLayoutId,
      sourceRouteId: layout.route.sourceRouteId,
      orderedObjectIds: layout.route.orderedObjectIds,
    },
    reachability,
    objects,
    decorativeZones: layout.decorativeZones.map((zone) => ({
      ...zone,
    })) as PlaceSpecV03["decorativeZones"],
    checkpointPlan: { mode: "ordered", checkpointObjectIds },
    finishCriteria: { type: "touch-finish", finishObjectId: "Finish" },
    budgets: {
      maxStages: 50,
      maxGameplayObjects: 501,
      maxDecorativeZones: 128,
      maxWorldExtent: 2048,
      maxPartSize: 256,
      maxOutputBytes: 4_194_304,
    },
    limitations: layout.limitations.map((entry) => ({
      code: entry.code,
      severity: "warning" as const,
      message: entry.message,
      relatedSourceIds: entry.relatedSourceIds,
    })),
    findings: layout.findings.map((entry) => ({
      code: entry.code,
      severity: entry.severity,
      message: entry.message,
      relatedSourceIds: entry.relatedSourceIds,
    })),
  };
  const placeSpec: PlaceSpecV03 = {
    ...preimage,
    placeSpecHash: computePlaceSpecV03Hash(preimage),
  };
  const bytes = canonicalizeEvaluatorSnapshot(
    snapshotEvaluatorInput(placeSpec),
  ).canonicalBytes;
  if (bytes.byteLength > placeSpec.budgets.maxOutputBytes)
    throw new LayoutProjectionError(
      "output-limit",
      "PlaceSpec 0.3 exceeds its deterministic byte budget",
    );
  try {
    return assertValidPlaceSpecV03(placeSpec);
  } catch {
    throw new LayoutProjectionError(
      "invariant",
      "projected PlaceSpec 0.3 failed authoritative validation",
    );
  }
}
