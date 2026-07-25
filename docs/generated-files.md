# Generated files

The following files are committed review artifacts but are never hand-edited:

- `packages/contracts/src/generated/*.ts`;
- `examples/vertical-slice/scene-manifest.json`;
- `roblox/generated/VerticalSliceManifest.luau`;
- `roblox.yml`, the Selene Roblox standard library snapshot.

Use:

```text
npm run contracts:generate
npm run fixtures:generate
```

Then inspect the complete diff. `npm run fixtures:check` is non-mutating and fails on drift.

Files under `build/`, `dist/`, `coverage/`, and generated local artifact/model directories are
disposable and ignored. Generated artifacts must contain no credentials, local absolute paths, or
unreviewed external content.
