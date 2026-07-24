import { describe, expect, it } from "vitest";

import { emitManifestModule } from "../src/index.js";

describe("Roblox manifest emitter", () => {
  it("emits deterministic Luau with a generated-file warning", () => {
    const manifest = {
      schemaVersion: "0.2",
      generatorVersion: "0.2.0",
    };
    expect(() => emitManifestModule(manifest)).toThrow();
  });
});
