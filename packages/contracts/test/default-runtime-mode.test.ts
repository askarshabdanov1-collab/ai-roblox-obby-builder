import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type StringValueNode = {
  readonly $className: "StringValue";
  readonly $properties: { readonly Value: string };
};

type RuntimeProject = {
  readonly tree: {
    readonly ReplicatedStorage: {
      readonly ObbyRuntime: { readonly $path: string };
    };
    readonly ServerScriptService: Record<string, { readonly $path: string }>;
    readonly ServerStorage: {
      readonly RuntimeConfiguration: {
        readonly Version: StringValueNode;
        readonly ExecutionMode: StringValueNode;
        readonly ExpectedManifestHash: StringValueNode;
      };
      readonly GeneratedManifests: Record<
        string,
        { readonly $path?: string } | string
      >;
      readonly G2eBuildProvenance?: { readonly $path: string };
      readonly G2eManifests?: Record<
        string,
        { readonly $path?: string } | string
      >;
    };
  };
};

const acceptedHash =
  "sha256:606e679659ba1461ba1baaa87f1f10bf7953dfc071da40ebaa6d39c2caa62146";

async function readProject(path: string): Promise<RuntimeProject> {
  return JSON.parse(await readFile(path, "utf8")) as RuntimeProject;
}

describe("default SceneManifest runtime execution modes", () => {
  it("keeps production on accepted 0.3 and excludes the acceptance harness", async () => {
    const project = await readProject("roblox/default.project.json");
    const configuration = project.tree.ServerStorage.RuntimeConfiguration;

    expect(configuration.Version.$properties.Value).toBe("0.3");
    expect(configuration.ExecutionMode.$properties.Value).toBe("production");
    expect(configuration.ExpectedManifestHash.$properties.Value).toBe(
      acceptedHash,
    );
    expect(project.tree.ServerScriptService).toEqual({
      ObbyBootstrap: {
        $path: "src/ServerScriptService/ObbyBootstrap.server.luau",
      },
    });
    expect(project.tree.ServerStorage.GeneratedManifests).toMatchObject({
      VerticalSliceManifest: {
        $path: "generated/VerticalSliceManifest.luau",
      },
      G2ReferenceManifestV03: {
        $path: "generated/G2ReferenceManifestV03.luau",
      },
    });
  });

  it("builds acceptance from the same default runtime, reference, and hash", async () => {
    const production = await readProject("roblox/default.project.json");
    const acceptance = await readProject(
      "roblox/default-studio-acceptance.project.json",
    );
    const productionConfiguration =
      production.tree.ServerStorage.RuntimeConfiguration;
    const acceptanceConfiguration =
      acceptance.tree.ServerStorage.RuntimeConfiguration;

    expect(acceptanceConfiguration.Version.$properties.Value).toBe(
      productionConfiguration.Version.$properties.Value,
    );
    expect(acceptanceConfiguration.ExecutionMode.$properties.Value).toBe(
      "studio-acceptance",
    );
    expect(acceptanceConfiguration.ExpectedManifestHash.$properties.Value).toBe(
      productionConfiguration.ExpectedManifestHash.$properties.Value,
    );
    expect(acceptanceConfiguration.ExpectedManifestHash.$properties.Value).toBe(
      acceptedHash,
    );
    expect(acceptance.tree.ReplicatedStorage).toEqual(
      production.tree.ReplicatedStorage,
    );
    expect(acceptance.tree.ServerStorage.GeneratedManifests).toEqual(
      production.tree.ServerStorage.GeneratedManifests,
    );
    expect(acceptance.tree.ServerScriptService.ObbyBootstrap).toEqual(
      production.tree.ServerScriptService.ObbyBootstrap,
    );
    expect(acceptance.tree.ServerScriptService).toMatchObject({
      G2eAcceptanceBootstrap: {
        $path: "g2e/G2eAcceptanceBootstrap.server.luau",
      },
      G2eAcceptanceHarness: { $path: "g2e/G2eAcceptanceHarness.luau" },
    });
    expect(Object.keys(acceptance.tree.ServerScriptService).sort()).toEqual([
      "G2eAcceptanceBootstrap",
      "G2eAcceptanceHarness",
      "G2eAcceptanceRecordsV1",
      "G2eCharacterPartReadinessV1",
      "G2eControlProtocol",
      "G2eGameplayObservationV03",
      "G2eObservationV03",
      "G2ePlacementCaptureV1",
      "ObbyBootstrap",
    ]);
    expect(acceptance.tree.ServerStorage.G2eBuildProvenance?.$path).toBe(
      "../build/g2e-provenance/G2eBuildProvenance.luau",
    );
    expect(acceptance.tree.ServerStorage.G2eManifests).toMatchObject({
      G2Maximum50ManifestV03: {
        $path: "generated/G2Maximum50ManifestV03.luau",
      },
      G2ZeroCheckpointManifestV03: {
        $path: "generated/G2ZeroCheckpointManifestV03.luau",
      },
      G2ReplacementManifestV03: {
        $path: "generated/G2ReplacementManifestV03.luau",
      },
      G2WedgeManifestV03: {
        $path: "generated/G2WedgeManifestV03.luau",
      },
      G2DecorativeManifestV03: {
        $path: "generated/G2DecorativeManifestV03.luau",
      },
    });
  });

  it("selects production auto-build or zero-root acceptance fail closed", async () => {
    const bootstrap = await readFile(
      "roblox/src/ServerScriptService/ObbyBootstrap.server.luau",
      "utf8",
    );
    const acceptanceBootstrap = await readFile(
      "roblox/g2e/G2eAcceptanceBootstrap.server.luau",
      "utf8",
    );

    expect(bootstrap).toContain("RuntimeSelector.resolve");
    expect(bootstrap).toContain('selection.executionMode == "production"');
    expect(bootstrap).toContain("Builder.build(manifest, Workspace)");
    expect(bootstrap).toContain(
      "builder:build(manifestModule, runtimeConfiguration.ExpectedManifestHash.Value)",
    );
    expect(bootstrap).toContain(
      'selection.executionMode == "studio-acceptance"',
    );
    expect(bootstrap).toContain(
      "Studio acceptance mode ready with zero automatic builds",
    );
    expect(acceptanceBootstrap).toContain("RuntimeSelector.resolve");
    expect(acceptanceBootstrap).toContain(
      "defaultManifests.G2ReferenceManifestV03",
    );
    expect(acceptanceBootstrap).toContain(
      "runtimeConfiguration.ExpectedManifestHash.Value",
    );
    expect(acceptanceBootstrap.indexOf("RuntimeSelector.resolve")).toBeLessThan(
      acceptanceBootstrap.indexOf("G2eAcceptanceHarness.bindControl"),
    );
    expect(acceptanceBootstrap).toMatch(
      /G2eAcceptanceHarness\.bindControl\(api\)\s+local precondition = G2eAcceptanceHarness\.emitPrecondition/,
    );
    expect(acceptanceBootstrap).toContain(
      "Controls ready with zero active roots",
    );
  });

  it("keeps the historical isolated smoke project separate", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      readonly scripts?: Record<string, string>;
    };
    const isolated = await readProject("roblox/g2e-smoke.project.json");

    expect(packageJson.scripts?.["roblox:g2e:build"]).toContain(
      "roblox/g2e-smoke.project.json",
    );
    expect(packageJson.scripts?.["roblox:default-acceptance:build"]).toBe(
      "tsx tools/prepare-g2e-build.ts && rojo build roblox/default-studio-acceptance.project.json --output build/AIObbyBuilderDefaultStudioAcceptance.rbxlx",
    );
    expect(isolated.tree.ServerScriptService).not.toHaveProperty(
      "ObbyBootstrap",
    );
  });
});
