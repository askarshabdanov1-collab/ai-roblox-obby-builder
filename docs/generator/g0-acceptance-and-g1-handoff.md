# G0 acceptance checklist and G1 handoff

## Acceptance checklist

- [x] Structured `obby` request normalization is deterministic, immutable, bounded, and content-addressed.
- [x] Unsupported or contradictory intent fails closed.
- [x] The versioned PRNG uses explicit seeds and content-addressed domain separation.
- [x] The versioned static-first mechanic catalog prevents unapproved deferred capabilities.
- [x] Five through fifty abstract stages receive deterministic roles, mechanics, difficulty, route, checkpoints, hazards, visual/assets, progression, and retention intents.
- [x] Exactly one acyclic required start-to-finish route covers every required stage.
- [x] Full graph validation requires catalog/configuration/request authority, recomputes hashes, and closes all bidirectional references.
- [x] Committed fixtures cover exact typed rejection, same-seed bytes/filename, different-seed controlled variation, and implicit/explicit defaults.
- [x] Constant-time structural preflight reserves the exact work requirement before every covered semantic operation; N−1 invokes no validator, normalizer, PRNG, planner, hasher, graph validator, or serializer preparation.
- [x] The offline CLI protects aliases and reparse points on Ubuntu/Windows, atomically claims destinations, publishes complete payload bytes create-if-absent, preserves late conflicts, serializes concurrent publishers, and reports path-redacted typed errors.
- [x] Generated contract/fixture checks are non-mutating.
- [x] Plain-Node built imports and the full repository validation suite include G0.
- [x] No LLM, network, Studio, Toolbox, ML, analytics, desktop/cloud, or orchestration implementation is present.

## G1 input boundary

G1 receives a successfully validated `ObbySpec` plus the exact configuration/catalog identities already bound into it. It must not reinterpret `brief` or any other user prose.

G1 will transform the ordered stages, mechanic intents, difficulty bands, and required route into exact native-Part geometry: platform dimensions, world coordinates, safe jump transitions, hazard volumes, checkpoint positions, and finish placement. Visual and asset intents will define deterministic decorative placement zones and native-Part fallback without granting decorative assets gameplay collision. Progression/retention fields may guide visible landmarks and pacing but cannot override route safety or native gameplay authority.

G1 must preserve the stable G0 IDs as source references, emit its own versioned content-addressed layout contract, validate physical reachability separately, and report any unsupported deferred mechanic rather than inventing runtime behavior. Geometry, assembly, Roblox files, and runtime code are not implemented in G0.

## Validation commands

```text
npm run generator:contracts:check
npm run generator:fixtures:check
npm run generator:determinism:check
npm run generator:test
npm run generator:cli:test
npm run generator:check
npm run build:smoke
npm run validate
```
