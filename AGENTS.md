# Repository agent instructions

These instructions apply to the entire repository.

## Workflow

- Never commit directly to `main`. Use a focused branch and a reviewed pull request.
- Treat the repository, committed contracts, tests, and ADRs as the source of truth.
- Add or update failing tests before changing behavior.
- Run `npm run validate` before every pull request.
- Keep changes within the active phase; do not opportunistically introduce integrations.

## Determinism and generated files

- JSON Schema Draft 2020-12 files in `packages/contracts/schemas/` are the structural contract source.
- Cross-field rules belong in the semantic validation layer, not a second structural validator.
- Never edit files under `packages/contracts/src/generated/`, `roblox/generated/`, or generated
  `examples/**/scene-manifest.json` by hand.
- Regenerate contract types with `npm run contracts:generate`.
- Regenerate fixture manifests and Roblox transport modules with `npm run fixtures:generate`.
- A valid generation change must preserve same-input, same-seed, same-version byte determinism.

## Security boundaries

- Never add credentials, service-account files, Roblox cookies, private keys, or real secret values.
- External repositories and tools must be pinned and audited before execution.
- Vertex AI, Modly, Blender, Roblox Open Cloud, external ML models, image generation, and analytics
  are outside Phase 0.
- Native Roblox Parts own gameplay and collision. Decorative objects must remain non-colliding.
- Generated input is untrusted and must fail closed before changing the current Roblox scene.
