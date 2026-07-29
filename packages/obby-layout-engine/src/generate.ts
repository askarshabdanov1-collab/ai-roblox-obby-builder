import {
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  normalizeNumber,
  snapshotEvaluatorInput,
} from "@obby/canonical-json";
import { normalizeGeometryObject } from "@obby/geometry-evaluator";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  DeterministicRandom,
  snapshotPlainData,
} from "@obby/obby-generator";
import {
  assertValidGenerationBundle,
  type GenerationBundle,
  type GeneratorConfiguration,
  type MechanicCatalog,
} from "@obby/obby-generator-contracts";
import {
  assertValidLayoutBundle,
  assertValidLayoutConfiguration,
  assertValidMechanicLayoutDefinition,
  hashLayoutBundle,
  hashLayoutSpec,
  type DecorativeZone,
  type LayoutBundle,
  type LayoutConfiguration,
  type LayoutObject,
  type LayoutSpec,
  type LayoutStage,
  type MechanicLayoutDefinition,
  type NumericParameter,
  type Vector3,
} from "@obby/obby-layout-contracts";

import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_LAYOUT_CONTROLLER_PROFILE,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  LAYOUT_GLOBAL_PARAMETER_UNITS,
  MECHANIC_RECIPE_PARAMETER_UNITS,
} from "./authorities.js";
import {
  directionBetween,
  packSerpentineCell,
  type HorizontalDirection,
} from "./packing.js";
import {
  NATIVE_PART_RECIPE_REGISTRY,
  expandNativePartRecipe,
} from "./recipes.js";
import { assessRequiredRoute } from "./reachability.js";
import { deriveLayoutDomainSeed } from "./seed.js";
import {
  LayoutEngineError,
  type GenerateLayoutOptions,
  type LayoutCoveredOperation,
  type LayoutPhase,
} from "./types.js";
import { admitLayoutSnapshot } from "./work-admission.js";

const rounded = (value: number, precisionDecimalPlaces: number): number =>
  normalizeNumber(value, precisionDecimalPlaces);

function invokeCallback<T>(
  callback: ((value: T) => void) | undefined,
  value: T,
): void {
  if (callback === undefined) return;
  try {
    callback(value);
  } catch {
    throw new LayoutEngineError(
      "callback-failed",
      "layout generation callback failed",
    );
  }
}

function operation(
  options: GenerateLayoutOptions,
  value: LayoutCoveredOperation,
): void {
  invokeCallback(options.onCoveredOperation, value);
}

function numeric(
  configuration: LayoutConfiguration,
  parameterId: string,
): number {
  const parameter = configuration.numericParameters.find(
    (candidate) => candidate.parameterId === parameterId,
  );
  if (parameter === undefined)
    throw new LayoutEngineError(
      "unsupported-authority",
      `LayoutConfiguration lacks ${parameterId}`,
    );
  return parameter.value;
}

function exactControllerAuthority(configuration: LayoutConfiguration): void {
  const expected = DEFAULT_LAYOUT_CONTROLLER_PROFILE;
  const actual = configuration.reachabilityPolicy.controllerProfileRef;
  if (
    actual.profileId !== expected.profileId ||
    actual.profileVersion !== expected.profileVersion ||
    actual.controllerProfileHash !== expected.controllerProfileHash
  )
    throw new LayoutEngineError(
      "unsupported-authority",
      "the G1b reference engine supports only its exact default controller profile",
    );
}

function exactParameterAuthority(
  parameters: readonly NumericParameter[],
  expectedUnits: Readonly<Record<string, NumericParameter["unit"]>>,
  label: string,
  code: "unsupported-authority" | "unsupported-mechanic",
): void {
  const expectedEntries = Object.entries(expectedUnits);
  if (
    parameters.length !== expectedEntries.length ||
    expectedEntries.some(
      ([parameterId, unit]) =>
        parameters.find((parameter) => parameter.parameterId === parameterId)
          ?.unit !== unit,
    )
  )
    throw new LayoutEngineError(
      code,
      `${label} does not provide the exact supported numeric parameter authority`,
    );
}

