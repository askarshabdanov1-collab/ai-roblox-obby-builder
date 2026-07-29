import {
  compareUnicodeScalars,
  snapshotEvaluatorInput,
} from "@obby/canonical-json";
import {
  assertValidGenerationBundle,
  type GenerationBundle,
  type GeneratorConfiguration,
  type MechanicCatalog,
} from "@obby/obby-generator-contracts";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import layoutSchema from "../schemas/layout-contracts.schema.json" with { type: "json" };

import type {
  LayoutBundle,
  LayoutConfiguration,
  LayoutObject,
  LayoutSpec,
  MechanicLayoutDefinition,
} from "./generated/layout-contracts.js";
import {
  hashLayoutBundle,
  hashLayoutConfiguration,
  hashLayoutSpec,
  hashMechanicLayoutDefinition,
} from "./hashing.js";
import { LayoutContractError } from "./types.js";

const schemaId = layoutSchema.$id;
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(layoutSchema);
const structural = new Map<string, ValidateFunction>();
for (const name of [
  "LayoutConfiguration",
  "MechanicLayoutDefinition",
  "LayoutSpec",
  "LayoutBundle",
] as const)
  structural.set(name, ajv.compile({ $ref: `${schemaId}#/$defs/${name}` }));

function snapshot<T>(input: T, label: string): T {
  try {
    return snapshotEvaluatorInput(input) as T;
  } catch {
    throw new LayoutContractError(
      "schema",
      `${label} must be immutable-compatible plain data`,
    );
  }
}

function assertStructural(name: string, input: unknown): void {
  const validator = structural.get(name);
  if (!validator?.(input)) {
    const details =
      validator?.errors
        ?.map((error) => `${error.instancePath || "/"}:${error.keyword}`)
        .join(", ") ?? "validator unavailable";
    throw new LayoutContractError(
      "schema",
      `${name} structural validation failed: ${details}`,
    );
  }
}

function assertHash(label: string, actual: string, expected: string): void {
  if (actual !== expected)
    throw new LayoutContractError(
      "hash-mismatch",
      `${label} content mismatch: expected ${expected}, received ${actual}`,
    );
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new LayoutContractError("duplicate-id", `${label} must be unique`);
}

function assertExactSet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
  code: "invalid-reference" | "stale-authority" = "invalid-reference",
): void {
  const left = [...actual].sort(compareUnicodeScalars);
  const right = [...expected].sort(compareUnicodeScalars);
  if (
    left.length !== right.length ||
    left.some((value, index) => value !== right[index])
  )
    throw new LayoutContractError(
      code,
      `${label} does not match its authoritative reference set`,
    );
}

export function assertValidLayoutConfiguration(
  input: unknown,
): LayoutConfiguration {
  const value = snapshot(input, "LayoutConfiguration");
  assertStructural("LayoutConfiguration", value);
  const configuration = value as LayoutConfiguration;
  assertHash(
    "configurationHash",
    configuration.configurationHash,
    hashLayoutConfiguration(configuration).hash,
  );
  assertUnique(
    configuration.numericParameters.map((parameter) => parameter.parameterId),
    "layout numeric parameter IDs",
  );
  const requiredParameters = new Map([
    ["character-root-offset", "studs"],
    ["fall-void-depth", "studs"],
    ["fall-void-margin", "studs"],
    ["packing-cell-depth", "studs"],
    ["packing-cell-width", "studs"],
    ["packing-columns", "count"],
  ]);
  for (const [parameterId, unit] of requiredParameters) {
    const parameter = configuration.numericParameters.find(
      (candidate) => candidate.parameterId === parameterId,
    );
    if (parameter?.unit !== unit)
      throw new LayoutContractError(
        "invariant",
        `${parameterId} is required with unit ${unit}`,
      );
  }
  for (const parameter of configuration.numericParameters) {
    if (
      parameter.minimum > parameter.maximum ||
      parameter.value < parameter.minimum ||
      parameter.value > parameter.maximum ||
      (parameter.unit === "count" && !Number.isInteger(parameter.value))
    )
      throw new LayoutContractError(
        "invariant",
        `${parameter.parameterId} value must be valid for its declared range and unit`,
      );
  }
  return configuration;
}

