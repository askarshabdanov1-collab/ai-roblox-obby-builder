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

Preflight admission is deliberately narrower than semantic validation. Public inputs must be ordinary plain-data objects with prototype exactly `Object.prototype` or `null`; arrays must use `Array.prototype`. Node's non-observing Proxy detection rejects Proxies before reflective inspection. Preflight obtains only own data descriptors for the request's explicit `stageCount` (or the documented default of 15), `configuration.limits`, `limits.maxWorkUnits`, and `catalog.mechanics`, then reads the mechanics array's own data `length` descriptor without touching any element. Accessors, inherited semantic fields, custom prototypes, array subclasses, symbols, sparse arrays, custom properties, functions, coercion hooks, cycles, and Proxies are rejected by the plain-data boundary without invoking them. Full descriptor-based snapshotting starts only after successful work reservation.

The exact requirement is compared with `maxWorkUnits` before snapshot traversal, configuration validation, catalog validation, or request normalization. Insufficient budget fails with `maximum-work-units`; sufficient budget reserves exactly the required units and reports required, admitted, available, and unused units through the execution-only test seam. `maxWorkUnits`, available units, and unused units are execution metadata: the configuration hash projection excludes `limits.maxWorkUnits`, and no accounting field is written to the content-addressed GenerationBundle. N, N+1, and larger sufficient budgets therefore produce identical normalized requests, ObbySpecs, bundles, hashes, canonical bytes, and output names.

The terms cover bounded normalization, schema/authority validation, sub-seed derivation, mechanic/difficulty/stage/route/checkpoint/hazard/asset/visual work, indexed graph correlation, hashing, full validation, canonical serialization, and CLI preparation. A 50-stage/50-mechanic input costs exactly 25,000. Arithmetic is safe-integer checked, and near-maximum deterministic N−1/N/N+1 tests prove that N−1 invokes zero covered operations, N reserves exactly N, and N+1 reserves N with one unused unit. Complexity is iterative `O(stages * mechanics)` for bounded candidate scans and otherwise linear indexed correlation, with no uncontrolled recursion.

## CLI and filesystem security

```text
npm run generator -- generate --request request.json --config generator-config.json --catalog mechanic-catalog.json --output output-directory
```

Config/catalog default to committed authorities. Unknown, duplicate, missing-value, and missing-required options return typed usage errors. Input handles enforce regular-file and byte bounds. Malformed input, schema, hash, and semantic failures retain stable codes.

Before output creation, the CLI rejects absolute/traversal paths, reserved Windows names, non-NFC segments, input/output aliases, case-insensitive Windows aliases, existing non-directory segments, symlinks, Windows junctions/reparse points, ancestor replacement, and final-output reparse points. Errors expose logical labels, never absolute host paths, native messages, or stacks.

Publication writes and syncs the complete canonical payload in a private sibling staging directory first. The public `obby-<ObbySpec-hash>` path remains absent. A separate deterministic `.obby-generator-<hash>.lock` directory exclusively owns the destination name; it cannot collide with the public namespace and is never accepted as generated output. Concurrent conforming publishers stage independently, serialize at this private lock, and exactly one can commit.

After locking, the CLI revalidates the parent ancestry, private-lock device/file identity, and final-path absence immediately before commit. It then atomically renames the already complete staging directory into the public destination. Thus a public observer sees either no destination or the complete `generation-bundle.json`; there is no empty public claim and readers require no incomplete-state convention. The committed directory identity is checked against the former staging identity, the final and parent directories are synced, and the owned private lock is removed only after another identity check.

The private lock is the mutual-exclusion boundary for repository publishers. A non-conforming process that creates a final object before the guarded commit is detected by the final absence check and returns `output-conflict` or `path-safety`; deterministic mutation tests cover this point. Replacing or renaming the private lock is detected before commit and cannot redirect a payload write because publication never creates children through the lock or final path. Cleanup removes staging and the lock only while their captured identities remain owned; foreign replacements are preserved. A crash may leave a private lock or staging directory, which fails closed without creating a public partial output. Native rename provides the atomic visibility step; the supported threat model requires writers of the same output root to honor the private destination-name lock rather than racing the final rename syscall outside the protocol.

## Fixtures and limits of claim

Committed fixtures cover same-seed bytes/filename, different-seed controlled variation, explicit/implicit defaults, and exact typed negative outcomes. Drift checks recompute in memory without writes and reject `ZERO_HASH`.

G0 remains abstract planning only. Natural-language interpretation, physical reachability, geometry, runtime mechanics, Roblox assembly, rendering, visual evaluation, player testing, analytics, experiments, and external services remain out of scope.
