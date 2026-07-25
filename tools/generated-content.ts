import { readFile } from "node:fs/promises";

import { canonicalStringify } from "@obby/canonical-json";
import { compilePlaceSpec } from "@obby/obby-compiler";
import { emitManifestModule } from "@obby/roblox-emitter";
import { compileFromFile } from "json-schema-to-typescript";

export const generatedPaths = {
  placeSpecType: "packages/contracts/src/generated/place-spec.ts",
  sceneManifestType: "packages/contracts/src/generated/scene-manifest.ts",
  sceneManifestFixture: "examples/vertical-slice/scene-manifest.json",
  robloxManifest: "roblox/generated/VerticalSliceManifest.luau",
} as const;

const placeSpecSchemaPath = "packages/contracts/schemas/place-spec.schema.json";
const sceneManifestSchemaPath =
  "packages/contracts/schemas/scene-manifest.schema.json";
const placeSpecFixturePath = "examples/vertical-slice/place-spec.json";

const typeOptions = {
  bannerComment: "/* Generated from the matching JSON Schema. Do not edit. */",
  maxItems: -1,
} as const;

export async function expectedContractTypes(): Promise<Record<string, string>> {
  return {
    [generatedPaths.placeSpecType]: await compileFromFile(
      placeSpecSchemaPath,
      typeOptions,
    ),
    [generatedPaths.sceneManifestType]: await compileFromFile(
      sceneManifestSchemaPath,
      typeOptions,
    ),
  };
}

export async function expectedFixtureArtifacts(): Promise<
  Record<string, string>
> {
  const placeSpec = JSON.parse(
    await readFile(placeSpecFixturePath, "utf8"),
  ) as unknown;
  const manifest = compilePlaceSpec(placeSpec);
  return {
    [generatedPaths.sceneManifestFixture]: `${canonicalStringify(manifest)}\n`,
    [generatedPaths.robloxManifest]: emitManifestModule(manifest),
  };
}