export function assertValidMechanicLayoutDefinition(
  input: unknown,
): MechanicLayoutDefinition {
  const value = snapshot(input, "MechanicLayoutDefinition");
  assertStructural("MechanicLayoutDefinition", value);
  const definition = value as MechanicLayoutDefinition;
  assertHash(
    "mechanicLayoutDefinitionHash",
    definition.mechanicLayoutDefinitionHash,
    hashMechanicLayoutDefinition(definition).hash,
  );
  if (
    definition.routeObjectBudget.minimum > definition.routeObjectBudget.maximum
  )
    throw new LayoutContractError(
      "invariant",
      "routeObjectBudget minimum cannot exceed maximum",
    );
  assertUnique(definition.supportedShapes, "supportedShapes");
  assertUnique(
    definition.difficultyProfiles.map((profile) =>
      String(profile.difficultyLevel),
    ),
    "difficulty profile levels",
  );
  for (const profile of definition.difficultyProfiles) {
    assertUnique(
      profile.parameters.map((parameter) => parameter.parameterId),
      `difficulty ${profile.difficultyLevel} parameter IDs`,
    );
    for (const parameter of profile.parameters)
      if (
        parameter.minimum > parameter.maximum ||
        parameter.value < parameter.minimum ||
        parameter.value > parameter.maximum
      )
        throw new LayoutContractError(
          "invariant",
          `${parameter.parameterId} value must be inside its declared range`,
        );
  }
  return definition;
}

function assertObjectBounds(object: LayoutObject, spec: LayoutSpec): void {
  for (const axis of ["x", "y", "z"] as const) {
    const halfSize = object.size[axis] / 2;
    if (
      object.transform.position[axis] - halfSize <
        spec.worldBounds.minimum[axis] ||
      object.transform.position[axis] + halfSize >
        spec.worldBounds.maximum[axis]
    )
      throw new LayoutContractError(
        "invariant",
        `${object.objectId} exceeds declared worldBounds on ${axis}`,
      );
  }
}

