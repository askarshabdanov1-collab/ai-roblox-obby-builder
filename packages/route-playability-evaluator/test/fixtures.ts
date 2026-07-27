import { readFileSync } from "node:fs";

import { computeManifestHash, type SceneManifest } from "@obby/contracts";

const fixtureUrl = new URL(
  "../../../examples/vertical-slice/scene-manifest.json",
  import.meta.url,
);

export function manifestFixture(): SceneManifest {
  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as SceneManifest;
}

export function requiredFixture<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`fixture ${name} is missing`);
  return value;
}

export function rehashManifest(manifest: SceneManifest): SceneManifest {
  manifest.manifestHash = computeManifestHash(manifest);
  return manifest;
}

export function shuffledManifestFixture(): SceneManifest {
  const manifest = manifestFixture();
  manifest.layers.gameplay.objects.reverse();
  manifest.layers.decorative.objects.reverse();
  manifest.navigation.stages.reverse();
  manifest.navigation.routeEntries.reverse();
  return manifest;
}

export function twoCheckpointManifest(): SceneManifest {
  const manifest = manifestFixture();
  const finish = manifest.layers.gameplay.objects.find(
    (object) => object.role === "finish",
  );
  if (finish === undefined) throw new Error("fixture finish is missing");
  const checkpoint = structuredClone(
    manifest.layers.gameplay.objects.find(
      (object) => object.role === "checkpoint",
    ),
  );
  if (checkpoint === undefined)
    throw new Error("fixture checkpoint is missing");
  checkpoint.id = "Checkpoint02";
  checkpoint.behavior.checkpointOrder = 2;
  checkpoint.transform.position = { x: 0, y: 11, z: 53 };
  const kill = manifest.layers.gameplay.objects.find(
    (object) => object.role === "kill",
  );
  const safe = manifest.layers.gameplay.objects.filter(
    (object) =>
      object.role !== "spawn" &&
      object.role !== "kill" &&
      object.role !== "finish",
  );
  manifest.layers.gameplay.objects = [
    requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "spawn",
      ),
      "spawn",
    ),
    ...safe,
    checkpoint,
    ...(kill === undefined ? [] : [kill]),
    finish,
  ] as unknown as SceneManifest["layers"]["gameplay"]["objects"];
  manifest.layers.gameplay.objects.forEach((object, index) => {
    object.order = index;
  });
  manifest.navigation.safeRouteObjectIds = [
    "JumpPlatform01",
    "Checkpoint01",
    "WedgeClimb01",
    "Checkpoint02",
    "FinishPlatform",
  ];
  manifest.navigation.stages = [
    {
      id: "tower-entry",
      order: 1,
      safeRouteObjectIds: ["JumpPlatform01", "Checkpoint01", "WedgeClimb01"],
    },
    {
      id: "tower-finish",
      order: 2,
      safeRouteObjectIds: ["Checkpoint02", "FinishPlatform"],
    },
  ];
  manifest.navigation.routeEntries = manifest.navigation.safeRouteObjectIds.map(
    (objectId, index) => ({
      objectId,
      routeOrder: index + 1,
      stageId: index < 3 ? "tower-entry" : "tower-finish",
      stageRouteOrder: index < 3 ? index + 1 : index - 2,
    }),
  ) as SceneManifest["navigation"]["routeEntries"];
  return rehashManifest(manifest);
}
