import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { emitManifestModuleV03 } from "@obby/roblox-emitter";

import { validateSceneManifestV03 } from "../src/index.js";

type FixtureIndex = {
  readonly schemaVersion: "0.1";
  readonly owner: string;
  readonly fixtures: readonly {
    readonly fixtureId: string;
    readonly jsonPath: string;
    readonly modulePath: string;
    readonly manifestHash: string;
    readonly stageCount: number;
    readonly checkpointCount: number;
  }[];
};

describe("G2 TypeScript/Luau shared valid fixtures", () => {
  it("validates every shared manifest and exact Luau transport", async () => {
    const index = JSON.parse(
      await readFile("examples/g2-runtime/fixture-index.json", "utf8"),
    ) as FixtureIndex;
    expect(index.schemaVersion).toBe("0.1");
    expect(index.owner).toBe("g2-runtime-fixture-content-v1");
    expect(index.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      "reference",
      "minimum-zero-checkpoint",
      "boundary-20",
      "boundary-21",
      "maximum-50",
      "maximum-checkpoints",
    ]);
    for (const fixture of index.fixtures) {
      const manifest = JSON.parse(
        await readFile(fixture.jsonPath, "utf8"),
      ) as unknown;
      const validation = validateSceneManifestV03(manifest);
      expect(validation.ok, fixture.fixtureId).toBe(true);
      if (!validation.ok) continue;
      expect(validation.value.manifestHash).toBe(fixture.manifestHash);
      expect(validation.value.navigation.stages).toHaveLength(
        fixture.stageCount,
      );
      expect(validation.value.navigation.checkpointObjectIds).toHaveLength(
        fixture.checkpointCount,
      );
      expect(await readFile(fixture.modulePath, "utf8")).toBe(
        emitManifestModuleV03(validation.value),
      );
    }
  }, 30_000);

  it("covers zero and maximum checkpoints plus 20/21/50 stages", async () => {
    const index = JSON.parse(
      await readFile("examples/g2-runtime/fixture-index.json", "utf8"),
    ) as FixtureIndex;
    expect(
      index.fixtures.some((fixture) => fixture.checkpointCount === 0),
    ).toBe(true);
    expect(
      index.fixtures.some((fixture) => fixture.checkpointCount === 49),
    ).toBe(true);
    for (const stageCount of [20, 21, 50])
      expect(
        index.fixtures.some((fixture) => fixture.stageCount === stageCount),
      ).toBe(true);
  });

  it("keeps G2b admission isolated from Roblox scene APIs", async () => {
    const modules = [
      "ManifestAdmissionV03.luau",
      "ManifestIndexesV03.luau",
      "ManifestLoaderV03.luau",
      "ManifestSnapshotV03.luau",
      "ManifestValidatorV03.luau",
    ];
    const forbidden = [
      "Instance.new",
      "workspace",
      "game:GetService",
      "game.FindService",
    ];
    for (const module of modules) {
      const source = await readFile(
        `roblox/src/ReplicatedStorage/ObbyRuntime/${module}`,
        "utf8",
      );
      for (const token of forbidden)
        expect(source, `${module} contains ${token}`).not.toContain(token);
    }
  });
});
