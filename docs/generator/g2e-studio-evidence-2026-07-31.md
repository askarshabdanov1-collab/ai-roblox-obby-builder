# G2e Studio evidence — 2026-07-31 pre-cutover acceptance runs

**Recorded sequence status:** Reference, `maximum-50`, `minimum-zero-checkpoint`, all four failure
boundaries, and the Phase 0 regression smoke completed

**Pre-cutover G2e status:** Incomplete; the remaining environment, raw measurement, Output, and
functional observation fields are listed below

This record transcribes the bounded values supplied by the human Studio operator. It does not
reconstruct omitted Output lines, environment fields, measurements, or observations. It authorizes
no default-runtime cutover and does not start G2f. The mandatory post-default-cutover rerun remains
future work and is not covered by this record.

## Identity and environment

| Field                         | Recorded value                                                            |
| ----------------------------- | ------------------------------------------------------------------------- |
| Human run date                | `2026-07-31`                                                              |
| Implementation commit         | `1379849686525d88c71245626e0360a00f1d48a9`                                |
| Prior documentation commit    | `ab5cfc7cb19b139d3762bdd7e0129d5718f0babc`                                |
| Fixture ID                    | `reference`                                                               |
| Manifest hash                 | `sha256:606e679659ba1461ba1baaa87f1f10bf7953dfc071da40ebaa6d39c2caa62146` |
| Artifact                      | `build/G2eStudioAcceptance.rbxlx`                                         |
| Artifact SHA-256              | `B6D3A65E71C51845755614CB0BB0859531426453817AE916F83EEFA04CC03401`        |
| Roblox Studio version         | `0.732.0.7321040`                                                         |
| Operating system              | `Windows 10 Pro 10.0.19045 build 19045`                                   |
| Play mode                     | Local server, two players                                                 |
| Tester                        | Human operator; personal identity not recorded in repository evidence     |
| Studio release channel        | Not supplied                                                              |
| CPU / logical processor count | Not supplied                                                              |
| Installed memory              | Not supplied                                                              |
| Graphics API / quality        | Not supplied                                                              |

The commit containing this update is recorded by Git history rather than self-referenced inside its
own content. It is documentation provenance and must not be confused with the implementation commit
or the commit string emitted by the Studio harness.

## Evidence classification

- **Machine-emitted Output** is quoted verbatim only where the exact line was supplied. Other
  machine results are labelled as operator-supplied summaries rather than reconstructed Output.
- **Manual human observations** describe player behavior or visual inspection performed in Studio;
  they are not represented as harness-generated records.
- **Harness limitations** describe a missing diagnostic path in the acceptance tooling. They are
  not converted into runtime failures when the underlying manual behavior passed.
- **Artifact and manifest identities** come from the tested artifact identity and committed fixture
  configuration. They remain distinct from both documentation commits and human observations.

## Fixture identities

The following hashes are the committed fixture identities configured in the tested harness. The
individual per-run measurement JSON lines were not supplied, so this table is not a reconstruction
of machine-emitted Output.

| Fixture ID                | Configured manifest hash                                                  |
| ------------------------- | ------------------------------------------------------------------------- |
| `reference`               | `sha256:606e679659ba1461ba1baaa87f1f10bf7953dfc071da40ebaa6d39c2caa62146` |
| `replacement-b`           | `sha256:2a14a42cf7d9dfaea45a1f01e0a4624581aa484b6b7472af7471e24cc3475e0e` |
| `maximum-50`              | `sha256:508ca29e776560a4a8919323555f481837687ae3504137b34574698245daad82` |
| `minimum-zero-checkpoint` | `sha256:3aa06678bdf7d7d30e6eb15b1b11745659d041e4a4c983cac16d1f7bb87cc717` |

## Stale `repositoryCommit` provenance

The machine measurement environment contains the literal
`repositoryCommit = "9a92540aad3183342096501f268eb1f966d640bf"`. Repository history shows that
this value was added in `eeae179f5837c22e2f6a3e08e84bd7e7391d4379` when the isolated Studio harness
was created, and it identifies the branch's original `main` base. The field is stored in the harness
environment and copied into `[G2 runtime measurement]`; fixture identities are configured separately
through their manifest hashes.

The value is therefore intentionally hardcoded historical harness provenance, but it is stale as
the `repositoryCommit` identity for the tested artifact built from
`1379849686525d88c71245626e0360a00f1d48a9`. It is not pinned fixture metadata and is not the tested
implementation identity. This documentation does not rewrite the literal in runtime code or alter
any emitted Output. The implementation commit plus artifact SHA-256 above identify the tested build,
while any supplied machine Output retains `9a92540aad3183342096501f268eb1f966d640bf` exactly.

