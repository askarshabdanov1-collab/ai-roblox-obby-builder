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
import { emitManifestModuleV03 } from "@obby/roblox-emitter";
import { describe, expect, it } from "vitest";

import { projectLayoutBundle } from "../src/index.js";

describe("full G0 to Luau G1c reference fixture", () => {
  it("matches every checked-in deterministic artifact", async () => {
    const root = new URL("../../../", import.meta.url);
    const source = JSON.parse(
      await readFile(
        new URL(
          "examples/layout/reference/source-generation-bundle.json",
          root,
        ),
        "utf8",
      ),
    ) as unknown;
    const layout = JSON.parse(
      await readFile(
        new URL("examples/layout/reference/layout-bundle.json", root),
        "utf8",
      ),
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
    const expectedPlace = await readFile(
      new URL(
        "examples/layout-projection/reference/place-spec-v0.3.json",
        root,
      ),
      "utf8",
    );
    const expectedManifest = await readFile(
      new URL(
        "examples/layout-projection/reference/scene-manifest-v0.3.json",
        root,
      ),
      "utf8",
    );
    const expectedLuau = await readFile(
      new URL("roblox/generated/G1cReferenceManifest.luau", root),
      "utf8",
    );
    expect(`${canonicalStringify(place)}\n`).toBe(expectedPlace);
    expect(`${canonicalStringify(manifest)}\n`).toBe(expectedManifest);
    expect(emitManifestModuleV03(manifest)).toBe(expectedLuau);
  });
});