function exactNumericAuthorities(
  configuration: LayoutConfiguration,
  definitions: readonly MechanicLayoutDefinition[],
): void {
  exactParameterAuthority(
    configuration.numericParameters,
    LAYOUT_GLOBAL_PARAMETER_UNITS,
    configuration.configurationId,
    "unsupported-authority",
  );
  for (const definition of definitions) {
    if (
      definition.supportedShapes.length !== 1 ||
      definition.supportedShapes[0] !== "Block"
    )
      throw new LayoutEngineError(
        "unsupported-mechanic",
        `${definition.mechanicLayoutDefinitionId} does not use the G1b native Block authority`,
      );
    for (const profile of definition.difficultyProfiles)
      exactParameterAuthority(
        profile.parameters,
        MECHANIC_RECIPE_PARAMETER_UNITS,
        `${definition.mechanicLayoutDefinitionId} difficulty ${profile.difficultyLevel}`,
        "unsupported-mechanic",
      );
  }
}

function safeGenerationAuthority(
  source: GenerationBundle,
  catalog: MechanicCatalog,
  configuration: GeneratorConfiguration,
): void {
  try {
    assertValidGenerationBundle(source, catalog, configuration);
  } catch {
    throw new LayoutEngineError(
      "stale-authority",
      "GenerationBundle is invalid under the supplied G0 authorities",
    );
  }
}

function safeLayoutAuthorities(
  configurationInput: LayoutConfiguration,
  definitions: readonly MechanicLayoutDefinition[],
): Readonly<{
  configuration: LayoutConfiguration;
  definitions: readonly MechanicLayoutDefinition[];
}> {
  try {
    const validatedDefinitions = definitions.map((definition) =>
      assertValidMechanicLayoutDefinition(definition),
    );
    const uniqueDefinitionIds = new Set(
      validatedDefinitions.map(
        (definition) => definition.mechanicLayoutDefinitionId,
      ),
    );
    const uniqueMechanicIds = new Set(
      validatedDefinitions.map(
        (definition) => definition.sourceMechanic.mechanicId,
      ),
    );
    if (
      uniqueDefinitionIds.size !== validatedDefinitions.length ||
      uniqueMechanicIds.size !== validatedDefinitions.length
    )
      throw new Error("duplicate layout definition authority");
    return {
      configuration: assertValidLayoutConfiguration(configurationInput),
      definitions: validatedDefinitions,
    };
  } catch {
    throw new LayoutEngineError(
      "stale-authority",
      "layout configuration or mechanic definition authority is invalid or stale",
    );
  }
}

function usedDefinitions(
  source: GenerationBundle,
  catalog: MechanicCatalog,
  definitions: readonly MechanicLayoutDefinition[],
): readonly MechanicLayoutDefinition[] {
  const catalogById = new Map(
    catalog.mechanics.map((mechanic) => [mechanic.mechanicId, mechanic]),
  );
  const definitionsByMechanic = new Map(
    definitions.map((definition) => [
      definition.sourceMechanic.mechanicId,
      definition,
    ]),
  );
  const usedIds = [
    ...new Set(
      source.obbySpec.mechanicIntents.map((intent) => intent.mechanicId),
    ),
  ].sort(compareUnicodeScalars);
  return usedIds.map((mechanicId) => {
    const mechanic = catalogById.get(mechanicId);
    if (mechanic?.capability !== "g1-static-supported")
      throw new LayoutEngineError(
        "deferred-mechanic",
        `${mechanicId} is not a G1 static native-Part mechanic`,
      );
    const definition = definitionsByMechanic.get(mechanicId);
    const recipe = NATIVE_PART_RECIPE_REGISTRY[mechanicId];
    if (
      definition === undefined ||
      recipe === undefined ||
      definition.sourceMechanic.mechanicDefinitionHash !==
        mechanic.mechanicDefinitionHash ||
      definition.definitionVersion !== recipe.recipeVersion
    )
      throw new LayoutEngineError(
        "unsupported-mechanic",
        `${mechanicId} lacks an exact supported G1b recipe authority`,
      );
    return definition;
  });
}

function nativeObject(
  value: Omit<LayoutObject, "authority" | "collision"> & {
    canCollide: boolean;
    canTouch: boolean;
  },
): LayoutObject {
  const { canCollide, canTouch, ...object } = value;
  return {
    ...object,
    authority: "native-gameplay",
    collision: {
      anchored: true,
      canCollide,
      canTouch,
      canQuery: true,
    },
  };
}

