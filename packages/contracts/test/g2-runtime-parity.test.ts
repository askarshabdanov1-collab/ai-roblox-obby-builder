import { readdir, readFile } from "node:fs/promises";

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
      "wedge",
      "decorative",
      "replacement-b",
      "maximum-parts",
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

  it("keeps G2c construction isolated from behavior and G2d activation", async () => {
    const runtimeDirectory = "roblox/src/ReplicatedStorage/ObbyRuntime";
    const g2cModules = [
      "BuildPlanV03.luau",
      "NativePartFactoryV03.luau",
      "SceneBuilderCoreV03.luau",
    ];
    const forbiddenBehaviorTokens = [
      "Touched",
      "CharacterAdded",
      ":Connect(",
      "task.wait",
      "task.spawn",
      "wait(",
    ];
    for (const module of g2cModules) {
      const source = await readFile(`${runtimeDirectory}/${module}`, "utf8");
      for (const token of forbiddenBehaviorTokens)
        expect(source, `${module} contains ${token}`).not.toContain(token);
    }

    const planSource = await readFile(
      `${runtimeDirectory}/BuildPlanV03.luau`,
      "utf8",
    );
    expect(planSource).not.toContain("Instance.new");
    expect(planSource).not.toContain("workspace");

    for (const module of g2cModules) {
      const source = await readFile(`${runtimeDirectory}/${module}`, "utf8");
      expect(source).not.toContain('require("./RuntimeSessionV03")');
      expect(source).not.toContain('require("./BuilderV03")');
    }
  });

  it("uses only Roblox Instance members in production destroyed-state checks", async () => {
    const runtimeDirectory = "roblox/src/ReplicatedStorage/ObbyRuntime";
    const runtimeModules = (await readdir(runtimeDirectory)).filter((name) =>
      name.endsWith(".luau"),
    );
    const destroyedMemberRead = /\.Destroyed\b|\[\s*["']Destroyed["']\s*\]/u;

    for (const module of runtimeModules) {
      const source = await readFile(`${runtimeDirectory}/${module}`, "utf8");
      expect(
        destroyedMemberRead.test(source),
        `${module} reads the fake-only Destroyed member`,
      ).toBe(false);
    }
  });

  it("keeps replacement runtime validation compatible with real Workspace Instances", async () => {
    const core = await readFile(
      "roblox/src/ReplicatedStorage/ObbyRuntime/SceneBuilderCoreV03.luau",
      "utf8",
    );
    expect(core).not.toMatch(/type\(workspace\)\s*[~=]=\s*["']table["']/u);
    expect(core).toContain("commit-runtime-workspace");
    expect(core).toContain("commit-runtime-current-root");
    expect(core).toContain("commit-runtime-manifest");
    expect(core).toContain("commit-runtime-session");

    const bootstrap = await readFile(
      "roblox/g2e/G2eAcceptanceBootstrap.server.luau",
      "utf8",
    );
    expect(bootstrap).toContain("[G2 acceptance diagnostic]");
    expect(bootstrap).toContain("buildError.field");
  });

  it("keeps G2e observation emission on validated bounded collections", async () => {
    const harness = await readFile(
      "roblox/g2e/G2eAcceptanceHarness.luau",
      "utf8",
    );
    const observation = await readFile(
      "roblox/g2e/G2eObservationV03.luau",
      "utf8",
    );
    expect(observation).toContain("reachability.requiredTransitions");
    expect(harness).not.toContain("manifest.navigation.requiredTransitions");
    expect(harness).toContain("G2eObservationV03.orderedRecords");

    const project = await readFile("roblox/g2e-smoke.project.json", "utf8");
    expect(project).toContain("G2eObservationV03");
  });

  it("keeps G2d opt-in and excludes later-phase integrations", async () => {
    const runtimeDirectory = "roblox/src/ReplicatedStorage/ObbyRuntime";
    const bootstrap = await readFile(
      "roblox/src/ServerScriptService/ObbyBootstrap.server.luau",
      "utf8",
    );
    expect(bootstrap).not.toContain("BuilderV03");
    expect(bootstrap).not.toContain("RuntimeSessionV03");
    expect(bootstrap).not.toContain("G2ReferenceManifestV03");

    const defaultProject = await readFile(
      "roblox/default.project.json",
      "utf8",
    );
    expect(defaultProject).toContain("VerticalSliceManifest");
    expect(defaultProject).not.toContain("G2ReferenceManifestV03");

    const runtimeModules = await readdir(runtimeDirectory);
    expect(runtimeModules).toContain("RuntimeSessionV03.luau");
    expect(runtimeModules).toContain("BuilderV03.luau");
    for (const deferred of [
      "StudioAcceptanceV03.luau",
      "RuntimeSelectorV03.luau",
      "BuilderV04.luau",
    ])
      expect(runtimeModules).not.toContain(deferred);

    for (const module of ["RuntimeSessionV03.luau", "BuilderV03.luau"]) {
      const source = await readFile(`${runtimeDirectory}/${module}`, "utf8");
      for (const forbidden of [
        "HttpService",
        "GetAsync",
        "PostAsync",
        "os.clock",
        "os.time",
        "math.random",
      ])
        expect(source, `${module} contains ${forbidden}`).not.toContain(
          forbidden,
        );
    }
  });

  it("isolates the G2e Studio acceptance project from the default 0.2 path", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["roblox:g2e:build"]).toBe(
      "tsx tools/prepare-build.ts && rojo build roblox/g2e-smoke.project.json --output build/G2eStudioAcceptance.rbxlx",
    );

    const project = await readFile("roblox/g2e-smoke.project.json", "utf8");
    expect(project).toContain("G2eAcceptanceBootstrap");
    expect(project).toContain("G2ReferenceManifestV03");
    expect(project).toContain("G2Maximum50ManifestV03");
    expect(project).toContain("G2ZeroCheckpointManifestV03");
    expect(project).not.toContain("ObbyBootstrap.server.luau");
    expect(project).not.toContain("VerticalSliceManifest.luau");

    const bootstrap = await readFile(
      "roblox/g2e/G2eAcceptanceBootstrap.server.luau",
      "utf8",
    );
    expect(bootstrap).toContain("BuilderV03");
    expect(bootstrap).toContain("G2eAcceptanceHarness");
    expect(bootstrap).toContain("G2ReferenceManifestV03");
    expect(bootstrap).not.toContain("Builder.build");
    expect(bootstrap).not.toContain("HttpService");

    const defaultProject = await readFile(
      "roblox/default.project.json",
      "utf8",
    );
    const defaultBootstrap = await readFile(
      "roblox/src/ServerScriptService/ObbyBootstrap.server.luau",
      "utf8",
    );
    expect(defaultProject).not.toContain("G2eAcceptance");
    expect(defaultProject).not.toContain("G2ReferenceManifestV03");
    expect(defaultBootstrap).not.toContain("BuilderV03");
  });
});
