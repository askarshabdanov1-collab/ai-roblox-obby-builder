import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  placeSpecV03Schema,
  sceneManifestV03Schema,
  validatePlaceSpec,
  validatePlaceSpecV03,
  validateSceneManifestV03,
} from "../src/index.js";

describe("side-by-side downstream contract versions", () => {
  it("keeps the legacy 0.2 fixture exclusively on the legacy validator", async () => {
    const legacy = JSON.parse(
      await readFile(
        new URL(
          "../../../examples/vertical-slice/place-spec.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    expect(validatePlaceSpec(legacy).ok).toBe(true);
    expect(validatePlaceSpecV03(legacy).ok).toBe(false);
  });

  it("declares the approved 0.3 stage, checkpoint, and version boundaries", () => {
    expect(placeSpecV03Schema.properties.schemaVersion.const).toBe("0.3");
    expect(placeSpecV03Schema.properties.stages.minItems).toBe(5);
    expect(placeSpecV03Schema.properties.stages.maxItems).toBe(50);
    expect(
      placeSpecV03Schema.properties.checkpointPlan.properties
        .checkpointObjectIds.minItems,
    ).toBe(0);
    expect(sceneManifestV03Schema.properties.schemaVersion.const).toBe("0.3");
    expect(
      sceneManifestV03Schema.$defs.navigation.properties.stages.maxItems,
    ).toBe(50);
  });

  it("fails closed when incomplete records claim version 0.3", () => {
    expect(validatePlaceSpecV03({ schemaVersion: "0.3" }).ok).toBe(false);
    expect(validateSceneManifestV03({ schemaVersion: "0.3" }).ok).toBe(false);
  });
});
