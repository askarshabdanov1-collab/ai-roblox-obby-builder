import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@obby/canonical-json": fileURLToPath(
        new URL("./packages/canonical-json/src/index.ts", import.meta.url),
      ),
      "@obby/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@obby/geometry-evaluator": fileURLToPath(
        new URL("./packages/geometry-evaluator/src/index.ts", import.meta.url),
      ),
      "@obby/obby-compiler": fileURLToPath(
        new URL("./packages/obby-compiler/src/index.ts", import.meta.url),
      ),
      "@obby/obby-evaluator-contracts": fileURLToPath(
        new URL(
          "./packages/obby-evaluator-contracts/src/index.ts",
          import.meta.url,
        ),
      ),
      "@obby/obby-generator-contracts": fileURLToPath(
        new URL(
          "./packages/obby-generator-contracts/src/index.ts",
          import.meta.url,
        ),
      ),
      "@obby/obby-generator": fileURLToPath(
        new URL("./packages/obby-generator/src/index.ts", import.meta.url),
      ),
      "@obby/generator-cli": fileURLToPath(
        new URL("./apps/generator-cli/src/index.ts", import.meta.url),
      ),
      "@obby/roblox-emitter": fileURLToPath(
        new URL("./packages/roblox-emitter/src/index.ts", import.meta.url),
      ),
      "@obby/route-playability-evaluator": fileURLToPath(
        new URL(
          "./packages/route-playability-evaluator/src/index.ts",
          import.meta.url,
        ),
      ),
      "@obby/scoring-engine": fileURLToPath(
        new URL("./packages/scoring-engine/src/index.ts", import.meta.url),
      ),
      "@obby/evaluator-cli": fileURLToPath(
        new URL("./apps/evaluator-cli/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      enabled: false,
    },
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
  },
});