## Static reference acceptance

The human run observed `[G2 acceptance] Reference ready` after the static acceptance observation
returned `PASS`.

| Field                 | Recorded value |
| --------------------- | -------------- |
| Status                | `PASS`         |
| Stages                | `15`           |
| Zones                 | `15`           |
| Required transitions  | `46`           |
| Route entries         | `46`           |
| BaseParts             | `54`           |
| Containers            | `4`            |
| Helper SpawnLocations | `1`            |
| Recorded errors       | `0`            |
| Recorded warnings     | `0`            |

## Reference build, replacement, and stale-callback evidence

The operator supplied the following machine-result summary:

- cold reference build: `PASS`;
- repeated reference builds 1–5: `PASS`;
- replacement with `replacement-b`: `PASS`;
- replacement back to `reference`: `PASS`.

The exact supplied final machine-emitted line was:

```text
[G2 acceptance] reference replacement sequence PASS
```

The final line is emitted only after the harness has completed all five repeated builds, both
replacements, and its single-active-root assertion. The individual fixed-schema measurement lines
for these runs were not supplied.

- Reference replacement sequence: `PASS`.
- Stale hazard callback rejection: `PASS`.
- `staleCallbackRejections`: `5`.
- `staleAcceptedActions`: `0`.

## Human gameplay procedure

1. The reference place was opened from the artifact identified above.
2. A local server with two players reached `[G2 acceptance] Reference ready`.
3. The reference replacement sequence and stale-hazard callback check were executed.
4. Player A activated a checkpoint, touched a lethal hazard, died, and respawned at the checkpoint.
5. Player B activated no checkpoint, touched a lethal hazard, died independently, and respawned at
   the initial Spawn.
6. `ObserveGameplay` was invoked from the server Command Bar.
7. The camera was moved around visible surfaces to inspect texture mixing, surface flicker, and
   z-fighting.

## Final gameplay observation

| Field                          | Recorded value               |
| ------------------------------ | ---------------------------- |
| Schema version                 | `g2-gameplay-observation-v1` |
| Fixture ID                     | `reference`                  |
| Status                         | `PASS`                       |
| Lethal player count            | `2`                          |
| Lethal actions                 | `2`                          |
| Respawns observed              | `2`                          |
| Checkpoint respawns observed   | `1`                          |
| Spawn respawns observed        | `1`                          |
| Hazard connections             | `6`                          |
| Hazard touch callbacks         | `21`                         |
| All touch callbacks            | `30`                         |
| Valid hazard character touches | `21`                         |
| All valid character touches    | `30`                         |
| Humanoids resolved             | `21`                         |
| Replacement count              | `35`                         |
| Stale accepted actions         | `0`                          |
| Stale callback rejections      | `5`                          |
| Checked geometry pairs         | `1378`                       |
| Unauthorized geometry overlaps | `0`                          |
| Coplanar visible surfaces      | `0`                          |
| Geometry epsilon               | `0.000001` studs             |
| Last touched Part              | `RightFoot`                  |
| Last touched Part class        | `MeshPart`                   |
| Last hazard object             | `Stage03Hazard001`           |
| Last character resolution      | `true`                       |
| Last Humanoid resolution       | `true`                       |

Every emitted final observation status was `PASS`:

1. `hazard-callback-bound`
2. `hazard-touch-callback-fired`
3. `valid-character-touch-observed`
4. `humanoid-resolved`
5. `lethal-action-observed`
6. `expected-respawn-observed`
7. `checkpoint-respawn-preserved`
8. `initial-spawn-fallback-preserved`
9. `second-player-independent`
10. `stale-callback-rejected`
11. `zero-stale-callback-actions`
12. `zero-unauthorized-geometry-intersections`
13. `zero-coplanar-visible-surfaces`

## Visual human observation

The operator reported that the prior Part overlap and z-fighting defect was no longer visible.
Camera movement showed no alternating surface colors, texture/color mixing from coplanar Parts, or
remaining surface flicker. Visible hazards functioned as lethal gameplay objects.

These are human observations for the recorded Studio environment. They are not universal physics,
scheduler, rendering, hardware, or future-engine guarantees.

## `maximum-50` build sequence

The operator supplied the following machine-result summary:

- cold `maximum-50` build: `PASS`;
- repeated same-manifest builds 1–5: `PASS`;
- every recorded run reported `errors=0`, `warnings=0`, and `orphans=0`.

The exact supplied final machine-emitted line was:

```text
[G2 acceptance] maximum-50 sequence PASS
```

The final line is emitted only after the cold build and all five repeated builds complete. Exact
per-run measurement JSON, elapsed times, object/connection counts, and memory values were not
supplied.

## `minimum-zero-checkpoint` two-player run

