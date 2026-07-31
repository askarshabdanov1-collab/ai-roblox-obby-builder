# G2e Studio evidence — 2026-07-31 reference hazard and geometry run

**Recorded status:** Reference hazard/gameplay/geometry subsection PASS

**Full G2e status:** Incomplete; the remaining mandatory protocol items are listed below

This record transcribes the bounded values supplied by the human Studio operator. It does not
reconstruct omitted Output lines, environment fields, measurements, or observations. It authorizes
no default-runtime cutover and does not start G2f.

## Identity and environment

| Field                         | Recorded value                                                            |
| ----------------------------- | ------------------------------------------------------------------------- |
| Human run date                | `2026-07-31`                                                              |
| Implementation commit         | `1379849686525d88c71245626e0360a00f1d48a9`                                |
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

The earlier `9a92540aad3183342096501f268eb1f966d640bf` environment label is retained as historical
instrumentation context. For this run it is superseded by the implementation commit and artifact
identity above; it is not the accepted implementation identity.

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

## Replacement and stale-callback evidence

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

## Supported conclusion

The reference fixture's static construction, replacement, stale-hazard rejection, two-player lethal
hazard behavior, checkpoint/spawn respawn selection, and visible geometry subsection is `PASS` for
the identities and environment recorded above.

Full G2e is **not** formally complete. The supplied evidence does not cover every mandatory item in
the committed protocol, so SceneManifest `0.3` remains opt-in and no default cutover is authorized.

## Remaining mandatory evidence

The following protocol items remain unrecorded or incompletely recorded:

1. Complete environment fields: Studio release channel, tester evidence identifier, CPU model and
   logical processor count, installed memory, and displayed graphics mode/API and quality.
2. The complete fixed-schema measurement lines for the reference cold build, five repeated builds,
   replacement builds, elapsed times, connection/object counts, heap/memory readings where
   available, warnings, errors, and orphan counts. The supplied summary is not a substitute for
   those raw bounded records.
3. A fresh-server `maximum-50` cold build plus five repeated same-manifest builds, including its
   fixture hash and all required counts, timing, memory, warning, error, and orphan observations.
4. The two-player `minimum-zero-checkpoint` spawn, lethal hazard, death, and initial-spawn respawn
   procedure.
5. Each test-only failure boundary in a separate fresh server: `before-commit`, `after-retire`,
   `after-publish`, and `before-pointer`, with the transaction-specified previous-scene result.
6. The unchanged Phase 0 two-player Studio smoke as the SceneManifest `0.2` regression oracle.
7. Exact recorded initial/checkpoint placement coordinates, vertical offsets, and route-facing
   directions for `0.3`.
8. Idempotent finish behavior and two-player finish isolation.
9. Same-manifest progress preservation using new Instances and different-manifest progress reset.
10. Unowned, ambiguously owned, and other-version root refusal in Studio.
11. Studio evidence for the required decorative collision/safe-route isolation cases where the
    reference fixture alone supplies no constructed decorative object.
12. The server/client Output and exact pass/fail sheets required by the protocol were not supplied
    for repository capture and must accompany the relevant review evidence without secrets or local
    paths.

The Studio procedure must also be repeated after any future default cutover, as required by the
protocol.
