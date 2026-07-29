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
import { compilePlaceSpecV03 } from "@obby/obby-compiler";
import { describe, expect, it } from "vitest";

import { emitManifestModuleV03 } from "../src/index.js";

function manifest() {
  const source = generateObby({
    schemaVersion: "0.1",
    requestId: "g1c-emitter-test",
    workingName: "G1c emitter test",
    genre: "obby",
    theme: "jungle",
    stageCount: 5,
    difficulty: "easy",
    checkpointFrequency: 5,
    assetPolicy: "native-parts-only",
    seed: 5,
  });
  const layout = generateLayout(
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
  return compilePlaceSpecV03(
    projectLayoutBundle(
      layout,
      source,
      DEFAULT_GENERATOR_CONFIGURATION,
      DEFAULT_MECHANIC_CATALOG,
      DEFAULT_LAYOUT_CONFIGURATION,
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    ),
  );
}

describe("SceneManifest 0.3 Luau transport", () => {
  it("emits deterministic validation-only Luau bytes", () => {
    const value = manifest();
    const first = emitManifestModuleV03(value);
    expect(emitManifestModuleV03(structuredClone(value))).toBe(first);
    expect(first).toContain("SceneManifest 0.3 validation transport");
    expect(first).toContain(`["schemaVersion"] = "0.3"`);
    expect(first).toContain(`["manifestHash"] = "${value.manifestHash}"`);
  });

  it("rejects an unvalidated or stale manifest", () => {
    const value = structuredClone(manifest());
    value.navigation.safeRouteObjectIds.reverse();
    expect(() => emitManifestModuleV03(value)).toThrow();
  });
});
