import { readFile } from "node:fs/promises";

import { canonicalStringify } from "@obby/canonical-json";
import { compilePlaceSpecV03 } from "@obby/obby-compiler";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
} from "@obby/obby-generator";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
} from "@obby/obby-layout-engine";
import { projectLayoutBundle } from "@obby/obby-layout-projector";
import { emitManifestModuleV03 } from "@obby/roblox-emitter";

export const layoutProjectionFixturePaths = {
  placeSpec: "examples/layout-projection/reference/place-spec-v0.3.json",
  sceneManifest:
    "examples/layout-projection/reference/scene-manifest-v0.3.json",
  robloxManifest: "roblox/generated/G1cReferenceManifest.luau",
} as const;

export async function expectedLayoutProjectionFixtures(): Promise<
  Record<string, string>
> {
  const source = JSON.parse(
    await readFile(
      "examples/layout/reference/source-generation-bundle.json",
      "utf8",
    ),
  ) as unknown;
  const layout = JSON.parse(
    await readFile("examples/layout/reference/layout-bundle.json", "utf8"),
  ) as unknown;
  const place = projectLayoutBundle(
    layout,
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
  const manifest = compilePlaceSpecV03(place);
  return {
    [layoutProjectionFixturePaths.placeSpec]: `${canonicalStringify(place)}\n`,
    [layoutProjectionFixturePaths.sceneManifest]: `${canonicalStringify(manifest)}\n`,
    [layoutProjectionFixturePaths.robloxManifest]:
      emitManifestModuleV03(manifest),
  };
}
