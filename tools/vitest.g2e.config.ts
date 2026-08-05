import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: ["tools/test/g2e-build-provenance.test.ts"],
  },
});
