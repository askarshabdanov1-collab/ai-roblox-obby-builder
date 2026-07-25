# AI Roblox Obby Builder

A deterministic-first foundation for converting a validated game description into a native-Part
Roblox Obby.

## Phase 0

Phase 0 establishes:

- JSON Schema `0.2` PlaceSpec and SceneManifest contracts;
- strict Ajv structural validation and separate semantic validation;
- canonical JSON serialization and SHA-256 provenance;
- deterministic PlaceSpec-to-SceneManifest compilation;
- generated, drift-checked Roblox manifest transport;
- native spawn, platforms, checkpoint, kill hazard, and finish behavior;
- pinned TypeScript and Roblox toolchains with CI.

Vertex AI, Modly, Blender, Roblox Open Cloud, image generation, analytics, and external ML models are
not integrated.

## Evaluator

The reviewed Phase E0 design and Phase E1 plan are documented in
[`docs/evaluator/`](docs/evaluator/README.md). Phase E1a implements the evaluator-owned contract and
native-Part geometry foundations only. It does not implement route verdicts, scoring, reports, a
CLI, external models, Studio automation, data collection, training, analytics, or a desktop
application.

## Pipeline

```text
PlaceSpec + seed + generator version
                  |
                  v
        structural validation (Ajv)
                  |
                  v
          semantic validation
                  |
                  v
       deterministic Obby compiler
                  |
                  v
    canonical SceneManifest + hashes
                  |
                  v
       generated Luau transport
                  |
                  v
       native-Part Roblox runtime
```

The checked fixture lives in `examples/vertical-slice/`. Its SceneManifest and Luau transport are
generated from its PlaceSpec and must not be edited manually.

## Development

See `CONTRIBUTING.md` and `docs/local-development.md`. The complete local gate is:

```text
npm ci
npm run evaluator:contracts:check
npm run evaluator:test
npm run validate
git diff --check
git status --short
```

All development uses branches and reviewed pull requests.
