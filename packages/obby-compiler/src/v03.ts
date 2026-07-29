import {
  assertValidPlaceSpecV03,
  assertValidSceneManifestV03,
  computeSceneManifestV03Hash,
  type GameplayBehaviorV03,
  type PlaceSpecV03,
  type SceneManifestV03,
} from "@obby/contracts";

export const GENERATOR_VERSION_V03 = "0.3.0";

function behaviorFor(
  object: PlaceSpecV03["objects"][number],
  checkpointOrderById: ReadonlyMap<string, number>,
): GameplayBehaviorV03 {
  if (object.role === "checkpoint") {
    const checkpointOrder = checkpointOrderById.get(object.id);
    if (checkpointOrder === undefined)
      throw new Error("validated checkpoint is absent from its ordered plan");
    return { kind: "checkpoint", checkpointOrder };
  }
  if (object.role === "kill") return { kind: "kill", killMode: "touch" };
  if (object.role === "finish") return { kind: "finish" };
  return { kind: "none" };
}

export function compilePlaceSpecV03(input: unknown): SceneManifestV03 {
  const spec = assertValidPlaceSpecV03(input);
  const checkpointOrderById = new Map(
    spec.checkpointPlan.checkpointObjectIds.map((id, index) => [id, index + 1]),
  );
  const gameplayObjects = spec.objects.map((object) => ({
    id: object.id,
    order: object.order,
    sourceReferences: object.sourceReferences,
    role: object.role,
    authority: object.authority,
    className: "Part" as const,
    shape: object.shape,
    transform: object.transform,
    size: object.size,
    collision: object.collision,
    appearance: object.appearance,
    geometry: object.geometry,
    behavior: behaviorFor(object, checkpointOrderById),
  })) as SceneManifestV03["layers"]["gameplay"]["objects"];

  const finalStage = spec.stages.at(-1);
  if (finalStage === undefined)
    throw new Error("validated stage list is empty");
  const navigationStages = spec.stages.map((stage, index) => ({
    stageId: stage.stageId,
    sourceStageId: stage.sourceStageId,
    order: stage.order,
    safeRouteObjectIds:
      index === spec.stages.length - 1
        ? ([...stage.routeObjectIds, "Finish"] as [string, ...string[]])
        : stage.routeObjectIds,
    ...(stage.checkpointObjectId === undefined
      ? {}
      : { checkpointObjectId: stage.checkpointObjectId }),
  })) as SceneManifestV03["navigation"]["stages"];
  const routeLocation = new Map<
    string,
    { stageId: string; stageOrder: number }
  >();
  for (const stage of navigationStages)
    for (const [index, objectId] of stage.safeRouteObjectIds.entries())
      routeLocation.set(objectId, {
        stageId: stage.stageId,
        stageOrder: index + 1,
      });
  const routeEntries = spec.route.orderedObjectIds.map((objectId, index) => {
    const location = routeLocation.get(objectId);
    if (location === undefined)
      throw new Error(
        "validated route object is absent from navigation stages",
      );
    return {
      globalOrder: index + 1,
      objectId,
      stageId: location.stageId,
      stageOrder: location.stageOrder,
    };
  }) as SceneManifestV03["navigation"]["routeEntries"];

  const preimage: Omit<SceneManifestV03, "manifestHash"> = {
    schemaVersion: "0.3",
    generatorVersion: GENERATOR_VERSION_V03,
    projectionVersion: spec.projectionVersion,
    sceneId: `${spec.specId}-scene`,
    sourceSpecId: spec.specId,
    sourcePlaceSpecHash: spec.placeSpecHash,
    seed: spec.seed,
    seedIdentity: spec.seedIdentity,
    provenance: spec.provenance,
    coordinateSystem: spec.coordinateSystem,
    worldBounds: spec.worldBounds,
    navigation: {
      routeId: spec.route.routeId,
      sourceRouteId: spec.route.sourceRouteId,
      characterPlacement: spec.characterPlacement,
      spawnObjectId: "Spawn",
      finishObjectId: "Finish",
      checkpointObjectIds: spec.checkpointPlan.checkpointObjectIds,
      safeRouteObjectIds: spec.route.orderedObjectIds,
      routeEntries,
      stages: navigationStages,
      reachability: spec.reachability,
    },
    layers: {
      gameplay: { objects: gameplayObjects },
      decorative: { objects: [] },
    },
    decorativeZones: spec.decorativeZones,
    limitations: spec.limitations,
    findings: spec.findings,
  };
  const manifest: SceneManifestV03 = {
    ...preimage,
    manifestHash: computeSceneManifestV03Hash(preimage),
  };
  return assertValidSceneManifestV03(manifest);
}
