# Phase 0 completion record

**Status:** Complete

**Completion date:** 2026-07-25

**Pull request:** #1, `chore/phase-0-foundation`

**Final implementation commit:** `5c2de0b` (`fix: face players toward the safe route`)

## Final scope

Phase 0 established the repository-first deterministic foundation:

- JSON Schema Draft 2020-12 PlaceSpec and SceneManifest contracts with generated TypeScript types;
- strict structural validation, separate semantic validation, canonical serialization, SHA-256
  provenance, and generated-file drift checks;
- deterministic PlaceSpec-to-SceneManifest compilation and server-only Luau transport;
- ordered global and per-stage safe-route metadata with coarse reachability checks;
- a native-Part Roblox runtime for spawn, platforms, checkpoints, hazards, finish, and non-colliding
  decoration;
- exact HumanoidRootPart placement at spawn and checkpoint centers with configurable vertical
  offset, route-aware yaw, explicit-yaw fallback, per-player progress, manifest scoping, and stale
  scene-generation protection;
- atomic owned-scene replacement that preserves the previous valid scene on staging failure;
- pinned TypeScript and Roblox toolchains with Ubuntu and Windows CI.

Native Roblox Parts remain the gameplay and collision layer. Generated or decorative assets do not
control gameplay collision.

## Automated validation

The final Phase 0 branch passed:

- `npm ci`;
- `npm run validate`, including formatting, linting, type checking, package builds, schema checks,
  generated-file checks, security checks, Roblox formatting/linting, tests, and Rojo builds;
- 26 Vitest tests across five test files;
- 19 Lune runtime tests;
- `npm run build:smoke`;
- `npm run roblox:test`;
- `npm run roblox:build`;
- `git diff --check origin/main...HEAD`;
- GitHub CI `Validate (ubuntu-latest)` and `Validate (windows-latest)`.

No dependency vulnerability at the configured audit threshold and no secretlint finding remained.

## Roblox Studio evidence

The two-player Studio smoke test passed on 2026-07-25. It verified exact initial and checkpoint
placement, per-player checkpoint isolation, route-aware facing, geometry-driven facing changes,
explicit-yaw fallback, stale-scene isolation, hazard death and respawn, finish behavior, supported
native shapes, decorative collision policy, generated-root ownership, successful rebuild, and
preservation of the previous scene after an injected staging failure.

The detailed procedure and recorded observations are maintained in
`docs/roblox-studio-smoke-test.md`.

## Known limitations

- Coarse reachability uses axis-aligned surface bounds and configured movement limits; it is not an
  exact Roblox physics or avatar controller simulation.
- Engine-dependent behavior remains covered by a manual Studio smoke procedure rather than CI.
- The vertical slice has one stage and one checkpoint and is a contract/runtime reference, not a
  production game or content-generation system.
- Scene state is process-local; persistence, publication, telemetry, experiments, and live-service
  operations are outside Phase 0.
- Visual quality, accessibility, mobile readability, route skips, softlocks, frame performance,
  exact jump feasibility, and retention readiness are not yet evaluated systematically.

## Explicit exclusions

Phase 0 implemented no external AI or ML model integration, Vertex AI integration, Modly
integration, Blender integration, Roblox Open Cloud integration, visual evaluator, analytics or
data-collection pipeline, scraping, model training, or Windows desktop application.
