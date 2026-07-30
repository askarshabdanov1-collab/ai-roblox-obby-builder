# Phase G2b manifest admission and G2c handoff

G2b implements the SceneManifest 0.3 trust-boundary loader and validator parity without constructing
or activating a scene. The active SceneManifest 0.2 bootstrap and builder remain unchanged.

## Implemented modules

| Module                      | Responsibility                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `ManifestSnapshotV03.luau`  | Iterative, bounded, metatable-safe detached snapshot and bottom-up freezing                    |
| `ManifestAdmissionV03.luau` | Contract count limits and derived pre-validation work admission                                |
| `ManifestValidatorV03.luau` | Complete 0.3 structural and construction-relevant semantic validation                          |
| `ManifestIndexesV03.luau`   | Deterministic frozen ordered IDs and lookup maps from admitted data only                       |
| `ManifestLoaderV03.luau`    | Protected loading, ordered fail-closed admission, expected-hash equality, and immutable result |

The public entry point is `ManifestLoaderV03.load(moduleScript, expectedManifestHash, options?)`.
Production callers use the default `require`; tests may inject only the require function and lower
resource ceilings. Errors are frozen records with a stable code and sanitized message. They do not
include stack traces, absolute paths, manifest values, or uncontrolled require errors.

## Determinism and complexity

- Traversal uses `next` and raw table values only after rejecting metatables.
- Repeated table references are rejected, covering both cycles and aliases.
- No caller table is retained; every admitted table and index is frozen.
- Index arrays preserve contract order. Maps are lookup-only and never used as an ordering source.
- `structuralIdentity` is a deterministic length-prefixed representation of schema/hash and ordered
  identity arrays. It is a normalized regression identity, not a cryptographic content hash.
- Snapshot cost is linear in admitted nodes, entries, and string bytes within explicit limits.
- Semantic validation and indexing are linear in the bounded manifest collections.
- No current time, random source, filesystem order, locale comparison, network data, Workspace read,
  or Instance allocation participates.

## Trust boundary

G2b preserves ADR 0003. The loader accepts only a repository-packaged ModuleScript whose exact
expected `manifestHash` is configured by reviewed code. Luau checks hash syntax and equality after
full snapshot/validation; it does not canonically recompute the SceneManifest hash. TypeScript
publication validation and exact-byte fixture drift remain the content-integrity evidence.

## Acceptance evidence

- The authoritative G1d transport and shared zero/20/21/50-stage/maximum-checkpoint fixtures admit.
- Malformed versions, hashes, records, numbers, collections, identities, references, routes,
  transitions, collision roles, metatables, cycles/aliases, sparse arrays, and unsupported values
  fail closed.
- N-1/N/N+1 checks cover objects, routes, transitions, stages, zones, and derived work.
- Caller mutation cannot alter admitted output, and deterministic indexes match contract order.
- A source-scope regression rejects G2b dependencies on Roblox scene APIs.
- Existing SceneManifest 0.2 Luau tests and both Rojo builds remain required validation gates.

## Remaining limitations and G2c boundary

G2b does not authenticate arbitrary runtime tables and does not compute canonical hashes in Luau.
It also does not build a construction plan, allocate Parts, construct a candidate scene, wire spawn
or gameplay behavior, replace scenes, select a 0.3 runtime, or change the bootstrap.

G2c may begin only after this PR is reviewed and merged. It may consume the immutable admitted
representation to plan and construct a bounded off-Workspace candidate under the already accepted
G2 decisions. It must not weaken loader validation, retain caller aliases, activate 0.3 by default,
or remove the 0.2 rollback path. Manual Roblox Studio execution remains a later mandatory runtime
acceptance gate.
