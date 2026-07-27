import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      "coverage/**",
      "dist/**",
      "**/dist/**",
      "eslint.config.js",
      "node_modules/**",
      "packages/contracts/src/generated/**",
      "packages/obby-evaluator-contracts/src/generated/**",
      "packages/obby-generator-contracts/src/generated/**",
      "roblox/generated/**",
      "tools/smoke-built-packages.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
);
