# Phase G0 deterministic Obby generator

## Scope and architecture

G0 converts a structured `GenerationRequest` into a validated, content-addressed `GenerationBundle` and abstract `ObbySpec`. It describes what G1 should build; it does not contain coordinates, platform dimensions, jump distances, Roblox instances, place files, Lua gameplay code, screenshots, or runtime evidence.

The dependency direction is:

```text
generator-cli -> obby-generator -> obby-generator-contracts -> canonical-json
```

No evaluator package is a generator dependency. The implementation is offline and has no network-capable dependency or service configuration. It uses no LLM, Studio automation, Toolbox lookup, asset generation/download, ML, analytics, desktop UI, cloud infrastructure, or orchestration.

`packages/obby-generator-contracts` owns the versioned shapes, named hash preimages, typed errors, and graph validation. `packages/obby-generator` owns normalization, the committed mechanic catalog/configuration, deterministic PRNG, and reference planner. `apps/generator-cli` owns bounded file IO and atomic publication only.

## Normalization policy

Input is copied before use. Text is NFC-normalized; the working name is trimmed and whitespace-collapsed. Mechanic preferences, exclusions, accessibility constraints, and visual preferences are semantic sets: values are NFC-normalized, deduplicated, and ordered by Unicode scalar value. The brief is preserved as bounded metadata and is never interpreted. Stage/route sequences retain semantic order.

Defaults are target audience `general`, 12 minutes, 15 stages, `medium` difficulty, checkpoint frequency 5, `classic` theme, empty preference/constraint sets, and `native-parts-only`. G0 never clamps user values. It rejects unsupported genre/schema, empty identities, stages outside 5–50, checkpoint frequency outside 1–stage count, invalid unsigned 32-bit seed, unknown enums/mechanics, and preference/exclusion overlap. There are no locale, clock, environment, host, filesystem-order, or caller-input mutation dependencies.

## Hash and deterministic seed policy

All hashes are SHA-256 over NFC canonical JSON using `obby-canonical-json-v1`. Every named hash preimage includes the canonicalization algorithm and its identity-domain field, and excludes its own result field. The user-facing request record ID is excluded from `generationRequestHash`; omitted defaults are expanded before that hash is calculated; and the normalized stable ID is derived from that hash. Semantic retries with a new record ID, and requests that explicitly state the documented defaults, therefore remain byte-identical. Set-like fields are normalized before hashing. Execution IDs, timestamps, paths, CLI arguments, transport, logs, and staging names are absent from semantic objects.

The PRNG is `mulberry32-v1` with an explicit unsigned 32-bit user seed. A named `seedIdentity` first binds the seed, normalized request, configuration, catalog, and PRNG algorithm. Each subsystem derives a 32-bit sub-seed by SHA-256 over `obby-generator-domain-v1`, that identity, and an NFC domain name. Current domains include mechanics; the policy reserves stages, difficulty, checkpoints, hazards, theme variation, and asset intents so later changes can remain isolated. Inclusive integer selection uses bounded rejection sampling rather than modulo-biased reduction, with at most 128 attempts. No `Math.random`, random UUID, time, or process entropy affects semantic output.

## Mechanic catalog policy

The catalog is versioned and content-addressed. Static G1-supported mechanics are static jumps, narrow platforms, height changes, turning jumps, stepping stones, balance beam, hazard avoidance, checkpoint recovery, and finish approach. Disappearing platforms are future-runtime-supported; moving platforms, spinners, and timed doors are deferred. Each definition carries difficulty bounds, required capabilities, forbidden adjacency, accessibility implications, repetition limit, and deterministic selection weight.

The reference configuration permits only static G1-supported mechanics. A requested unknown or deferred mechanic fails closed unless a separately hashed configuration explicitly permits deferred intent. Permitted deferred intent emits both a limitation and a finding and remains non-buildable. Exclusions and forbidden adjacency are enforced during generation and graph validation. Repetition limits are preference bounds when alternatives exist; an otherwise valid one-mechanic request may repeat and emits the limited-variety finding. Fewer than three available mechanics emits that deterministic finding.

