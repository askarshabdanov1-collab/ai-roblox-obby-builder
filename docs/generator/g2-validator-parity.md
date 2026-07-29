# SceneManifest 0.3 TypeScript/Luau validator parity

The JSON Schema and `packages/contracts/src/validation-v0.3.ts` are the publication authority.
`roblox/src/ReplicatedStorage/ObbyRuntime/ManifestValidatorV03.luau` is currently a validation-only
transport check. “Partial” below means the current Luau validator checks some fields but is not
equivalent. Every listed G2b blocker must be closed before a manifest reaches construction.

## Parity matrix

| Rule                   | TypeScript/schema state                                                                               | Current Luau state                                                                                                                                       | Required G2b state                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural validation  | Draft 2020-12 schema requires all declared records and field types                                    | Partial top-level, gameplay, navigation, and transition checks                                                                                           | Validate every construction-relevant record and contract maximum before admission                                                                                                      |
| Additional properties  | `additionalProperties: false` throughout schema                                                       | Not rejected                                                                                                                                             | Snapshot validator rejects unknown keys at every admitted record; **G2b blocker**                                                                                                      |
| Numeric validity       | Schema bounds plus semantic checks; non-finite input rejected                                         | Some vectors reject NaN/infinity, but scalar measurements, offsets, geometry summaries, orders, and bounds are incomplete                                | Reject NaN/infinity and enforce every schema bound/integer rule; **G2b blocker**                                                                                                       |
| Duplicate IDs          | Semantic validation covers object identities and route uniqueness                                     | Gameplay duplicates are checked; decorative duplicate tracking is incomplete and zone/stage IDs are not closed                                           | Check gameplay, decorative, zones, stages, route entries, transitions, and cross-layer uniqueness; **G2b blocker**                                                                     |
| Dangling references    | Semantic validator closes objects, stage routes/hazards/zones, checkpoints, and navigation references | Safe-route/checkpoint basics only; source, zone, stage, hazard, and decorative closure is incomplete                                                     | Close every ID/reference used by construction or behavior; **G2b blocker**                                                                                                             |
| Route closure          | Exact ordered safe gameplay, final Finish, route-entry and stage concatenation rules                  | Checks safe gameplay coverage, final Finish, and basic stage flattening; does not verify every route-entry stage coordinate                              | Match TypeScript ordering and route-entry coordinates exactly; **G2b blocker**                                                                                                         |
| Transition evidence    | Exact route adjacency/order, authority IDs, count, outcomes, measurements, limitations, and hashes    | Checks adjacency/order, authority IDs, available measurements, limitations, and count; nested field/unknown-property coverage is partial                 | Validate all schema fields and bounds without reclassifying evidence; **G2b blocker**                                                                                                  |
| Collision authority    | Semantic role-to-gameplay collision policy                                                            | Gameplay role flags checked                                                                                                                              | Preserve exact parity and require native gameplay authority before construction                                                                                                        |
| Decorative constraints | Schema defines complete decorative object and zone shapes; semantics prohibit route use               | Only no-collide/no-touch/no-query and basic layer ID collision are checked; appearance, geometry, authority, zone fields, limits, and IDs are incomplete | Validate full decorative records, unique IDs, zone closure, and route exclusion; **G2b blocker**                                                                                       |
| Schema version         | Exact `0.3`, generator `0.3.0`, projection authority                                                  | Exact values checked                                                                                                                                     | Preserve exact rejection; never coerce `0.2`                                                                                                                                           |
| Manifest identity/hash | TypeScript recomputes the self-excluding canonical hash and rejects mismatch                          | Syntax checks hash fields only                                                                                                                           | Compare declared hash with configured reviewed expected hash; do not claim content authentication. Canonical recomputation remains an intentional documented non-parity under ADR 0003 |

## Construction admission policy

The future loader may call the validator only after creating a bounded, metatable-free plain-data
snapshot. Validation success is necessary but not sufficient: it must also compare the configured
expected `manifestHash`, enforce work admission, and construct lookup maps from the admitted snapshot
only.

Rules that affect no runtime field still require either explicit validation parity or a written
reason they are evidence-only. “The factory ignores it” is not a valid reason to admit malformed
input. Unknown fields fail closed rather than becoming forward-compatible extensions.

## Hash limitation

The intentional hash exception is precise:

- TypeScript proves `manifestHash` equals the canonical, self-excluding content hash.
- G2 Luau proves only that the declared hash has the correct format and equals the reviewed expected
  value configured with the packaged ModuleScript.
- Repository review and `npm run layout:workflow:fixtures:check` prove the committed reference bytes
  match the deterministic G1d producer.
- G2 does not authenticate an arbitrary ModuleScript or table supplied after packaging.

This limitation must appear in loader diagnostics, runtime documentation, and Studio evidence. A
future untrusted transport boundary requires canonical Luau hash recomputation or an authenticated
envelope; it cannot reuse this assumption silently.

## Parity test plan

G2b will add table-driven Luau cases paired with TypeScript fixtures for every matrix row. Each case
contains a valid control, one isolated mutation, the TypeScript result, and the required Luau result.
The suite must include N−1/N/N+1 limits, NaN/infinity created directly in Luau, unknown fields at
nested levels, duplicate identities in every domain, and dangling references to every target class.

No runtime construction module may consume a manifest until all G2b blockers above are tested green.
