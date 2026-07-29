import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const sourceFiles = [
  "authorities.ts",
  "generate.ts",
  "index.ts",
  "packing.ts",
  "reachability.ts",
  "recipes.ts",
  "seed.ts",
  "types.ts",
  "work-admission.ts",
];

describe("G1b integration boundaries", () => {
  it("keeps the engine free of publication, downstream projection, Roblox, and network APIs", async () => {
    const sources = await Promise.all(
      sourceFiles.map((name) =>
        readFile(new URL(`../src/${name}`, import.meta.url), "utf8"),
      ),
    );
    const combined = sources.join("\n");
    for (const forbidden of [
      "node:fs",
      "node:http",
      "node:https",
      "fetch(",
      "@obby/obby-compiler",
      "@obby/roblox-emitter",
      "PlaceSpec",
      "SceneManifest",
      "game:GetService",
      "Instance.new",
      ".rbxl",
    ])
      expect(combined).not.toContain(forbidden);
  });
});
