# Phase G0 deterministic Obby generator

## Scope and architecture

G0 converts a structured `GenerationRequest` into a validated, content-addressed `GenerationBundle` and abstract `ObbySpec`. It describes what G1 should build; it contains no coordinates, geometry, Roblox instances, runtime evidence, or external integration.

```text
generator-cli -> obby-generator -> obby-generator-contracts -> canonical-json
```

The contracts package owns versioned shapes, hashes, errors, and full graph validation. The generator owns normalization, committed authorities, PRNG, and planning. The CLI owns bounded file IO and atomic publication. G0 is offline and has no LLM, network, Studio, Toolbox, ML, analytics, desktop/cloud, or orchestration dependency.

## Normalization and identity

Input is copied. Text is NFC-normalized; working names are trimmed and whitespace-collapsed. Mechanic preferences/exclusions, accessibility constraints, and visual preferences are unique Unicode-scalar ordered semantic sets. Brief text is bounded metadata and is never interpreted. Defaults are `general`, 12 minutes, 15 stages, `medium`, checkpoint frequency 5, `classic`, empty sets, and `native-parts-only`.

Normalization rejects empty names, unsupported enum/mechanic values, non-uint32 seeds, non-positive or excessive duration, stage counts outside 5–50, checkpoint frequency outside 1–stage count, noncanonical sets, and preference/exclusion or accessibility contradictions. The public normalized validator repeats these semantic checks before accepting hashes, so caller-rehashed invalid content fails closed and caller input is never mutated.

All hashes use SHA-256 over NFC canonical JSON with `obby-canonical-json-v1`. Each named preimage includes its identity domain and excludes its result field. Request record IDs, execution/session identity, timestamps, paths, transport, retries, logs, and staging names are excluded. Defaults are expanded before `generationRequestHash`; semantic retries and explicit/implicit defaults are therefore byte-identical.

## PRNG framing

The semantic PRNG is `mulberry32-v1`. `seedIdentity` binds the uint32 seed, normalized request, configuration, catalog, and PRNG algorithm. Each subsystem seed is the first uint32 of SHA-256 over a canonical object containing:

- `derivationVersion: "obby-generator-domain-v2"`;
- `fieldCount: 2`;
- separately named NFC `seedIdentity`;
- separately named NFC `domainNamespace`.

This unambiguously frames embedded separators and NULs. Inclusive selection uses bounded rejection sampling with at most 128 attempts. No time, UUID, `Math.random`, filesystem order, locale, or process entropy affects semantic output.

## Mechanic authority

The content-addressed catalog declares version, capability class, required capabilities, difficulty range, compatible hazards, forbidden adjacency, accessibility implications, repetition limit, and weight. The default configuration exposes native Parts only; deferred intent requires explicit hashed permission and remains non-buildable.

Capability availability, difficulty range, accessibility, adjacency, repetition, and hazard compatibility are hard constraints in generation and validation. Preferences are prioritized, but the planner deterministically falls back to another permitted mechanic before exceeding a repetition bound. Unknown, excluded, unavailable, conflicting, or incorrectly versioned mechanics fail closed.

## Difficulty, route, checkpoint, and hazard policy

Difficulty is design intent, not empirical evidence. Stage one is tutorial/onboarding; the requested easy/medium/hard peak is 3/4/5; the final stage is climax/finish-approach. Local deltas honor the hashed configuration value of one or two.

Recovery is peak-triggered: it may occur only immediately after the requested target peak, with a deterministic cooldown before another recovery. `recoveryPacing: after-peaks` therefore describes implemented behavior rather than a periodic approximation.

The route is one required acyclic chain: start, every stage exactly once in ordinal order, finish. Each consecutive pair has one required-safe transition. Checkpoints begin at frequency multiples before finish. A checkpoint immediately before a recovery moves to the recovery stage. If that shift collides, the planner searches forward then backward by increasing distance for the nearest unused non-finish stage. Requested checkpoint cardinality is preserved, order remains strict, and any shift/collision emits `checkpoint-cadence-adjusted` with final stage IDs.

Every hazard binds exactly one stage and that stage's mechanic. Static mechanics allow only their declared native hazards. Deferred hazard kinds require the matching catalog capability and explicit configuration permission.

## Visual and asset policy

Controlled enums cover theme/palette, material, lighting, shape language, density, readability, decorative motion, and UI tone. Gameplay-authoritative intent uses native-Part collision and a native fallback; decoration is non-colliding and cannot own route authority. Under `native-parts-only`, asset intent cannot select external/local providers or require external audit. Structural `additionalProperties: false` rejects undeclared Toolbox IDs, URLs, and provider fields.

## Full validation boundary