The operator supplied the following machine-result summary for the cold build:

- status: `PASS`;
- errors: `0`;
- warnings: `0`;
- orphans: `0`.

The human gameplay observations were:

1. Player 1 died and respawned at the initial Spawn.
2. Player 2 died independently and respawned at the initial Spawn.

`ObserveGameplay` is not supported for this fixture by the current acceptance harness. The control
path unconditionally requests the active fixture's configured `hazardObjectId`, while
`minimum-zero-checkpoint` has no configured hazard trace identity. This is recorded as an acceptance
harness limitation, not a SceneManifest `0.3` runtime failure. No unsupported gameplay-observation
Output is reconstructed or claimed.

## Failure-boundary runs

Each boundary was run in a separate fresh server. The operator supplied these machine result fields:

| Boundary         | Status | Reported failure code      |
| ---------------- | ------ | -------------------------- |
| `before-commit`  | `PASS` | `builder-injected-failure` |
| `after-retire`   | `PASS` | `commit-injected-failure`  |
| `after-publish`  | `PASS` | `commit-injected-failure`  |
| `before-pointer` | `PASS` | `commit-injected-failure`  |

The harness emits a boundary `PASS` only after confirming that the injected error surfaced and that
the previous active session and the single active root remained unchanged. Exact full Output sheets
for the four servers were not supplied.

## Phase 0 regression smoke

The repository evidence file is
[`phase0-smoke-2026-07-31.txt`](./phase0-smoke-2026-07-31.txt). It records the exact supplied
machine-emitted setup line:

```text
[Phase 0 smoke setup] Static engine checks passed; complete the documented two-player test.
```

It separately records these manual human observations:

- Player 1 activated a checkpoint, died, and respawned at that checkpoint.
- Player 2 did not activate a checkpoint, died, and respawned at the initial Spawn.
- Player state remained independent.
- No Output errors were observed.

## Supported conclusion

The reference fixture's static construction, replacement, stale-hazard rejection, two-player lethal
hazard behavior, checkpoint/spawn respawn selection, and visible geometry subsection is `PASS` for
the identities and environment recorded above. The supplied results also record the `maximum-50`
cold/repeated sequence, the `minimum-zero-checkpoint` cold build and two-player initial-spawn
fallback, all four fresh-server failure boundaries, and the unchanged Phase 0 two-player regression
smoke as completed.

Pre-cutover G2e is **not** formally `PASS`. The newly completed runs close the previously missing
sequence coverage, but the supplied evidence package still omits mandatory environment fields, raw
per-run measurements and Output, and functional observations required by the committed protocol.
SceneManifest `0.3` therefore remains opt-in and no default cutover is authorized by this record.

## Remaining mandatory evidence

The following pre-cutover protocol fields remain unrecorded or incompletely recorded:

1. Complete environment fields: Studio release channel, tester evidence identifier, CPU model and
   logical processor count, installed memory, and displayed graphics mode/API and quality.
2. The complete fixed-schema `[G2 runtime measurement]` and paired acceptance-observation lines for
   the reference cold build, five repeated builds, both replacement builds, `maximum-50` cold build
   and five repeated builds, and the `minimum-zero-checkpoint` cold build. Required per-run values
   include elapsed time, gameplay/decorative and runtime-owned object counts, connection counts, Lua
   heap readings, Studio memory observations where available, warnings, errors, and orphans. The
   supplied PASS and zero-count summaries are not substitutes for those raw bounded records.
3. The complete server/client Output and exact pass/fail sheets for the G2e servers. Only the exact
   final lines and bounded observations quoted above were supplied for repository capture.
4. Acceptance-wide exact gameplay/decorative Part classes, names, transforms, sizes, materials,
   colors, collision, touch, and query properties where the existing reference observation does not
   already provide the required field.
5. Wedge construction as `WedgePart` with no fallback Block.
6. Exactly one invisible, non-authoritative, scene-owned `_RuntimeSpawnLocation` with its required
   properties.
7. Exact recorded initial/checkpoint placement coordinates, vertical offsets, and route-facing
   directions for `0.3`.
8. Idempotent finish behavior and two-player finish isolation.
9. Same-manifest progress preservation using new Instances and different-manifest progress reset.
10. Queued old CharacterAdded, checkpoint, and finish callbacks becoming no-ops. The stale hazard
    callback case is already recorded `PASS`.
11. Unowned, ambiguously owned, and other-version root refusal in Studio.
12. Studio evidence for the required decorative collision/safe-route isolation cases where the
    reference fixture alone supplies no constructed decorative object.

The Studio procedure must also be repeated after any future default cutover. That rerun is a future
post-cutover gate and is explicitly not marked complete here.
