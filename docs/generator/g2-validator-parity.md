# SceneManifest 0.3 TypeScript/Luau validator parity

The JSON Schema and `packages/contracts/src/validation-v0.3.ts` remain the publication authority.
G2b closes the construction-relevant Luau admission gaps in
`roblox/src/ReplicatedStorage/ObbyRuntime/ManifestValidatorV03.luau`. The Luau implementation is an
independent fail-closed validator, not a second schema authority.

## Parity matrix

| Rule                   | TypeScript/schema authority                                                        | G2b Luau admission                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural validation  | Draft 2020-12 schema defines records, required fields, primitive types, and maxima | Validates every admitted record and exact primitive type after bounded snapshotting                                                            |
| Additional properties  | `additionalProperties: false` throughout                                           | Rejects unknown keys at each supported record level; no G2b blocker remains                                                                    |
| Numeric validity       | Bounds, integer rules, and finite-number semantics                                 | Rejects NaN, infinity, unsafe integers, and out-of-range measurements                                                                          |
| Duplicate identities   | Object, stage, route, transition, and zone uniqueness                              | Rejects gameplay/decorative cross-layer collisions and duplicate stage, route-entry, checkpoint, transition, and zone identities               |
| Dangling references    | Closes object, stage, checkpoint, hazard, route, source, and zone references       | Closes every construction- or behavior-relevant reference                                                                                      |
| Route closure          | Exact ordered safe gameplay route ending at Finish                                 | Requires Spawn-to-Finish order and exact route-entry/stage flattening                                                                          |
| Transition evidence    | Exact adjacency, authority IDs, outcomes, measurements, limitations, and hashes    | Validates transition count, order, references, nested fields, outcomes, and evidence metadata without reclassification                         |
| Collision authority    | Role-to-gameplay collision policy                                                  | Enforces native gameplay collision authority and role-specific flags                                                                           |
| Decorative constraints | Decorative schema plus route exclusion                                             | Enforces non-collision, non-touch, non-query, full record validity, zone closure, and route exclusion                                          |
| Schema version         | Exact `0.3`, generator `0.3.0`, and projection authority                           | Rejects cross-loaded or coerced versions before semantic admission                                                                             |
| Manifest identity/hash | Recomputes the self-excluding canonical hash                                       | Validates syntax and exact equality with the configured reviewed expected hash; canonical recomputation is intentionally absent under ADR 0003 |

The contract has no standalone behavior-ID field. Behavior uniqueness is therefore enforced through
unique object identity plus role, route, checkpoint, hazard, and finish consistency; the Luau
validator does not invent a new identity domain.

## Admission order

`ManifestLoaderV03.load` executes these fail-closed stages:

1. protected `require` of the configured repository ModuleScript;
2. non-table and raw cross-version rejection;
3. expected-hash syntax validation;
4. iterative bounded plain-data snapshot with metatable, cycle/alias, key, value, depth, node, entry,
   and string-byte rejection;
5. collection-count and derived work admission;
6. structural and semantic validation;
7. declared-hash equality with the configured expected hash;
8. deterministic indexes built only from the detached admitted snapshot; and
9. bottom-up frozen admitted result.

No stage allocates an Instance, reads Workspace, uses time/random/network/locale state, or retains a
caller-owned table. Snapshot traversal is iterative and bounded by 64 levels, 20,000 table nodes,
50,000 entries, and 4 MiB of strings by default. Semantic work is bounded by the contract collection
maxima and a maximum derived work count of 2,612 units.

## Hash limitation

The intentional hash exception is precise:

- TypeScript proves `manifestHash` equals the canonical self-excluding content hash.
- Luau proves that the declared hash is well formed and equals the reviewed expected hash configured
  beside the packaged ModuleScript.
- `npm run layout:workflow:fixtures:check` proves the authoritative G1d artifact has not drifted.
- `npm run g2:fixtures:check` proves the G2 runtime transports and fixture index match their single
  deterministic owner.
- The admitted envelope reports `hashTrust = "repository-module-expected-hash-v1"`; it does not claim
  arbitrary-table authentication.

An untrusted runtime transport would require canonical Luau recomputation or an authenticated
envelope and a new reviewed decision. It cannot silently reuse the repository-package assumption.

## Evidence

`roblox/tests/G2ManifestAdmissionTests.luau` covers protected loading, snapshot safety, all parity
classes, N-1/N/N+1 count and work bounds, caller mutation, deterministic indexes, zero checkpoints,
maximum checkpoints, and 20/21/50 stages. `packages/contracts/test/g2-runtime-parity.test.ts`
validates the shared transports with the TypeScript authority and verifies their exact emitted Luau
bytes. Runtime construction remains outside G2b.