function assertSpecClosure(
  spec: LayoutSpec,
  source: GenerationBundle,
  definitions: readonly MechanicLayoutDefinition[],
): void {
  const obby = source.obbySpec;
  if (
    spec.source.generationBundleHash !== source.generationBundleHash ||
    spec.source.obbySpecId !== obby.obbySpecId ||
    spec.source.obbySpecHash !== obby.obbySpecHash ||
    spec.source.generatorConfigurationHash !== source.configurationHash ||
    spec.source.mechanicCatalogHash !== source.catalogHash ||
    spec.layoutSeedIdentity !== obby.seedIdentity
  )
    throw new LayoutContractError(
      "stale-authority",
      "LayoutSpec source authority does not match the validated GenerationBundle",
    );

  const stagesById = new Map(
    obby.stages.map((stage) => [stage.stageId, stage]),
  );
  const nodesById = new Map(
    obby.route.nodes.map((node) => [node.routeNodeId, node]),
  );
  const intentsById = new Map(
    obby.mechanicIntents.map((intent) => [intent.mechanicIntentId, intent]),
  );
  const definitionsByHash = new Map(
    definitions.map((definition) => [
      definition.mechanicLayoutDefinitionHash,
      definition,
    ]),
  );
  const checkpointsById = new Map(
    obby.checkpoints.map((checkpoint) => [checkpoint.checkpointId, checkpoint]),
  );
  const checkpointOrdinals = new Map(
    obby.checkpoints.map((checkpoint, index) => [
      checkpoint.checkpointId,
      index + 1,
    ]),
  );
  const checkpointsByStage = new Map(
    obby.checkpoints.map((checkpoint) => [checkpoint.stageId, checkpoint]),
  );
  const hazardsById = new Map(
    obby.hazards.map((hazard) => [hazard.hazardId, hazard]),
  );
  const assets = new Set(
    obby.assetIntents.map((intent) => intent.assetIntentId),
  );
  const visualStyles = new Set(
    obby.visualStyleIntents.map((intent) => intent.visualStyleIntentId),
  );

  if (spec.stages.length !== obby.stages.length)
    throw new LayoutContractError(
      "invalid-reference",
      "LayoutSpec must contain exactly one layout stage for every source stage",
    );
  if (spec.layoutSpecId !== `layout-spec-${obby.obbySpecHash.slice(7, 23)}`)
    throw new LayoutContractError(
      "invariant",
      "layoutSpecId does not follow source-ordinal-pascal-v1",
    );
  if (
    spec.route.routeLayoutId !==
    `layout-route-${obby.route.routeHash.slice(7, 23)}`
  )
    throw new LayoutContractError(
      "invariant",
      "routeLayoutId does not follow source-ordinal-pascal-v1",
    );
  assertUnique(
    spec.stages.map((stage) => stage.stageLayoutId),
    "stageLayoutId values",
  );
  assertUnique(
    spec.stages.map((stage) => stage.sourceStageId),
    "sourceStageId values",
  );
  assertUnique(
    spec.objects.map((object) => object.objectId),
    "objectId values",
  );
  assertUnique(
    spec.decorativeZones.map((zone) => zone.zoneId),
    "zoneId values",
  );

  const objectsById = new Map(
    spec.objects.map((object) => [object.objectId, object]),
  );
  const zonesById = new Map(
    spec.decorativeZones.map((zone) => [zone.zoneId, zone]),
  );
  const expectedRoute: string[] = [];
  const referencedHazards: string[] = [];
  const referencedCheckpoints: string[] = [];
  const referencedZones: string[] = [];

  for (const [index, layoutStage] of spec.stages.entries()) {
    const sourceStage = stagesById.get(layoutStage.sourceStageId);
    if (
      sourceStage?.ordinal !== index + 1 ||
      layoutStage.ordinal !== index + 1 ||
      layoutStage.stageLayoutId !==
        `layout-stage-${String(index + 1).padStart(2, "0")}`
    )
      throw new LayoutContractError(
        "invalid-reference",
        `layout stage ${layoutStage.stageLayoutId} does not match source stage order`,
      );
    const node = nodesById.get(layoutStage.sourceRouteNodeId);
    if (node?.stageId !== sourceStage.stageId)
      throw new LayoutContractError(
        "invalid-reference",
        `${layoutStage.sourceRouteNodeId} is not a route node for ${sourceStage.stageId}`,
      );
    const intent = intentsById.get(layoutStage.sourceMechanicIntentId);
    if (
      intent?.stageId !== sourceStage.stageId ||
      !sourceStage.mechanicIntentIds.includes(
        layoutStage.sourceMechanicIntentId,
      )
    )
      throw new LayoutContractError(
        "invalid-reference",
        `${layoutStage.sourceMechanicIntentId} is not authoritative for ${sourceStage.stageId}`,
      );
    const definition = definitionsByHash.get(
      layoutStage.mechanicLayoutDefinitionHash,
    );
    if (definition?.sourceMechanic.mechanicId !== intent.mechanicId)
      throw new LayoutContractError(
        "stale-authority",
        `layout definition does not match ${intent.mechanicId}`,
      );

    assertUnique(
      layoutStage.routeObjectIds,
      `${layoutStage.stageLayoutId} routeObjectIds`,
    );
    for (const [stageIndex, objectId] of layoutStage.routeObjectIds.entries()) {
      const object = objectsById.get(objectId);
      const checkpointOrdinal =
        object?.sourceReferences.sourceCheckpointId === undefined
          ? undefined
          : checkpointOrdinals.get(object.sourceReferences.sourceCheckpointId);
      const expectedObjectId =
        object?.role === "checkpoint" && checkpointOrdinal !== undefined
          ? `Checkpoint${String(checkpointOrdinal).padStart(3, "0")}`
          : `Stage${String(sourceStage.ordinal).padStart(2, "0")}Route${String(stageIndex + 1).padStart(3, "0")}`;
      if (
        object === undefined ||
        objectId !== expectedObjectId ||
        object.sourceReferences.sourceStageId !== sourceStage.stageId ||
        object.sourceReferences.sourceMechanicIntentId !==
          intent.mechanicIntentId ||
        object.role === "spawn" ||
        object.role === "kill" ||
        object.routePlacement?.globalOrder !== expectedRoute.length + 1 ||
        object.routePlacement.stageOrder !== stageIndex + 1
      )
        throw new LayoutContractError(
          "invalid-reference",
          `${objectId} is not a closed safe-route object for ${sourceStage.stageId}`,
        );
      expectedRoute.push(objectId);
    }

    const checkpoint = checkpointsByStage.get(sourceStage.stageId);
    if (checkpoint === undefined) {
      if (layoutStage.checkpointObjectId !== undefined)
        throw new LayoutContractError(
          "invalid-reference",
          `${sourceStage.stageId} invents a checkpoint`,
        );
    } else {
      const checkpointObject =
        layoutStage.checkpointObjectId === undefined
          ? undefined
          : objectsById.get(layoutStage.checkpointObjectId);
      if (
        checkpointObject?.role !== "checkpoint" ||
        checkpointObject.sourceReferences.sourceCheckpointId !==
          checkpoint.checkpointId ||
        !layoutStage.routeObjectIds.includes(checkpointObject.objectId)
      )
        throw new LayoutContractError(
          "invalid-reference",
          `${sourceStage.stageId} does not close its source checkpoint`,
        );
      referencedCheckpoints.push(checkpoint.checkpointId);
    }

    assertUnique(
      layoutStage.hazardObjectIds,
      `${layoutStage.stageLayoutId} hazardObjectIds`,
    );
    const stageSourceHazards = obby.hazards.filter(
      (hazard) => hazard.stageId === sourceStage.stageId,
    );
    for (const [
      hazardIndex,
      objectId,
    ] of layoutStage.hazardObjectIds.entries()) {
      const object = objectsById.get(objectId);
      const sourceHazardId = object?.sourceReferences.sourceHazardId;
      const sourceHazard =
        sourceHazardId === undefined
          ? undefined
          : hazardsById.get(sourceHazardId);
      if (
        object?.role !== "kill" ||
        objectId !==
          `Stage${String(sourceStage.ordinal).padStart(2, "0")}Hazard${String(hazardIndex + 1).padStart(3, "0")}` ||
        object.routePlacement !== undefined ||
        sourceHazard?.stageId !== sourceStage.stageId ||
        sourceHazardId !== stageSourceHazards[hazardIndex]?.hazardId
      )
        throw new LayoutContractError(
          "invalid-reference",
          `${objectId} is not a closed hazard for ${sourceStage.stageId}`,
        );
      if (sourceHazardId === undefined)
        throw new LayoutContractError(
          "invalid-reference",
          `${objectId} does not identify a source hazard`,
        );
      referencedHazards.push(sourceHazardId);
    }
    for (const zoneId of layoutStage.decorativeZoneIds) {
      const zone = zonesById.get(zoneId);
      if (zone?.sourceStageId !== sourceStage.stageId)
        throw new LayoutContractError(
          "invalid-reference",
          `${zoneId} is not a decorative zone for ${sourceStage.stageId}`,
        );
      referencedZones.push(zoneId);
    }
  }

  if (spec.route.sourceRouteId !== obby.route.routeId)
    throw new LayoutContractError(
      "invalid-reference",
      "route source is stale or unknown",
    );
  const finishObject = objectsById.get("Finish");
  if (
    finishObject?.role !== "finish" ||
    finishObject.sourceReferences.sourceFinishId !== obby.finish.finishId ||
    finishObject.sourceReferences.sourceStageId !== obby.finish.afterStageId ||
    finishObject.routePlacement?.globalOrder !== expectedRoute.length + 1
  )
    throw new LayoutContractError(
      "invalid-reference",
      "Finish does not close the source finish",
    );
  expectedRoute.push("Finish");
  if (
    spec.route.orderedObjectIds.length !== expectedRoute.length ||
    spec.route.orderedObjectIds.some((id, index) => id !== expectedRoute[index])
  )
    throw new LayoutContractError(
      "invalid-reference",
      "orderedObjectIds must be the stage-major safe route followed by Finish",
    );
  if (spec.reachability.requiredTransitions.length !== expectedRoute.length)
    throw new LayoutContractError(
      "invalid-reference",
      "reachability must cover every required Spawn-to-Finish transition",
    );
  assertUnique(
    spec.reachability.requiredTransitions.map(
      (transition) => transition.transitionLayoutId,
    ),
    "reachability transition IDs",
  );
  const routeWithSpawn = ["Spawn", ...expectedRoute];
  for (const [
    index,
    transition,
  ] of spec.reachability.requiredTransitions.entries())
    if (
      transition.transitionLayoutId !==
        `layout-transition-${String(index + 1).padStart(3, "0")}` ||
      transition.fromObjectId !== routeWithSpawn[index] ||
      transition.toObjectId !== routeWithSpawn[index + 1] ||
      transition.fromGlobalOrder !== index ||
      transition.toGlobalOrder !== index + 1
    )
      throw new LayoutContractError(
        "invalid-reference",
        `${transition.transitionLayoutId} does not close the required route transition at order ${index + 1}`,
      );

  const spawnObjects = spec.objects.filter((object) => object.role === "spawn");
  if (spawnObjects.length !== 1 || spawnObjects[0]?.objectId !== "Spawn")
    throw new LayoutContractError(
      "invariant",
      "LayoutSpec requires exactly one Spawn",
    );
  assertExactSet(
    referencedHazards,
    obby.hazards.map((hazard) => hazard.hazardId),
    "hazards",
  );
  assertExactSet(
    referencedCheckpoints,
    obby.checkpoints.map((checkpoint) => checkpoint.checkpointId),
    "checkpoints",
  );
  assertExactSet(
    referencedZones,
    spec.decorativeZones.map((zone) => zone.zoneId),
    "decorative zones",
  );
  assertExactSet(
    spec.objects.map((object) => object.objectId),
    [
      "Spawn",
      ...expectedRoute,
      ...spec.stages.flatMap((stage) => stage.hazardObjectIds),
    ],
    "layout object inventory",
  );

  for (const object of spec.objects) {
    for (const assetId of object.sourceReferences.sourceAssetIntentIds)
      if (!assets.has(assetId))
        throw new LayoutContractError(
          "invalid-reference",
          `${assetId} is not a source asset intent`,
        );
    if (object.role !== "kill" && !object.collision.canCollide)
      throw new LayoutContractError(
        "invariant",
        `${object.objectId} must provide native collision`,
      );
    if (
      (object.role === "spawn" || object.role === "checkpoint") &&
      (object.transform.rotationDegrees.x !== 0 ||
        object.transform.rotationDegrees.z !== 0)
    )
      throw new LayoutContractError(
        "invariant",
        `${object.objectId} cannot use pitch or roll`,
      );
    const expectedTouch =
      object.role === "checkpoint" ||
      object.role === "kill" ||
      object.role === "finish";
    if (object.collision.canTouch !== expectedTouch)
      throw new LayoutContractError(
        "invariant",
        `${object.objectId} has inconsistent touch behavior`,
      );
    assertObjectBounds(object, spec);
  }
  for (const [zoneIndex, zone] of spec.decorativeZones.entries()) {
    if (zone.zoneId !== `layout-zone-${String(zoneIndex + 1).padStart(3, "0")}`)
      throw new LayoutContractError(
        "invariant",
        `${zone.zoneId} does not follow source-ordinal-pascal-v1`,
      );
    if (!visualStyles.has(zone.sourceVisualStyleIntentId))
      throw new LayoutContractError(
        "invalid-reference",
        `${zone.zoneId} has an unknown visual style`,
      );
    for (const assetId of zone.sourceAssetIntentIds)
      if (!assets.has(assetId))
        throw new LayoutContractError(
          "invalid-reference",
          `${zone.zoneId} has an unknown asset intent`,
        );
    for (const axis of ["x", "y", "z"] as const)
      if (zone.bounds.minimum[axis] >= zone.bounds.maximum[axis])
        throw new LayoutContractError(
          "invariant",
          `${zone.zoneId} has invalid bounds`,
        );
  }
  for (const axis of ["x", "y", "z"] as const)
    if (spec.worldBounds.minimum[axis] >= spec.worldBounds.maximum[axis])
      throw new LayoutContractError(
        "invariant",
        `worldBounds ${axis} range is invalid`,
      );

  const checkpointSourceIds = spec.objects
    .map((object) => object.sourceReferences.sourceCheckpointId)
    .filter((id): id is string => id !== undefined);
  const hazardSourceIds = spec.objects
    .map((object) => object.sourceReferences.sourceHazardId)
    .filter((id): id is string => id !== undefined);
  assertUnique(checkpointSourceIds, "sourceCheckpointId values");
  assertUnique(hazardSourceIds, "sourceHazardId values");
  for (const id of checkpointSourceIds)
    if (!checkpointsById.has(id))
      throw new LayoutContractError(
        "invalid-reference",
        `${id} is not a source checkpoint`,
      );
}

