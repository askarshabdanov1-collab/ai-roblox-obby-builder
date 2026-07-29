import { readFile } from "node:fs/promises";

import {
  computeSceneManifestV03Hash,
  validateSceneManifestV03,
} from "@obby/contracts";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "@obby/obby-layout-engine";
import { projectLayoutBundle } from "@obby/obby-layout-projector";
import { describe, expect, it } from "vitest";

import { compilePlaceSpec, compilePlaceSpecV03 } from "../src/index.js";

function placeSpec(stageCount = 5, checkpointFrequency = 5) {
  const source = generateObby({
    schemaVersion: "0.1",
    requestId: "g1c-compiler-test",
    workingName: "G1c compiler test",
    genre: "obby",
    theme: "space",
    stageCount,
    difficulty: "medium",
    checkpointFrequency,
    assetPolicy: "native-parts-only",
    seed: 731,
  });
  const layout = generateLayout(
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
  return projectLayoutBundle(
    layout,
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
}

describe("PlaceSpec 0.3 compiler", () => {
  it("compiles a validated manifest while retaining provenance and evidence", () => {
    const spec = placeSpec();
    const manifest = compilePlaceSpecV03(spec);
    expect(validateSceneManifestV03(manifest)).toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(manifest.sourcePlaceSpecHash).toBe(spec.placeSpecHash);
    expect(manifest.provenance).toEqual(spec.provenance);
    expect(manifest.worldBounds).toEqual(spec.worldBounds);
    expect(manifest.navigation.reachability).toEqual(spec.reachability);
    expect(manifest.manifestHash).toBe(computeSceneManifestV03Hash(manifest));
  });

  it("preserves exact route and object order through 50 stages", () => {
    const spec = placeSpec(50, 5);
    const manifest = compilePlaceSpecV03(spec);
    expect(manifest.navigation.stages).toHaveLength(50);
    expect(manifest.navigation.safeRouteObjectIds).toEqual(
      spec.route.orderedObjectIds,
    );
    expect(manifest.layers.gameplay.objects.map((object) => object.id)).toEqual(
      spec.objects.map((object) => object.id),
    );
  });

  it("retains an empty checkpoint sequence without a sentinel", () => {
    const manifest = compilePlaceSpecV03(placeSpec(5, 5));
    expect(manifest.navigation.checkpointObjectIds).toEqual([]);
    expect(
      manifest.layers.gameplay.objects.some(
        (object) => object.behavior.kind === "checkpoint",
      ),
    ).toBe(false);
  });

  it("fails closed on stale PlaceSpec content", () => {
    const stale = structuredClone(placeSpec());
    stale.objects[0].transform.position.x += 1;
    expect(() => compilePlaceSpecV03(stale)).toThrow();
  });

  it("leaves the existing 0.2 compiler independently valid", async () => {
    const legacy = JSON.parse(
      await readFile(
        new URL(
          "../../../examples/vertical-slice/place-spec.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    expect(compilePlaceSpec(legacy).schemaVersion).toBe("0.2");
  });
});