## Difficulty, stage, route, checkpoint, and hazard policies

Difficulty is design intent, never empirical difficulty. Stage one is tutorial/onboarding; intent rises gradually toward the requested easy (peak 3), medium (peak 4), or hard (peak 5) target. Local level deltas are bounded at two, periodic recovery stages follow escalation, and the final stage is a climax-level finish approach. Roles use the controlled vocabulary in the contract. Mechanics are introduced on first use and practiced or intensified later; immediate repetition is avoided whenever more than one candidate exists.

The initial route is exactly one required acyclic chain: start, every playable stage in ordinal order, then finish. Consecutive nodes have exactly one required-safe-progression transition. Checkpoints start at frequency multiples strictly before finish; when a hard peak is immediately followed by a recovery stage, the checkpoint moves forward to that recovery stage. They refer to the corresponding stage/node and increase in route order. A five-stage request with frequency three therefore has one checkpoint. G0 stores no jump distance or position.

Hazards are bounded abstract intents associated with existing stages and selected mechanics. Onboarding has no hazard. Static kinds are kill part and fall void; timed-contact or moving-obstacle intent can appear only with an explicitly permitted deferred mechanic. Hazards are native gameplay-authoritative intents and reset to the last checkpoint. Decorations can never become gameplay-authoritative hazards.

## Visual, asset, progression, and retention policies

Visual intent uses controlled theme, palette, native material, lighting, blocky shape, density, readability, landmark cadence, decorative-motion, and UI-tone fields. Asset intent separates gameplay-authoritative route assets from non-colliding decoration. Gameplay collision always defaults to native Roblox Parts; external or local asset policies still require native fallback and audit before use. G0 performs no asset lookup.

Progression encodes onboarding clarity, early success, visible stage/checkpoint progress, and finish readability. Retention encodes checkpoint, novelty, recovery, landmark, and climax pacing as design intent only. It emits explicit limitations that player testing, runtime analytics, empirical difficulty, retention prediction, and CCU prediction are unavailable. There is no aggregate quality score.

## Validation and limits

Validation recomputes every nested and top-level hash; enforces global stable-ID uniqueness; continuous unique stage ordinals; exact route endpoints and transitions; increasing checkpoints; final finish placement; hazard, mechanic, visual, and asset references; excluded/deferred mechanic policy; and non-colliding decoration. Unknown references and conflicting identities fail closed through `GeneratorContractError` with stable codes.

Default deterministic limits are 64 KiB request/configuration files, 512 KiB catalog, 50 stages, 52 route nodes, 51 transitions, 49 checkpoints, 50 hazards, 64 mechanic definitions/findings/limitations, 128 asset intents, 4 MiB canonical output, and 25,000 work units. Generation is iterative and O(stages × mechanic definitions), with bounded PRNG retries and no uncontrolled recursion.

## CLI and security policy

Run:

```text
npm run generator -- generate --request request.json --config generator-config.json --catalog mechanic-catalog.json --output output-directory
```

Configuration and catalog flags may be omitted to use committed defaults. Input files are opened through bounded handles, checked as regular files, and size-checked before parsing. The relative output path rejects traversal and symbolic-link/reparse-point ancestors and is confined under a resolved root. The CLI writes one canonical `generation-bundle.json` into a sibling staging directory and atomically renames it to `obby-<64-hex-ObbySpec-hash>`. Existing destinations are conflicts and are never overwritten. Staging is cleaned on failure. Process ID is used only to acquire an execution-local staging directory and is never stored or hashed. `--json-errors` returns stable `{error:{code,message}}`; raw stacks are never printed.

## Limitations

G0 supports only structured `obby` requests and deterministic abstract planning. Natural-language interpretation, geometry, physics feasibility, runtime mechanics, Roblox assembly, rendering, visual evaluation, player testing, analytics, experiments, and external services remain out of scope.