export function assertValidLayoutSpec(input: unknown): LayoutSpec {
  const value = snapshot(input, "LayoutSpec");
  assertStructural("LayoutSpec", value);
  const spec = value as LayoutSpec;
  assertHash("layoutSpecHash", spec.layoutSpecHash, hashLayoutSpec(spec).hash);
  return spec;
}

export function assertValidLayoutBundle(
  input: unknown,
  sourceInput: unknown,
  generatorConfigurationInput: unknown,
  mechanicCatalogInput: unknown,
  layoutConfigurationInput: unknown,
  mechanicDefinitionInputs: readonly unknown[],
): LayoutBundle {
  const bundleValue = snapshot(input, "LayoutBundle");
  const source = snapshot(sourceInput, "GenerationBundle") as GenerationBundle;
  const generatorConfiguration = snapshot(
    generatorConfigurationInput,
    "GeneratorConfiguration",
  ) as GeneratorConfiguration;
  const catalog = snapshot(
    mechanicCatalogInput,
    "MechanicCatalog",
  ) as MechanicCatalog;
  const mechanicDefinitionSnapshots = snapshot(
    mechanicDefinitionInputs,
    "MechanicLayoutDefinition authorities",
  );
  try {
    assertValidGenerationBundle(source, catalog, generatorConfiguration);
  } catch {
    throw new LayoutContractError(
      "stale-authority",
      "source GenerationBundle is not valid under the supplied G0 authorities",
    );
  }
  const layoutConfiguration = assertValidLayoutConfiguration(
    layoutConfigurationInput,
  );
  const definitions = mechanicDefinitionSnapshots.map((definition) =>
    assertValidMechanicLayoutDefinition(definition),
  );
  assertUnique(
    definitions.map((definition) => definition.mechanicLayoutDefinitionId),
    "mechanicLayoutDefinitionId values",
  );
  assertUnique(
    definitions.map((definition) => definition.mechanicLayoutDefinitionHash),
    "mechanicLayoutDefinitionHash values",
  );
  assertStructural("LayoutBundle", bundleValue);
  const bundle = bundleValue as LayoutBundle;
  assertHash(
    "layoutBundleHash",
    bundle.layoutBundleHash,
    hashLayoutBundle(bundle).hash,
  );
  const spec = assertValidLayoutSpec(bundle.layoutSpec);

  if (
    bundle.layoutBundleId !==
    `layout-bundle-${source.generationBundleHash.slice(7, 23)}`
  )
    throw new LayoutContractError(
      "invariant",
      "layoutBundleId does not follow source-ordinal-pascal-v1",
    );

  if (
    bundle.sourceGenerationBundleHash !== source.generationBundleHash ||
    bundle.layoutConfigurationRef.configurationId !==
      layoutConfiguration.configurationId ||
    bundle.layoutConfigurationRef.configurationHash !==
      layoutConfiguration.configurationHash ||
    spec.layoutConfigurationHash !== layoutConfiguration.configurationHash
  )
    throw new LayoutContractError(
      "stale-authority",
      "LayoutBundle does not reference the exact supplied layout configuration",
    );
  const characterOffset = layoutConfiguration.numericParameters.find(
    (parameter) => parameter.parameterId === "character-root-offset",
  );
  if (spec.characterPlacement.verticalOffset !== characterOffset?.value)
    throw new LayoutContractError(
      "stale-authority",
      "character placement offset does not match LayoutConfiguration authority",
    );
  const expectedController =
    layoutConfiguration.reachabilityPolicy.controllerProfileRef;
  const actualController = spec.reachability.controllerProfileRef;
  if (
    actualController.profileId !== expectedController.profileId ||
    actualController.profileVersion !== expectedController.profileVersion ||
    actualController.controllerProfileHash !==
      expectedController.controllerProfileHash
  )
    throw new LayoutContractError(
      "stale-authority",
      "reachability assessment does not use the configured controller profile",
    );
  if (
    spec.limitations.some(
      (limitation) => limitation.code === "reachability-indeterminate",
    )
  )
    throw new LayoutContractError(
      "invariant",
      "indeterminate required-route reachability blocks LayoutBundle publication",
    );

  const refsByHash = new Map(
    bundle.mechanicLayoutDefinitionRefs.map((reference) => [
      reference.mechanicLayoutDefinitionHash,
      reference,
    ]),
  );
  assertUnique(
    bundle.mechanicLayoutDefinitionRefs.map(
      (reference) => reference.mechanicLayoutDefinitionId,
    ),
    "mechanic layout definition reference IDs",
  );
  assertUnique(
    bundle.mechanicLayoutDefinitionRefs.map(
      (reference) => reference.mechanicLayoutDefinitionHash,
    ),
    "mechanic layout definition reference hashes",
  );
  assertExactSet(
    bundle.mechanicLayoutDefinitionRefs.map(
      (reference) => reference.mechanicLayoutDefinitionHash,
    ),
    definitions.map((definition) => definition.mechanicLayoutDefinitionHash),
    "mechanic layout definition references",
    "stale-authority",
  );
  for (const definition of definitions) {
    const reference = refsByHash.get(definition.mechanicLayoutDefinitionHash);
    if (
      reference?.mechanicLayoutDefinitionId !==
        definition.mechanicLayoutDefinitionId ||
      reference.definitionVersion !== definition.definitionVersion
    )
      throw new LayoutContractError(
        "stale-authority",
        `${definition.mechanicLayoutDefinitionId} reference is stale`,
      );
    const mechanic = catalog.mechanics.find(
      (candidate) =>
        candidate.mechanicId === definition.sourceMechanic.mechanicId,
    );
    if (
      mechanic?.capability !== "g1-static-supported" ||
      mechanic.mechanicDefinitionHash !==
        definition.sourceMechanic.mechanicDefinitionHash
    )
      throw new LayoutContractError(
        "unsupported-mechanic",
        `${definition.mechanicLayoutDefinitionId} lacks an exact supported G0 mechanic authority`,
      );
  }
  assertExactSet(
    spec.mechanicLayoutDefinitionHashes,
    definitions.map((definition) => definition.mechanicLayoutDefinitionHash),
    "LayoutSpec mechanic definition hashes",
  );
  assertSpecClosure(spec, source, definitions);
  return bundle;
}