function yaw(
  direction: HorizontalDirection,
  precisionDecimalPlaces: number,
): number {
  return rounded(
    (Math.atan2(-direction.x, -direction.z) * 180) / Math.PI,
    precisionDecimalPlaces,
  );
}

function bounds(
  objects: readonly LayoutObject[],
  zones: readonly DecorativeZone[],
  padding: number,
  maximumExtent: number,
  precisionDecimalPlaces: number,
): LayoutSpec["worldBounds"] {
  const objectBounds = objects.map(
    (object) =>
      normalizeGeometryObject({
        schemaVersion: "0.1",
        objectId: object.objectId,
        shape: object.shape,
        authority: object.authority,
        collision: {
          canCollide: object.collision.canCollide,
          canTouch: object.collision.canTouch,
          canQuery: object.collision.canQuery,
        },
        gameplayOwnership: "native-part",
        promotionStatus: "not-applicable",
        transform: object.transform,
        size: object.size,
      }).axisAlignedBounds,
  );
  const minimum: Vector3 = {
    x: rounded(
      Math.min(
        ...objectBounds.map((item) => item.minimum.x),
        ...zones.map((zone) => zone.bounds.minimum.x),
      ) - padding,
      precisionDecimalPlaces,
    ),
    y: rounded(
      Math.min(
        ...objectBounds.map((item) => item.minimum.y),
        ...zones.map((zone) => zone.bounds.minimum.y),
      ) - padding,
      precisionDecimalPlaces,
    ),
    z: rounded(
      Math.min(
        ...objectBounds.map((item) => item.minimum.z),
        ...zones.map((zone) => zone.bounds.minimum.z),
      ) - padding,
      precisionDecimalPlaces,
    ),
  };
  const maximum: Vector3 = {
    x: rounded(
      Math.max(
        ...objectBounds.map((item) => item.maximum.x),
        ...zones.map((zone) => zone.bounds.maximum.x),
      ) + padding,
      precisionDecimalPlaces,
    ),
    y: rounded(
      Math.max(
        ...objectBounds.map((item) => item.maximum.y),
        ...zones.map((zone) => zone.bounds.maximum.y),
      ) + padding,
      precisionDecimalPlaces,
    ),
    z: rounded(
      Math.max(
        ...objectBounds.map((item) => item.maximum.z),
        ...zones.map((zone) => zone.bounds.maximum.z),
      ) + padding,
      precisionDecimalPlaces,
    ),
  };
  for (const axis of ["x", "y", "z"] as const)
    if (minimum[axis] < -maximumExtent || maximum[axis] > maximumExtent)
      throw new LayoutEngineError(
        "packing-limit",
        `layout exceeds configured world extent on ${axis}`,
      );
  return { minimum, maximum };
}

