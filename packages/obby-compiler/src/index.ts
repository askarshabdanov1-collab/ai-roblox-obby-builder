import { normalizeNumber, sha256 } from "@obby/canonical-json";
import {
  assertValidPlaceSpec,
  assertValidSceneManifest,
  computeManifestHash,
  MANIFEST_HASH_PLACEHOLDER,
  type GameplayBehavior,
  type GameplayObject,
  type PlaceSpec,
  type SceneManifest,
} from "@obby/contracts";

export const GENERATOR_VERSION = "0.2.0";

type Obstacle = PlaceSpec["obstacles"][number];

function colorFor(spec: PlaceSpec, slot: Obstacle["colorSlot"]): string {
  switch (slot) {
    case "primary":
      return spec.visualBrief.primaryColors[0];
    case "secondary":
      return spec.visualBrief.primaryColors[1];
    case "reward":
      return spec.visualBrief.rewardColor;
    case "hazard":
      return spec.visualBrief.hazardColor;
  }
}

function classFor(
  role: GameplayObject["role"],
  shape: GameplayObject["shape"],
): GameplayObject["className"] {
  if (role === "spawn") return "SpawnLocation";
  return shape === "Wedge" ? "WedgePart" : "Part";
}

function behaviorFor(
  obstacle: Obstacle,
  checkpointOrderById: ReadonlyMap<string, number>,
): GameplayBehavior {
  switch (obstacle.role) {
    case "checkpoint": {
      const checkpointOrder = checkpointOrderById.get(obstacle.id);
      if (checkpointOrder === undefined) {
        throw new Error(
          `Checkpoint ${obstacle.id} is absent from the validated checkpoint plan`,
        );
      }
      return {
        kind: "checkpoint",
        checkpointOrder,
      };
    }
    case "kill":
      return { kind: "kill", killMode: "set-health-zero" };
    case "finish":
      return { kind: "finish" };
    case "platform":
      return { kind: "platform" };
  }
}

function boundsFor(
  objects: readonly GameplayObject[],
): SceneManifest["worldBounds"] {
  const minimum = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
    z: Number.POSITIVE_INFINITY,
  };
  const maximum = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    z: Number.NEGATIVE_INFINITY,
  };
  for (const object of objects) {
    const radius = Math.hypot(object.size.x, object.size.y, object.size.z) / 2;
    for (const axis of ["x", "y", "z"] as const) {
      minimum[axis] = Math.min(
        minimum[axis],
        object.transform.position[axis] - radius,
      );
      maximum[axis] = Math.max(
        maximum[axis],
        object.transform.position[axis] + radius,
      );
    }
  }
  for (const axis of ["x", "y", "z"] as const) {
    minimum[axis] = normalizeNumber(minimum[axis] - 1);
    maximum[axis] = normalizeNumber(maximum[axis] + 1);
  }
  return { minimum, maximum };
}

export function compilePlaceSpec(input: unknown): SceneManifest {
  const spec = assertValidPlaceSpec(input);
  const checkpointOrderById = new Map(
    spec.checkpointPlan.checkpointObstacleIds.map((id, index) => [
      id,
      index + 1,
    ]),
  );

  const spawn: GameplayObject = {
    id: "Spawn",
    order: 0,
    role: "spawn",
    className: "SpawnLocation",
    shape: "Block",
    transform: spec.spawn.transform,
    size: spec.spawn.size,
    color: spec.visualBrief.primaryColors[0],
    colorRole: "primary",
    material: "SmoothPlastic",
    physics: {
      anchored: true,
      canCollide: true,
      canTouch: false,
      canQuery: true,
    },
    behavior: { kind: "spawn" },
  };

  const obstacles: GameplayObject[] = [...spec.obstacles]
    .sort((left, right) => left.order - right.order)
    .map((obstacle) => ({
      id: obstacle.id,
      order: obstacle.order,
      role: obstacle.role,
      className: classFor(obstacle.role, obstacle.shape),
      shape: obstacle.shape,
      transform: obstacle.transform,
      size: obstacle.size,
      color: colorFor(spec, obstacle.colorSlot),
      colorRole: obstacle.colorSlot,
      material: obstacle.material,
      physics: {
        anchored: true,
        canCollide: true,
        canTouch: ["checkpoint", "kill", "finish"].includes(obstacle.role),
        canQuery: true,
      },
      behavior: behaviorFor(obstacle, checkpointOrderById),
    }));

  const gameplayObjects = [
    spawn,
    ...obstacles,
  ] as SceneManifest["layers"]["gameplay"]["objects"];
  const orderedStages = [...spec.stages].sort(
    (left, right) => left.order - right.order,
  );
  const safeRouteObjectIds = orderedStages.flatMap(
    (stage) => stage.routeObstacleIds,
  ) as SceneManifest["navigation"]["safeRouteObjectIds"];
  const routeEntries = orderedStages.flatMap((stage) =>
    stage.routeObstacleIds.map((objectId, stageIndex) => ({
      objectId,
      routeOrder: safeRouteObjectIds.indexOf(objectId) + 1,
      stageId: stage.id,
      stageRouteOrder: stageIndex + 1,
    })),
  ) as SceneManifest["navigation"]["routeEntries"];
  const provisional: SceneManifest = {
    schemaVersion: "0.2",
    generatorVersion: GENERATOR_VERSION,
    sceneId: `${spec.specId}-scene`,
    sourceSpecId: spec.specId,
    sourceSpecHash: sha256(spec),
    seed: spec.seed,
    manifestHash: MANIFEST_HASH_PLACEHOLDER,
    coordinateSystem: {
      units: "studs",
      handedness: "right-handed",
      upAxis: "+Y",
      forwardAxis: "-Z",
      rotationUnit: "degrees",
      rotationOrder: "XYZ",
    },
    worldBounds: boundsFor(gameplayObjects),
    navigation: {
      coarseReachability: spec.coarseReachability,
      characterPlacement: spec.characterPlacement,
      stages: orderedStages.map((stage) => ({
        id: stage.id,
        order: stage.order,
        safeRouteObjectIds: stage.routeObstacleIds,
      })) as SceneManifest["navigation"]["stages"],
      safeRouteObjectIds,
      routeEntries,
    },
    layers: {
      gameplay: { objects: gameplayObjects },
      decorative: { objects: [] },
    },
  };

  const manifest: SceneManifest = {
    ...provisional,
    manifestHash: computeManifestHash(provisional),
  };
  return assertValidSceneManifest(manifest);
}

export { compilePlaceSpecV03, GENERATOR_VERSION_V03 } from "./v03.js";
