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

## Generator G0

Phase G0 adds an offline, deterministic planner from a structured request to an abstract,
content-addressed `ObbySpec`. It stops before coordinates, geometry, Roblox assembly, runtime
mechanics, or external asset work. See the
[`G0 architecture`](docs/generator/g0-architecture.md),
[`contract reference`](docs/generator/contracts.md), and
[`G1 handoff`](docs/generator/g0-acceptance-and-g1-handoff.md).

Focused non-mutating gates are `npm run generator:contracts:check`,
`npm run generator:fixtures:check`, and `npm run generator:check`.

## Generator G1a

Phase G1a decides and validates the boundary between the abstract G0 plan and future deterministic
layout generation. It adds no geometry producer, layout recipes, PlaceSpec projection, compiler
change, or Roblox runtime behavior. See the
[`layout boundary ADR`](docs/decisions/0002-g1-layout-contract-boundary.md),
[`contract reference`](docs/generator/g1a-layout-contracts.md), and
[`compatibility matrix`](docs/generator/g1a-compatibility.md).

Focused non-mutating gates are `npm run layout:contracts:check` and
`npm run layout:contracts:test`.

## Generator G1b

Phase G1b adds the pure deterministic native-Part layout engine, reviewed numeric recipe
authorities for every currently supported static mechanic, bounded serpentine packing, coarse
reachability evidence, and complete validated `LayoutBundle` fixtures. It does not publish files or
change PlaceSpec, SceneManifest, either CLI, the compiler, emitter, or Roblox runtime. See the
[`G1b engine reference`](docs/generator/g1b-layout-engine.md).

The focused non-mutating gate is `npm run layout:check`.

## Development

See `CONTRIBUTING.md` and `docs/local-development.md`. The complete local gate is:

```text
npm ci
npm run evaluator:contracts:check
npm run evaluator:test
npm run generator:check
npm run validate
git diff --check
git status --short
```

All development uses branches and reviewed pull requests.