export function generateLayout(
  sourceInput: unknown,
  generatorConfigurationInput: unknown = DEFAULT_GENERATOR_CONFIGURATION,
  catalogInput: unknown = DEFAULT_MECHANIC_CATALOG,
  layoutConfigurationInput: unknown = DEFAULT_LAYOUT_CONFIGURATION,
  definitionInputs: unknown = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  options: GenerateLayoutOptions = {},
): LayoutBundle {
  const phases: LayoutPhase[] = ["safe-shape-check"];
  const source = snapshotPlainData(
    sourceInput,
    "GenerationBundle",
  ) as GenerationBundle;
  const generatorConfiguration = snapshotPlainData(
    generatorConfigurationInput,
    "GeneratorConfiguration",
  ) as GeneratorConfiguration;
  const catalog = snapshotPlainData(
    catalogInput,
    "MechanicCatalog",
  ) as MechanicCatalog;
  const layoutConfiguration = snapshotPlainData(
    layoutConfigurationInput,
    "LayoutConfiguration",
  ) as LayoutConfiguration;
  const definitions = snapshotPlainData(
    definitionInputs,
    "MechanicLayoutDefinition authorities",
  ) as readonly MechanicLayoutDefinition[];
  phases.push("snapshot-complete");
  const admission = admitLayoutSnapshot(
    source,
    layoutConfiguration,
    definitions,
  );
  phases.push("work-admission", "callbacks");
  invokeCallback(options.onWorkAdmitted, admission);
  operation(options, "input-snapshot");
  operation(options, "work-admission");
  phases.push("semantic-validation");
  operation(options, "authority-validation");
  safeGenerationAuthority(source, catalog, generatorConfiguration);
  const { configuration, definitions: validatedDefinitions } =
    safeLayoutAuthorities(layoutConfiguration, definitions);
  exactControllerAuthority(configuration);
  exactNumericAuthorities(configuration, validatedDefinitions);
  const used = usedDefinitions(source, catalog, validatedDefinitions);
  const definitionByMechanic = new Map(
    used.map((definition) => [
      definition.sourceMechanic.mechanicId,
      definition,
    ]),
  );
  const definitionHashes = used.map(
    (definition) => definition.mechanicLayoutDefinitionHash,
  );
  phases.push("layout-generation");
  operation(options, "seed-derivation");
  const precisionDecimalPlaces =
    configuration.numericPolicy.coordinatePrecisionDecimalPlaces;

  const cellWidth = numeric(configuration, "packing-cell-width");
  const cellDepth = numeric(configuration, "packing-cell-depth");
  const columns = numeric(configuration, "packing-columns");
  if (!Number.isSafeInteger(columns))
    throw new LayoutEngineError(
      "unsupported-authority",
      "packing-columns must be a safe integer",
    );
  operation(options, "route-packing");
  const cells = Array.from(
    { length: source.obbySpec.stages.length + 1 },
    (_, index) =>
      packSerpentineCell(
        index,
        columns,
        cellWidth,
        cellDepth,
        precisionDecimalPlaces,
      ),
  );
  const firstCell = cells[0];
  if (firstCell === undefined)
    throw new LayoutEngineError("invariant", "first layout cell is missing");
  const spawnCenter = {
    x: rounded(firstCell.x - cellWidth, precisionDecimalPlaces),
    z: firstCell.z,
  };
  const spawnDirection = directionBetween(spawnCenter, firstCell);
  const routeBaseCenterY = numeric(configuration, "route-base-center-y");
  const spawnSize = numeric(configuration, "spawn-size");
  const spawnThickness = numeric(configuration, "spawn-thickness");
  const routeAssets = source.obbySpec.assetIntents
    .filter((asset) => asset.semanticRole === "gameplay-route")
    .map((asset) => asset.assetIntentId);
  const objects: LayoutObject[] = [
    nativeObject({
      objectId: "Spawn",
      sourceReferences: { sourceAssetIntentIds: routeAssets },
      role: "spawn",
      shape: "Block",
      transform: {
        position: {
          x: spawnCenter.x,
          y: routeBaseCenterY,
          z: spawnCenter.z,
        },
        rotationDegrees: {
          x: 0,
          y: yaw(spawnDirection, precisionDecimalPlaces),
          z: 0,
        },
      },
      size: { x: spawnSize, y: spawnThickness, z: spawnSize },
      canCollide: true,
      canTouch: false,
    }),
  ];
  const intentById = new Map(
    source.obbySpec.mechanicIntents.map((intent) => [
      intent.mechanicIntentId,
      intent,
    ]),
  );
  const nodeByStage = new Map(
    source.obbySpec.route.orderedNodeIds.flatMap((nodeId) => {
      const node = source.obbySpec.route.nodes.find(
        (candidate) => candidate.routeNodeId === nodeId,
      );
      return node?.stageId === undefined ? [] : [[node.stageId, node] as const];
    }),
  );
  const difficultyById = new Map(
    source.obbySpec.difficultyPlan.bands.map((band) => [
      band.difficultyBandId,
      band,
    ]),
  );
  const checkpointByStage = new Map(
    source.obbySpec.checkpoints.map((checkpoint, index) => [
      checkpoint.stageId,
      { checkpoint, ordinal: index + 1 },
    ]),
  );
  const hazardsByStage = new Map<string, typeof source.obbySpec.hazards>();
  for (const hazard of source.obbySpec.hazards) {
    const existing = hazardsByStage.get(hazard.stageId) ?? [];
    hazardsByStage.set(hazard.stageId, [...existing, hazard]);
  }
  const decorationAssets = new Set(
    source.obbySpec.assetIntents
      .filter((asset) => asset.semanticRole === "decoration")
      .map((asset) => asset.assetIntentId),
  );
  const stages: LayoutStage[] = [];
  const zones: DecorativeZone[] = [];
  let globalRouteOrder = 0;
  operation(options, "recipe-expansion");
  for (const [stageIndex, sourceStage] of source.obbySpec.stages.entries()) {
    const cell = cells[stageIndex];
    const nextCell = cells[stageIndex + 1];
    const previousCenter =
      stageIndex === 0 ? spawnCenter : cells[stageIndex - 1];
    if (
      cell === undefined ||
      nextCell === undefined ||
      previousCenter === undefined
    )
      throw new LayoutEngineError(
        "packing-limit",
        `serpentine neighbors are missing for stage ${stageIndex + 1}`,
      );
    const incoming = directionBetween(previousCenter, cell);
    const outgoing = directionBetween(cell, nextCell);
    const intentId = sourceStage.mechanicIntentIds[0];
    const intent = intentById.get(intentId);
    const definition =
      intent === undefined
        ? undefined
        : definitionByMechanic.get(intent.mechanicId);
    const difficulty = difficultyById.get(sourceStage.difficultyBandId);
    const routeNode = nodeByStage.get(sourceStage.stageId);
    if (
      intent === undefined ||
      definition === undefined ||
      difficulty === undefined ||
      routeNode === undefined
    )
      throw new LayoutEngineError(
        "invariant",
        `source authorities are incomplete for ${sourceStage.stageId}`,
      );
    const recipeSeed = deriveLayoutDomainSeed(
      source.obbySpec.seedIdentity,
      configuration.configurationHash,
      definitionHashes,
      `stage:${String(sourceStage.ordinal).padStart(2, "0")}:${definition.mechanicLayoutDefinitionId}:recipe`,
    );
    const recipeObjects = expandNativePartRecipe({
      mechanicId: intent.mechanicId,
      definition,
      difficultyLevel: difficulty.intentLevel,
      cell,
      incoming,
      outgoing,
      cellWidth,
      cellDepth,
      baseCenterY: routeBaseCenterY,
      seed: recipeSeed,
      precisionDecimalPlaces,
    });
    const checkpointEntry = checkpointByStage.get(sourceStage.stageId);
    const routeObjectIds: string[] = [];
    for (const [objectIndex, recipeObject] of recipeObjects.entries()) {
      const isCheckpoint =
        checkpointEntry !== undefined &&
        objectIndex === recipeObjects.length - 1;
      const objectId = isCheckpoint
        ? `Checkpoint${String(checkpointEntry.ordinal).padStart(3, "0")}`
        : `Stage${String(sourceStage.ordinal).padStart(2, "0")}Route${String(objectIndex + 1).padStart(3, "0")}`;
      globalRouteOrder += 1;
      routeObjectIds.push(objectId);
      objects.push(
        nativeObject({
          objectId,
          sourceReferences: {
            sourceStageId: sourceStage.stageId,
            sourceMechanicIntentId: intent.mechanicIntentId,
            ...(isCheckpoint
              ? { sourceCheckpointId: checkpointEntry.checkpoint.checkpointId }
              : {}),
            sourceAssetIntentIds: sourceStage.assetIntentIds,
          },
          role: isCheckpoint ? "checkpoint" : "platform",
          ...recipeObject,
          routePlacement: {
            globalOrder: globalRouteOrder,
            stageOrder: objectIndex + 1,
          },
          canCollide: true,
          canTouch: isCheckpoint,
        }),
      );
    }

    const stageHazardIds: string[] = [];
    for (const [hazardIndex, hazard] of (
      hazardsByStage.get(sourceStage.stageId) ?? []
    ).entries()) {
      const objectId = `Stage${String(sourceStage.ordinal).padStart(2, "0")}Hazard${String(hazardIndex + 1).padStart(3, "0")}`;
      const seed = deriveLayoutDomainSeed(
        source.obbySpec.seedIdentity,
        configuration.configurationHash,
        definitionHashes,
        `stage:${String(sourceStage.ordinal).padStart(2, "0")}:hazard:${hazardIndex + 1}`,
      );
      const side = new DeterministicRandom(seed).integer(0, 1) === 0 ? -1 : 1;
      const perpendicular = { x: -outgoing.z, z: outgoing.x };
      const thickness = numeric(configuration, "hazard-thickness");
      const hazardSize = numeric(configuration, "hazard-size");
      const fallDepth = numeric(configuration, "fall-void-depth");
      const fallMargin = numeric(configuration, "fall-void-margin");
      const fallVoid = hazard.kind === "fall-void";
      objects.push(
        nativeObject({
          objectId,
          sourceReferences: {
            sourceStageId: sourceStage.stageId,
            sourceMechanicIntentId: intent.mechanicIntentId,
            sourceHazardId: hazard.hazardId,
            sourceAssetIntentIds: sourceStage.assetIntentIds,
          },
          role: "kill",
          shape: "Block",
          transform: {
            position: {
              x: rounded(
                cell.x +
                  (fallVoid
                    ? 0
                    : perpendicular.x *
                      side *
                      (cellWidth / 2 - hazardSize / 2)),
                precisionDecimalPlaces,
              ),
              y: rounded(
                fallVoid
                  ? routeBaseCenterY - fallDepth
                  : routeBaseCenterY - thickness,
                precisionDecimalPlaces,
              ),
              z: rounded(
                cell.z +
                  (fallVoid
                    ? 0
                    : perpendicular.z *
                      side *
                      (cellDepth / 2 - hazardSize / 2)),
                precisionDecimalPlaces,
              ),
            },
            rotationDegrees: {
              x: 0,
              y: yaw(outgoing, precisionDecimalPlaces),
              z: 0,
            },
          },
          size: fallVoid
            ? {
                x: rounded(cellWidth + 2 * fallMargin, precisionDecimalPlaces),
                y: thickness,
                z: rounded(cellDepth + 2 * fallMargin, precisionDecimalPlaces),
              }
            : { x: hazardSize, y: thickness, z: hazardSize },
          canCollide: false,
          canTouch: true,
        }),
      );
      stageHazardIds.push(objectId);
    }

    const zoneId = `layout-zone-${String(stageIndex + 1).padStart(3, "0")}`;
    const decorationSeed = deriveLayoutDomainSeed(
      source.obbySpec.seedIdentity,
      configuration.configurationHash,
      definitionHashes,
      `stage:${String(sourceStage.ordinal).padStart(2, "0")}:decoration`,
    );
    const decorationSide =
      new DeterministicRandom(decorationSeed).integer(0, 1) === 0 ? -1 : 1;
    const perpendicular = { x: -outgoing.z, z: outgoing.x };
    const zoneWidth = numeric(configuration, "decorative-zone-width");
    const zoneDepth = numeric(configuration, "decorative-zone-depth");
    const zoneHeight = numeric(configuration, "decorative-zone-height");
    const zoneOffset = numeric(configuration, "decorative-zone-offset");
    const zoneCenter = {
      x: rounded(
        cell.x + perpendicular.x * decorationSide * zoneOffset,
        precisionDecimalPlaces,
      ),
      y: rounded(routeBaseCenterY + zoneHeight / 2, precisionDecimalPlaces),
      z: rounded(
        cell.z + perpendicular.z * decorationSide * zoneOffset,
        precisionDecimalPlaces,
      ),
    };
    const sourceDecorationAssets = sourceStage.assetIntentIds.filter((id) =>
      decorationAssets.has(id),
    );
    if (sourceDecorationAssets.length === 0)
      throw new LayoutEngineError(
        "invariant",
        `${sourceStage.stageId} has no decorative native fallback authority`,
      );
    zones.push({
      zoneId,
      sourceStageId: sourceStage.stageId,
      sourceVisualStyleIntentId: sourceStage.visualStyleIntentId,
      sourceAssetIntentIds: sourceDecorationAssets as [string, ...string[]],
      bounds: {
        minimum: {
          x: rounded(zoneCenter.x - zoneWidth / 2, precisionDecimalPlaces),
          y: rounded(zoneCenter.y - zoneHeight / 2, precisionDecimalPlaces),
          z: rounded(zoneCenter.z - zoneDepth / 2, precisionDecimalPlaces),
        },
        maximum: {
          x: rounded(zoneCenter.x + zoneWidth / 2, precisionDecimalPlaces),
          y: rounded(zoneCenter.y + zoneHeight / 2, precisionDecimalPlaces),
          z: rounded(zoneCenter.z + zoneDepth / 2, precisionDecimalPlaces),
        },
      },
      collisionPolicy: "non-colliding-only",
      nativePartFallback: true,
    });
    const stageLayout: LayoutStage = {
      stageLayoutId: `layout-stage-${String(sourceStage.ordinal).padStart(2, "0")}`,
      sourceStageId: sourceStage.stageId,
      sourceRouteNodeId: routeNode.routeNodeId,
      ordinal: sourceStage.ordinal,
      sourceMechanicIntentId: intent.mechanicIntentId,
      mechanicLayoutDefinitionHash: definition.mechanicLayoutDefinitionHash,
      routeObjectIds: routeObjectIds as [string, ...string[]],
      hazardObjectIds: stageHazardIds,
      decorativeZoneIds: [zoneId],
    };
    if (checkpointEntry !== undefined) {
      const checkpointObjectId = routeObjectIds.at(-1);
      if (checkpointObjectId === undefined)
        throw new LayoutEngineError(
          "invariant",
          `${sourceStage.stageId} checkpoint route object is missing`,
        );
      stageLayout.checkpointObjectId = checkpointObjectId;
    }
    stages.push(stageLayout);
  }

  const finishCell = cells.at(-1);
  const lastStageCell = cells.at(-2);
  const finalStage = source.obbySpec.stages.at(-1);
  const finalIntentId = finalStage?.mechanicIntentIds[0];
  const finalIntent =
    finalIntentId === undefined ? undefined : intentById.get(finalIntentId);
  const finishDefinition = definitionByMechanic.get("finish-approach");
  const finishDifficulty =
    finalStage === undefined
      ? undefined
      : difficultyById.get(finalStage.difficultyBandId);
  if (
    finishCell === undefined ||
    lastStageCell === undefined ||
    finalStage === undefined ||
    finalIntent === undefined ||
    finishDefinition === undefined ||
    finishDifficulty === undefined
  )
    throw new LayoutEngineError(
      "invariant",
      "finish authorities or packing cell are missing",
    );
  const finishDirection = directionBetween(lastStageCell, finishCell);
  const finishRecipe = expandNativePartRecipe({
    mechanicId: "finish-approach",
    definition: finishDefinition,
    difficultyLevel: finishDifficulty.intentLevel,
    cell: finishCell,
    incoming: finishDirection,
    outgoing: finishDirection,
    cellWidth,
    cellDepth,
    baseCenterY: routeBaseCenterY,
    seed: deriveLayoutDomainSeed(
      source.obbySpec.seedIdentity,
      configuration.configurationHash,
      definitionHashes,
      "finish",
    ),
    precisionDecimalPlaces,
  })[0];
  if (finishRecipe === undefined)
    throw new LayoutEngineError("invariant", "finish recipe is empty");
  globalRouteOrder += 1;
  objects.push(
    nativeObject({
      objectId: "Finish",
      sourceReferences: {
        sourceStageId: finalStage.stageId,
        sourceMechanicIntentId: finalIntent.mechanicIntentId,
        sourceFinishId: source.obbySpec.finish.finishId,
        sourceAssetIntentIds: finalStage.assetIntentIds,
      },
      role: "finish",
      ...finishRecipe,
      routePlacement: {
        globalOrder: globalRouteOrder,
        stageOrder: 1,
      },
      canCollide: true,
      canTouch: true,
    }),
  );

  if (objects.length > configuration.limits.maxGameplayObjects)
    throw new LayoutEngineError(
      "packing-limit",
      "layout gameplay object budget exceeded",
    );
  if (zones.length > configuration.limits.maxDecorativeZones)
    throw new LayoutEngineError(
      "packing-limit",
      "layout decorative zone budget exceeded",
    );
  const routeObjectIds = [
    ...stages.flatMap((stage) => stage.routeObjectIds),
    "Finish",
  ];
  const routeLayoutId = `layout-route-${source.obbySpec.route.routeHash.slice(7, 23)}`;
  operation(options, "reachability-classification");
  const reachability = assessRequiredRoute(
    routeLayoutId,
    routeObjectIds,
    objects,
    stages,
    DEFAULT_LAYOUT_CONTROLLER_PROFILE,
  );
  const findings: LayoutSpec["findings"] = [
    {
      code: "model-relative-reachability",
      severity: "information",
      message:
        "Every required transition is feasible under the configured deterministic coarse model; this is not exact Roblox physics.",
      relatedSourceIds: [source.obbySpec.route.routeId],
    },
    {
      code: "native-fallback-selected",
      severity: "information",
      message:
        "Decorative zones retain deterministic non-colliding native-Part fallback authority.",
      relatedSourceIds: [...decorationAssets].sort(compareUnicodeScalars),
    },
  ];
  if (cells.some((cell) => cell.row > 0))
    findings.push({
      code: "route-row-wrapped",
      severity: "information",
      message:
        "The bounded serpentine route advanced to one or more additional rows.",
      relatedSourceIds: [source.obbySpec.route.routeId],
    });
  const specPreimage: Omit<LayoutSpec, "layoutSpecHash"> = {
    schemaVersion: "0.1",
    layoutSpecId: `layout-spec-${source.obbySpec.obbySpecHash.slice(7, 23)}`,
    layoutVersion: "g1-layout-v1",
    source: {
      generationBundleHash: source.generationBundleHash,
      obbySpecId: source.obbySpec.obbySpecId,
      obbySpecHash: source.obbySpec.obbySpecHash,
      generatorConfigurationHash: source.configurationHash,
      mechanicCatalogHash: source.catalogHash,
    },
    layoutConfigurationHash: configuration.configurationHash,
    mechanicLayoutDefinitionHashes: definitionHashes as [
      `sha256:${string}`,
      ...`sha256:${string}`[],
    ],
    layoutSeedIdentity: source.obbySpec.seedIdentity,
    coordinateSystem: {
      units: "studs",
      handedness: "right-handed",
      upAxis: "+Y",
      forwardAxis: "-Z",
      rotationUnit: "degrees",
      rotationOrder: "XYZ",
    },
    characterPlacement: {
      strategy: "humanoid-root-part-cframe-v1",
      orientationPolicy: "face-next-safe-route-object",
      verticalOffset: numeric(configuration, "character-root-offset"),
    },
    worldBounds: bounds(
      objects,
      zones,
      numeric(configuration, "world-bounds-padding"),
      configuration.limits.maxWorldExtent,
      precisionDecimalPlaces,
    ),
    stages: stages as LayoutSpec["stages"],
    route: {
      routeLayoutId,
      sourceRouteId: source.obbySpec.route.routeId,
      orderedObjectIds:
        routeObjectIds as LayoutSpec["route"]["orderedObjectIds"],
    },
    reachability,
    objects: objects as LayoutSpec["objects"],
    decorativeZones: zones,
    limitations: [],
    findings,
  };
  const layoutSpec: LayoutSpec = {
    ...specPreimage,
    layoutSpecHash: hashLayoutSpec(specPreimage).hash,
  };
  const bundlePreimage: Omit<LayoutBundle, "layoutBundleHash"> = {
    schemaVersion: "0.1",
    layoutBundleId: `layout-bundle-${source.generationBundleHash.slice(7, 23)}`,
    sourceGenerationBundleHash: source.generationBundleHash,
    layoutConfigurationRef: {
      configurationId: configuration.configurationId,
      configurationVersion: configuration.configurationVersion,
      configurationHash: configuration.configurationHash,
    },
    mechanicLayoutDefinitionRefs: used.map((definition) => ({
      mechanicLayoutDefinitionId: definition.mechanicLayoutDefinitionId,
      definitionVersion: definition.definitionVersion,
      mechanicLayoutDefinitionHash: definition.mechanicLayoutDefinitionHash,
    })) as LayoutBundle["mechanicLayoutDefinitionRefs"],
    layoutSpec,
  };
  const bundle: LayoutBundle = {
    ...bundlePreimage,
    layoutBundleHash: hashLayoutBundle(bundlePreimage).hash,
  };
  operation(options, "serialization-preparation");
  const serialized = canonicalizeEvaluatorSnapshot(
    snapshotEvaluatorInput(bundle),
  ).canonicalBytes;
  if (serialized.byteLength > configuration.limits.maxOutputBytes)
    throw new LayoutEngineError(
      "output-limit",
      "LayoutBundle exceeds the configured output byte limit",
    );
  phases.push("publication-validation");
  operation(options, "bundle-validation");
  const validated = assertValidLayoutBundle(
    bundle,
    source,
    generatorConfiguration,
    catalog,
    configuration,
    used,
  );
  invokeCallback(options.onPhaseTrace, Object.freeze([...phases]));
  return validated;
}
