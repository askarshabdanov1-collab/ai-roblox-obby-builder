import { readFile } from "node:fs/promises";

import { canonicalStringify, sha256 } from "@obby/canonical-json";
import { validateSceneManifest } from "@obby/contracts";
import { describe, expect, it } from "vitest";

import { compilePlaceSpec, GENERATOR_VERSION } from "../src/index.js";

const fixtureUrl = new URL(
  "../../../examples/vertical-slice/place-spec.json",
  import.meta.url,
);

async function fixture(): Promise<unknown> {
  return JSON.parse(await readFile(fixtureUrl, "utf8")) as unknown;
}

describe("deterministic compiler", () => {
  it("produces byte-identical manifests and stable hashes", async () => {
    const input = await fixture();
    const first = compilePlaceSpec(input);
    const second = compilePlaceSpec(structuredClone(input));

    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.generatorVersion).toBe(GENERATOR_VERSION);
    expect(first.sourceSpecHash).toBe(sha256(input));
    expect(validateSceneManifest(first).ok).toBe(true);
  });

  it("orders stable native gameplay objects", async () => {
    const manifest = compilePlaceSpec(await fixture());
    expect(manifest.layers.gameplay.objects.map(({ id }) => id)).toEqual([
      "Spawn",
      "JumpPlatform01",
      "Checkpoint01",
      "WedgeClimb01",
      "KillFloor",
      "FinishPlatform",
    ]);
    expect(manifest.layers.decorative.objects).toEqual([]);
  });

  it("preserves byte-stable stage and safe-route topology without hazards", async () => {
    const first = compilePlaceSpec(await fixture());
    const second = compilePlaceSpec(await fixture());
    expect(canonicalStringify(first.navigation)).toBe(
      canonicalStringify(second.navigation),
    );
    expect(first.navigation.stages).toEqual([
      {
        id: "tower-entry",
        order: 1,
        safeRouteObjectIds: [
          "JumpPlatform01",
          "Checkpoint01",
          "WedgeClimb01",
          "FinishPlatform",
        ],
      },
    ]);
    expect(first.navigation.safeRouteObjectIds).not.toContain("KillFloor");
    expect(first.navigation.routeEntries).toEqual([
      {
        objectId: "JumpPlatform01",
        routeOrder: 1,
        stageId: "tower-entry",
        stageRouteOrder: 1,
      },
      {
        objectId: "Checkpoint01",
        routeOrder: 2,
        stageId: "tower-entry",
        stageRouteOrder: 2,
      },
      {
        objectId: "WedgeClimb01",
        routeOrder: 3,
        stageId: "tower-entry",
        stageRouteOrder: 3,
      },
      {
        objectId: "FinishPlatform",
        routeOrder: 4,
        stageId: "tower-entry",
        stageRouteOrder: 4,
      },
    ]);
    expect(first.navigation.coarseReachability).toEqual({
      model: "axis-aligned-surfaces-v1",
      avatarRig: "R15-default",
      walkSpeed: 16,
      jumpPower: 50,
      maxHorizontalGap: 6,
      maxVerticalRise: 5,
      maxDownwardDrop: 20,
    });
  });
});
