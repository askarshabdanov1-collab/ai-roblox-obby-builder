# Generated files

The following files are committed review artifacts but are never hand-edited:

- `packages/contracts/src/generated/*.ts`;
- `packages/obby-evaluator-contracts/src/generated/*.ts`;
- `packages/obby-generator-contracts/src/generated/*.ts`;
- `packages/obby-layout-contracts/src/generated/*.ts`;
- `packages/obby-evaluator-contracts/fixtures/generated/*.json`;
- `examples/vertical-slice/scene-manifest.json`;
- `examples/generator/**/generation-bundle.json` and generator fixture inputs;
- `roblox/generated/VerticalSliceManifest.luau`;
- `roblox.yml`, the Selene Roblox standard library snapshot.

Use:

```text
npm run contracts:generate
npm run evaluator:contracts:generate
npm run generator:contracts:generate
npm run layout:contracts:generate
npm run generator:fixtures:generate
npm run fixtures:generate
```

Then inspect the complete diff. `npm run fixtures:check` and
`npm run evaluator:contracts:check` are non-mutating and fail on drift. The evaluator command owns
both schema-derived TypeScript and its content-addressed catalog/profile/hash-vector fixtures; E1c
will introduce the separately planned finalized-report fixture commands.

`npm run generator:contracts:check` compiles the G0 schema and checks its schema-derived
declarations and fingerprint. `npm run generator:fixtures:check` recomputes canonical requests,
configuration, catalog, and bundles in memory without rewriting them.

`npm run layout:contracts:check` compiles the G1a contract schema and checks its schema-derived
declarations and fingerprint without modifying files. G1a has no generated layout fixture or
production recipe.

Files under `build/`, `dist/`, `coverage/`, and generated local artifact/model directories are
disposable and ignored. Generated artifacts must contain no credentials, local absolute paths, or
unreviewed external content.