Full `ObbySpec` validation requires the exact catalog, configuration, and normalized request. Full bundle validation requires the exact catalog and configuration and validates its embedded normalized request. There is no weaker optional-context overload.

Validation binds every duplicated request/spec/bundle semantic, recomputes all nested/top-level hashes, and enforces:

- one mechanic per playable stage and no orphan intent;
- exact stage/route/checkpoint cardinality in both directions;
- finish after the final stage;
- exact hazard/stage/mechanic binding;
- used and policy-consistent visual/asset intents;
- exact catalog/configuration/request/generator/PRNG identities;
- catalog capability, repetition, adjacency, difficulty, accessibility, and hazard rules.

Unknown references, stale hashes, invalid normalized semantics with fresh hashes, policy conflicts, and missing authority context return stable typed errors.

## Deterministic work model

Default limits include 50 stages, 64 mechanic definitions, 52 route nodes, 51 transitions, 49 checkpoints, 50 hazards, 128 assets, 64 findings/limitations, 4 MiB output, and 25,000 work units. Work is reserved before the first covered operation as:

```text
4,000 + 120*stages + 100*mechanics + 4*stages*mechanics
```

Preflight admission is deliberately narrower than semantic validation. Its only unmetered work is a constant-time object/readability check, reading the request's explicit `stageCount` or the documented default of 15, reading the catalog mechanic-array length without traversing it, reading `maxWorkUnits`, and safe-integer arithmetic for the formula. It performs no schema traversal, semantic validation, normalization, sorting, hashing, PRNG derivation, graph work, or serialization.

The exact requirement is compared with `maxWorkUnits` before configuration validation, catalog validation, or request normalization. Insufficient budget fails with `maximum-work-units`; sufficient budget reserves exactly the required units and reports required, admitted, available, and unused units through the test seam. Only after reservation do covered operations begin.

The terms cover bounded normalization, schema/authority validation, sub-seed derivation, mechanic/difficulty/stage/route/checkpoint/hazard/asset/visual work, indexed graph correlation, hashing, full validation, canonical serialization, and CLI preparation. A 50-stage/50-mechanic input costs exactly 25,000. Arithmetic is safe-integer checked, and near-maximum deterministic N−1/N/N+1 tests prove that N−1 invokes zero covered operations, N reserves exactly N, and N+1 reserves N with one unused unit. Complexity is iterative `O(stages * mechanics)` for bounded candidate scans and otherwise linear indexed correlation, with no uncontrolled recursion.

## CLI and filesystem security

```text
npm run generator -- generate --request request.json --config generator-config.json --catalog mechanic-catalog.json --output output-directory
```

Config/catalog default to committed authorities. Unknown, duplicate, missing-value, and missing-required options return typed usage errors. Input handles enforce regular-file and byte bounds. Malformed input, schema, hash, and semantic failures retain stable codes.

Before output creation, the CLI rejects absolute/traversal paths, reserved Windows names, non-NFC segments, input/output aliases, case-insensitive Windows aliases, existing non-directory segments, symlinks, Windows junctions/reparse points, ancestor replacement, and final-output reparse points. Errors expose logical labels, never absolute host paths, native messages, or stacks.

Publication writes and syncs the complete canonical payload in a sibling staging directory first. At commit, an exclusive `mkdir` atomically claims the exact `obby-<ObbySpec-hash>` destination. An existing directory, file, or late-created legitimate destination returns `output-conflict` without replacement; an existing symlink, junction, or reparse destination remains a `path-safety` failure. Concurrent identical publishers stage independently, synchronize at the claim, and exactly one can create the destination.

After claiming, the CLI revalidates the output ancestry and atomically hard-links the already complete, synced staging file into the claimed directory with create-if-absent semantics. The destination directory is a reservation until `generation-bundle.json` appears; consumers must not treat an empty claimed directory as a completed output. The payload itself is never partially visible, merged, renamed over another entry, or overwritten. Directory and parent sync attempts follow publication, staging is removed, and a pre-payload failure removes the CLI-owned empty claim after verifying its identity. A crash can leave an incomplete claim, which deliberately fails closed as `output-conflict` on retry rather than risking replacement. Ubuntu and Windows tests cover late empty-directory/file conflicts, concurrent publishers, cleanup, symlink/junction ancestors, and final-output reparse points.

## Fixtures and limits of claim

Committed fixtures cover same-seed bytes/filename, different-seed controlled variation, explicit/implicit defaults, and exact typed negative outcomes. Drift checks recompute in memory without writes and reject `ZERO_HASH`.

G0 remains abstract planning only. Natural-language interpretation, physical reachability, geometry, runtime mechanics, Roblox assembly, rendering, visual evaluation, player testing, analytics, experiments, and external services remain out of scope.
