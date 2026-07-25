# Local development

Use Node `20.20.2`, npm `10.8.2`, and Rokit `1.2.0`. Review and trust the four repositories named in
`rokit.toml`, then run:

```text
rokit install
npm ci
npm run validate
```

The root scripts do not rely on unpinned global versions. Rokit resolves Rojo `7.7.0`, StyLua
`2.5.2`, Selene `0.31.0`, and Lune `0.10.5`.

`npm run validate` is non-mutating with respect to tracked files. It may create ignored build
artifacts. Finish with `git diff --check` and `git status --short`.

## TypeScript build output

`npm run build` is the single package build strategy. TypeScript first emits the repository build,
then `tools/package-build.ts` places JavaScript, declarations, and source maps in each workspace
package's ignored `dist/` directory. Package `main`, `types`, and `exports` resolve only to those
compiled files. The final `build:smoke` step uses ordinary Node—without `tsx`, ts-node, or a custom
loader—to import canonical JSON, contracts, the compiler, and the Roblox emitter.
