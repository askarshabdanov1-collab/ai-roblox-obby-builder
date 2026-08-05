# G2e remaining Studio acceptance audit

Audit date: `2026-07-31`

Audited implementation commit: `1379849686525d88c71245626e0360a00f1d48a9`

Latest evidence baseline: `42f83c357f2165d2f7ff3238d4c1d83e942eac51`

This is a documentation-only, repository-grounded audit. It does not change runtime behavior,
fixtures, manifests, generated scene data, or the current opt-in status of SceneManifest `0.3`.
Luau tests are cited as reusable implementation coverage, never as substitutes for required Studio
execution.

## 2026-08-01 implementation and 2026-08-05 Session 1 updates

The category matrix below is retained as the pre-implementation audit snapshot from commit
`25868cd60e33648f963f3cec60aa2ef348810c87`. Its `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` and
`REQUIRES_PROVENANCE_FIX_AND_RERUN` labels explain why the work was required; they are not a claim
that those implementation blocks remain open.

Provenance commit `2046121c5e5505397601ac7c6630a9fea9f0831b` and bounded-harness commit
`70e2c1ec3d3ed8cdcdd7f51e118beb1494f5b50c` implemented all H-01 through H-06 groups without
changing `roblox/src`. Artifact
`37C53E0FA4E9B2B3FD7444CCFDB5AD12025028B8ED6CEAC7E4C077C87EFC275F` is now historical: its first
Session 1 attempt exposed an acceptance-observer timing defect after the reference and stale-hazard
controls passed. Later repeated cold commands in that failed server are historical operator errors,
not the primary defect and not reusable evidence.

Placement repair `cbf36e21feb0b99ffaaee9b48c95e88e9be37c1b` captures exact CFrames at successful runtime
assignment rather than sampling live characters after scheduler delay or physics separation. It
does not change production runtime behavior or the `0.00001` tolerance. The replacement artifact is
SHA-256 `C74BDBAAC5EE31F736CEF0A2A4F0FD0F95767A4276B0CC8514F6BFC93C52A5F0`, size `2,806,612`
bytes, with embedded `repositoryCommit=cbf36e21feb0b99ffaaee9b48c95e88e9be37c1b`. The stale literal is
absent from that superseded artifact.

The second Session 1 attempt used that placement-fixed artifact and proved the precondition and all
eight reference-sequence builds. `VerifyStaleHazardCallback` then sampled the first player's
character before the scheduler had made a BasePart available. Readiness repair
`56c2b51291b8e918a1c9559277a2590e18ee06af` adds a 120-resume acceptance-only bound with typed
missing-character and missing-Part failures; it does not weaken the stale assertion or change
production runtime behavior. Commit `685813a2265165a46dfe4d0b686934abf285ce23` additionally requires
the probe to be an actual `BasePart`. That superseded readiness artifact is SHA-256
`886AC77250805E7088B48729391B5336765AA6B444877DBC4216AFDC8DB305BC`, size `2,809,583` bytes, with
embedded `repositoryCommit=685813a2265165a46dfe4d0b686934abf285ce23`.

The third Session 1 attempt proved that `Players:GetPlayers()[1]` had a `Character` but no BasePart
after the bound. Its artifact never inspected player 2, so no stronger avatar-state conclusion is
valid. Deterministic-selection repair `cbe5a5c43debe21cb144829cb704c6b378d1e80a` scans every player,
sorts candidates internally by numeric `UserId`, exposes no IDs, and adds an immediate two-avatar
readiness handshake. The operator sequence is now split around visual confirmation of both clients.
The current artifact is SHA-256
`D1C689A2D18B715BA42BF9475B9D6E78AB31D8AE5C4BB3CA26362BB9AA39849A`, size `2,816,523` bytes, with
embedded `repositoryCommit=cbe5a5c43debe21cb144829cb704c6b378d1e80a`.

The current recommendation remains `READY_FOR_FINAL_EVIDENCE_COLLECTION`. Session 1 must restart
from a fresh server with the replacement artifact, so exactly seven fresh Studio sessions remain.
No failed or repeated line from any superseded attempt completes a requirement. The historical
classification table and historical Output remain unchanged.

The audit inspected the committed Studio protocols and evidence; Phase 0 smoke procedure and
completion record; compatibility and G2d handoff documents; both Rojo smoke projects; the G2e
bootstrap, harness, observation modules, and fixture configuration; `BuilderV03`,
`RuntimeSessionV03`, and `SceneBuilderCoreV03`; construction, builder, runtime-session, and G2e
acceptance Luau tests; `package.json`; `tools/prepare-build.ts`; Git history for the stale commit
literal; and the generated fixture index. Relevant source locations are cited in the matrix and
plans below.

## 1. Executive status

Runtime functionality appears accepted for the exercised paths: the reference cold/repeated and
replacement sequence, `maximum-50`, two-player reference and zero-checkpoint death/respawn,
four rollback boundaries, focused lethal-hazard behavior, stale kill rejection, geometry integrity,
and the Phase 0 regression smoke all have recorded successful evidence. The remaining blockers are
acceptance evidence quality and coverage, not a proven gameplay defect.

Pre-cutover G2e is **not** formally `PASS`. The repaired artifact can now produce commit-bound
measurement and bounded functional evidence, but the seven human Studio sessions and evidence
package have not been executed. Successful Luau coverage validates the harness boundary; it does
not substitute for Studio execution.

The 64 audited requirements classify as follows:

| Category                                  |  Count |
| ----------------------------------------- | -----: |
| `ALREADY_PROVEN`                          |     26 |
| `PROVABLE_FROM_EXISTING_MACHINE_EVIDENCE` |      2 |
| `PROVABLE_BY_STATIC_STUDIO_INSPECTION`    |      6 |
| `REQUIRES_NEW_MANUAL_STUDIO_RUN`          |      5 |
| `REQUIRES_ACCEPTANCE_HARNESS_CHANGE`      |     16 |
| `REQUIRES_PROVENANCE_FIX_AND_RERUN`       |      8 |
| `DEFERRED_UNTIL_DEFAULT_CUTOVER`          |      1 |
| **Total**                                 | **64** |

The original critical path was finite and its implementation portion is complete:

1. ~~Repair build-time commit provenance and bounded acyclic controls.~~ Complete.
2. ~~Add acceptance-only inspectors while keeping `roblox/src` unchanged.~~ Complete.
3. Record the missing static environment fields for the identified rebuilt artifact.
4. Execute seven fresh Studio server sessions: one combined two-player reference session, one
   `maximum-50` session, one two-player zero-checkpoint session, and four separate failure-boundary
   sessions.
5. Commit bounded extracted records and the human checklist, and attach complete sanitized
   server/client Output to the review.

### Audit findings that prevent redundant or invalid work

- `G2eAcceptanceHarness.assertScene` already checks every constructed Part's exact class, name,
  size, CFrame, color, material, anchored/collision/touch/query properties, attributes, hierarchy,
  helper SpawnLocation properties, counts, and the gameplay-connection upper bound. Do not manually
  transcribe every Part. Emit and retain one bounded inspection receipt per fixture instead.
- The official reference sequence uses repeated `runIndex` values `1..5` and replacement indices
  `1,2`; the official maximum sequence uses cold index `1` and repeated indices `1..5`. This is
  correct. Earlier ad hoc `pcall`/generic-Build attempts are not official sequence evidence and
  must not be used to infer duplicate or incorrect indices.
- The current maximum sequence's indices are correct but its `cold` label is not. The bootstrap
  always builds reference before exposing `G2eControl`, so the first `maximum-50` build occurs after
  a reference build in the same server. It is a replacement mislabeled as cold under the protocol's
  own definition. The same warning applies to an ad hoc zero-checkpoint build labelled cold; the
  protocol requires zero-checkpoint behavior, not a separate zero-checkpoint cold performance run.
- The Command Bar error `tables cannot be cyclic` is caused by the generic `Build` BindableFunction
  returning the cyclic runtime result. It does not invalidate `RunReferenceReplacementSequence` or
  `RunMaximumSequence`, which return `nil` after printing their PASS lines. It does make future
  generic wedge/decorative evidence ambiguous because an otherwise successful build ends with an
  interface error; formal closure requires an acyclic receipt.
- `ObserveGameplay` unconditionally requests a configured hazard trace. The
  `minimum-zero-checkpoint` fixture has no configured trace identity. This is a harness limitation,
  not a runtime failure, and it does not invalidate the existing two-player human observation. A
  zero-checkpoint-specific bounded observer is optional, not on the critical path.
- The protocol's counts section requires fields that the fixed measurement JSON does not contain.
  Stage/zone/route/transition and constructed counts are present in the paired acceptance
  observation, but active-root count, connection breakdown, monotonic start/end values, and Studio
  memory observations are not emitted anywhere. This is a protocol/harness schema mismatch.
- The protocol says complete server/client Output must be attached to the review; it does not say
  every raw console line must be committed. Bounded extracted JSONL records plus a human checklist
  are appropriate committed evidence only if the complete sanitized Output is also retained as a
  review attachment. The repository ignores `*.log`, which reinforces attachment rather than log
  commitment.
- Installed RAM and CPU identity are mandatory environment metadata because the protocol says the
  execution record “must include” them. Studio memory-category readings remain conditional “when
  available.” Missing environment metadata blocks formal acceptance but does not imply a runtime
  defect.
- The recorded final reference gameplay observation names `Stage03Hazard001` as its last hazard,
  while the focused procedure requires both players to touch `Stage04Hazard001`. Broad lethal-hazard
  behavior is proven; the exact Stage04 manual-touch requirement is not.
- The 2026-07-25 Phase 0 completion record and the 2026-07-31 regression record are different
  evidence. The earlier record must not replace the required regression rerun; the later record is
  the applicable execution evidence.

## 2. Requirement matrix

Category names are exact. “Prov.” means dependency on provenance repair. “Cutover” means dependency
on the future default cutover. “No new” in the server column means the recorded run is sufficient
for that requirement; it does not waive separate packaging requirements.

### Environment and identity

| ID     | Requirement and source                                                                                                    | Category                               | Current evidence; sufficient?                                                        | Exact gap and smallest next action                                                                                 | Runtime untouched? | Fresh server; players         | Expected PASS evidence                                                          | Failure condition                                   | Prov. | Cutover |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | ----- | ------- |
| ENV-01 | Record execution date (`g2-studio-acceptance.md`, Measurement environment).                                               | `ALREADY_PROVEN`                       | `g2e-studio-evidence-2026-07-31.md`: `2026-07-31`; yes.                              | None.                                                                                                              | Yes                | No new; 0                     | Date retained in environment sheet.                                             | Date absent or inconsistent.                        | No    | No      |
| ENV-02 | Record tester (`g2-studio-acceptance.md`, Measurement environment).                                                       | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | “Human operator” only; no stable evidence identifier; no.                            | Add a non-personal tester evidence identifier to the environment sheet.                                            | Yes                | No; 0                         | Non-secret tester ID present.                                                   | Missing, personal-data-only, or ambiguous identity. | No    | No      |
| ENV-03 | Exact Studio version (`g2-studio-acceptance.md`, Measurement environment).                                                | `ALREADY_PROVEN`                       | `0.732.0.7321040`; yes.                                                              | Copy unchanged into final environment sheet.                                                                       | Yes                | No new; 0                     | Exact version matches Output/artifact run.                                      | Version missing or differs.                         | No    | No      |
| ENV-04 | Studio release channel (`g2-studio-acceptance.md`, Measurement environment).                                              | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | Not supplied; no.                                                                    | Read the channel from Studio About/settings before the rerun.                                                      | Yes                | No gameplay; 0                | Exact displayed channel, or explicit “not displayed” with screenshot/reference. | Invented or omitted channel.                        | No    | No      |
| ENV-05 | Windows edition, version, and build (`g2-studio-acceptance.md`, Measurement environment).                                 | `ALREADY_PROVEN`                       | Windows 10 Pro `10.0.19045 build 19045`; yes.                                        | Copy unchanged.                                                                                                    | Yes                | No new; 0                     | Exact OS string retained.                                                       | Missing or inconsistent OS.                         | No    | No      |
| ENV-06 | CPU model and logical processor count (`g2-studio-acceptance.md`, Measurement environment).                               | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | Not supplied; no.                                                                    | Record Windows System Information values.                                                                          | Yes                | No gameplay; 0                | CPU model and integer logical processor count.                                  | Either field absent.                                | No    | No      |
| ENV-07 | Installed memory (`g2-studio-acceptance.md`, Measurement environment).                                                    | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | Not supplied; no.                                                                    | Record installed RAM from Windows System Information.                                                              | Yes                | No gameplay; 0                | Exact displayed installed memory and unit.                                      | Missing or estimated value.                         | No    | No      |
| ENV-08 | Studio Play mode and player count (`g2-studio-acceptance.md`, Measurement environment).                                   | `ALREADY_PROVEN`                       | Local server, two players recorded for gameplay; yes.                                | Preserve per-run player counts in final sheet.                                                                     | Yes                | No new; recorded 2            | Mode and count recorded for each run.                                           | Mode/count absent or wrong.                         | No    | No      |
| ENV-09 | Graphics mode/API and quality where displayed (`g2-studio-acceptance.md`, Measurement environment).                       | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | Not supplied; no.                                                                    | Record displayed renderer/API, graphics mode, and quality; use “not displayed” only where Studio exposes no value. | Yes                | No gameplay; 0                | Exact displayed values or explicit unavailability.                              | Omitted or invented value.                          | No    | No      |
| ENV-10 | Reference fixture ID and manifest hash (`g2-studio-acceptance.md`, Measurement environment).                              | `ALREADY_PROVEN`                       | `reference` and `sha256:606e…2146`; yes.                                             | None.                                                                                                              | Yes                | No new; 0                     | Hash equals committed fixture/harness value.                                    | ID/hash mismatch.                                   | No    | No      |
| ENV-11 | `maximum-50` fixture ID and manifest hash (`g2-studio-acceptance.md`, Measurement environment).                           | `ALREADY_PROVEN`                       | `maximum-50` and `sha256:508c…d82`; yes.                                             | None.                                                                                                              | Yes                | No new; 0                     | Hash equals committed fixture/harness value.                                    | ID/hash mismatch.                                   | No    | No      |
| ENV-12 | Rojo artifact identity and SHA-256 (`g2-studio-acceptance.md`, Measurement environment).                                  | `ALREADY_PROVEN`                       | `build/G2eStudioAcceptance.rbxlx`, SHA-256 `B6D3…3401`; yes for historical artifact. | Preserve as historical identity; create a new identity record after provenance repair.                             | Yes                | No new; 0                     | Filename and exact SHA pair.                                                    | Hash mismatch or unidentified artifact.             | No    | No      |
| ENV-13 | Repository commit in machine measurement records (`g2-studio-acceptance.md`, Measurement environment and Logging format). | `REQUIRES_PROVENANCE_FIX_AND_RERUN`    | Output says `9a92540…`; tested implementation is `1379849…`; no.                     | Inject the reviewed build commit deterministically, rebuild, and rerun all G2e machine sequences.                  | Yes                | Covered by 7 planned sessions | Every measurement contains the selected 40-hex commit and new artifact SHA.     | Old literal, missing commit, or mismatch.           | Yes   | No      |

### Build protocol and completed sequences

| ID     | Requirement and source                                                                                        | Category                                  | Current evidence; sufficient?                                                                                                                            | Exact gap and smallest next action                                                                    | Runtime untouched? | Fresh server; players         | Expected PASS evidence                                                          | Failure condition                                                          | Prov.          | Cutover |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------- | ------- |
| BLD-01 | Run install/fixture/validation/build prerequisites (`g2-studio-acceptance.md`, Build protocol step 1).        | `PROVABLE_FROM_EXISTING_MACHINE_EVIDENCE` | Package scripts, deterministic checks, prior validation reports, and artifact SHA exist; mapping is incomplete.                                          | Map exact command results into the final checklist; no Studio rerun solely for this item.             | Yes                | No; 0                         | All commands exit 0 and artifact hash recorded.                                 | Any command fails or output artifact differs unexpectedly.                 | No             | No      |
| BLD-02 | Open the isolated G2 smoke place, not active `0.2` (`g2-studio-acceptance.md`, step 2).                       | `PROVABLE_FROM_EXISTING_MACHINE_EVIDENCE` | `g2e-smoke.project.json` contains only V03 runtime/harness/manifests; G2 Output and hashes match; documentation mapping is incomplete.                   | Cite project isolation and artifact identity in final checklist.                                      | Yes                | No new; 0                     | G2e project name and V03 fixture Output.                                        | Phase 0/default bootstrap runs instead.                                    | No             | No      |
| BLD-03 | Confirm no scene exists before first opt-in `0.3` build (`g2-studio-acceptance.md`, step 3).                  | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE`      | Rojo project is empty by construction, but no Studio pre-build assertion/record exists; no.                                                              | Assert and emit active-root count before `api:build` in bootstrap.                                    | Yes                | Fresh reference; 2            | `preBuildGeneratedObbyCount=0`, `PASS`.                                         | Any preexisting root or missing record.                                    | After fix      | No      |
| BLD-04 | One cold reference build (`g2-studio-acceptance.md`, step 4).                                                 | `ALREADY_PROVEN`                          | Recorded cold `PASS` and `Reference ready`; yes for execution.                                                                                           | Do not rerun for functionality; rerun only for corrected provenance/raw packaging.                    | Yes                | No new; recorded 2            | Cold measurement/observation PASS.                                              | Build/assertion failure.                                                   | Packaging only | No      |
| BLD-05 | Five same-manifest reference rebuilds (`g2-studio-acceptance.md`, step 5).                                    | `ALREADY_PROVEN`                          | Official sequence final PASS; runIndex `1..5` is correct; yes for execution.                                                                             | No functional rerun; provenance rerun uses official sequence unchanged.                               | Yes                | No new; recorded 2            | Five repeated records, indices `1..5`, final PASS.                              | Missing/duplicate index or failure.                                        | Packaging only | No      |
| BLD-06 | Replace reference with `replacement-b`, then back (`g2-studio-acceptance.md`, step 6).                        | `ALREADY_PROVEN`                          | Final reference replacement sequence PASS; yes.                                                                                                          | Preserve historical evidence; recapture on provenance-fixed artifact.                                 | Yes                | No new; recorded 2            | Replacement indices `1,2`, one active root, final PASS.                         | Failed build, wrong fixture, or ambiguous root.                            | Packaging only | No      |
| BLD-07 | Fresh-server `maximum-50` cold plus five repeats (`g2-studio-acceptance.md`, step 7).                         | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE`      | Final maximum sequence PASS proves six successful maximum builds, but bootstrap built reference first; the `cold` label is false under the protocol; no. | Let a fresh server select `maximum-50` before any build, then run repeated indices `1..5`.            | Yes                | Fresh maximum; 1              | Pre-build root count zero, maximum cold index `1`, repeated `1..5`, final PASS. | Any prior build, wrong indices, error/warning/orphan, or non-fresh server. | After fix      | No      |
| BLD-08 | Two-player reference procedure (`g2-studio-acceptance.md`, step 8).                                           | `ALREADY_PROVEN`                          | Final gameplay observation PASS with two independent players; yes except exact Stage04 target, audited separately.                                       | Do not repeat broad hazard proof; target Stage04 during combined provenance rerun.                    | Yes                | No new; recorded 2            | Two lethal players, checkpoint and spawn respawns.                              | Shared state or missing respawn.                                           | Packaging only | No      |
| BLD-09 | Two-player zero-checkpoint procedure (`g2-studio-acceptance.md`, step 8).                                     | `ALREADY_PROVEN`                          | Both players died independently and returned to Spawn; yes.                                                                                              | Preserve manual record; recapture with final artifact/output package.                                 | Yes                | No new; recorded 2            | Two independent initial-spawn respawns, zero build errors.                      | Checkpoint state appears or players interfere.                             | Packaging only | No      |
| BLD-10 | `before-commit` in a separate fresh server (`g2-studio-acceptance.md`, step 9).                               | `ALREADY_PROVEN`                          | PASS with `builder-injected-failure`; yes.                                                                                                               | No functional rerun; provenance rerun remains separate.                                               | Yes                | No new; recorded fresh server | Previous root/session unchanged; expected code.                                 | Wrong code or scene/session change.                                        | Packaging only | No      |
| BLD-11 | `after-retire` in a separate fresh server (`g2-studio-acceptance.md`, step 9).                                | `ALREADY_PROVEN`                          | PASS with `commit-injected-failure`; yes.                                                                                                                | Same as above.                                                                                        | Yes                | No new; recorded fresh server | Previous root/session unchanged; expected code.                                 | Wrong code or scene/session change.                                        | Packaging only | No      |
| BLD-12 | `after-publish` in a separate fresh server (`g2-studio-acceptance.md`, step 9).                               | `ALREADY_PROVEN`                          | PASS with `commit-injected-failure`; yes.                                                                                                                | Same as above.                                                                                        | Yes                | No new; recorded fresh server | Previous root/session unchanged; expected code.                                 | Wrong code or scene/session change.                                        | Packaging only | No      |
| BLD-13 | `before-pointer` in a separate fresh server (`g2-studio-acceptance.md`, step 9).                              | `ALREADY_PROVEN`                          | PASS with `commit-injected-failure`; yes.                                                                                                                | Same as above.                                                                                        | Yes                | No new; recorded fresh server | Previous root/session unchanged; expected code.                                 | Wrong code or scene/session change.                                        | Packaging only | No      |
| BLD-14 | Rerun unchanged Phase 0 two-player smoke (`g2-studio-acceptance.md`, step 10; `roblox-studio-smoke-test.md`). | `ALREADY_PROVEN`                          | `phase0-smoke-2026-07-31.txt` records setup PASS, independent checkpoint/spawn respawns, and no Output errors; accepted as completed execution.          | Packaging checklist must link the 2026-07-31 record, not substitute the 2026-07-25 historical result. | Yes                | No new; recorded 2            | Exact setup line plus completed two-player sheet.                               | Bootstrap assertion, shared state, or Output error.                        | No             | No      |

### Functional and focused Studio observations

| ID     | Requirement and source                                                                                                                                                                                                                        | Category                             | Current evidence; sufficient?                                                                                             | Exact gap and smallest next action                                                                          | Runtime untouched? | Fresh server; players                  | Expected PASS evidence                                                           | Failure condition                                                 | Prov.          | Cutover |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- | ------- |
| FUN-01 | Exact Part counts, classes, names, transforms, sizes, materials, colors, and collision/touch/query properties (`g2-studio-acceptance.md`, Functional observations).                                                                           | `REQUIRES_PROVENANCE_FIX_AND_RERUN`  | `assertScene` checks these on every build, but raw commit-bound receipts are absent; not formally sufficient.             | On rebuilt artifact capture bounded static-inspection PASS records for completed fixtures.                  | Yes                | Combined reference, max, zero sessions | Fixture/hash, checked counts/property set, status PASS.                          | Any assertion fails, receipt missing, or wrong commit.            | Yes            | No      |
| FUN-02 | Wedge constructs as `WedgePart`, never fallback Block (Functional observations).                                                                                                                                                              | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Wedge fixture and Luau test exist; no Studio run. Generic Build has cyclic-return error.                                  | Add wedge to an acyclic bounded static fixture sequence.                                                    | Yes                | Combined reference session; 2          | `fixtureId=wedge`, `wedgeCount=1`, native class PASS.                            | Class is not `WedgePart`, build error, or cyclic interface error. | After fix      | No      |
| FUN-03 | Exactly one invisible non-authoritative scene-owned `_RuntimeSpawnLocation` (Functional observations).                                                                                                                                        | `REQUIRES_PROVENANCE_FIX_AND_RERUN`  | `assertScene` verifies class, count, transparency, collision/query/touch, and marker, but no commit-bound raw receipt.    | Capture the static-inspection receipt after provenance repair.                                              | Yes                | Combined required runs                 | Count `1` and all helper checks PASS.                                            | Missing/multiple/visible/authoritative helper.                    | Yes            | No      |
| FUN-04 | Exact initial HRP center, vertical offset, and route-facing direction (Functional observations).                                                                                                                                              | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Manual notes prove respawn choice, not exact numeric CFrame/LookVector; Luau tests are reusable only.                     | Add bounded two-player placement inspector and run before movement.                                         | Yes                | Fresh reference; 2                     | Actual/expected position and LookVector within fixed epsilon for both players.   | Numeric mismatch or missing player/root.                          | After fix      | No      |
| FUN-05 | Exact checkpoint respawn center, offset, and next-route facing (Functional observations).                                                                                                                                                     | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Respawn selected checkpoint, but numeric transform/facing not recorded.                                                   | Emit bounded placement comparison after Player A checkpoint death.                                          | Yes                | Fresh reference; 2                     | Expected object ID, position, offset, LookVector, PASS.                          | Wrong center/height/facing or cross-player state.                 | After fix      | No      |
| FUN-06 | Zero-checkpoint spawn/death behavior (Functional observations).                                                                                                                                                                               | `ALREADY_PROVEN`                     | Two independent initial-spawn respawns recorded; yes.                                                                     | No additional behavior run except final-artifact packaging.                                                 | Yes                | No new; recorded 2                     | Two-player human sheet and zero errors.                                          | Any checkpoint state or wrong respawn.                            | Packaging only | No      |
| FUN-07 | Hazards affect only a current matching player character (Functional observations).                                                                                                                                                            | `ALREADY_PROVEN`                     | Bounded valid-character/Humanoid/lethal/two-player/stale results PASS; yes.                                               | None beyond provenance recapture.                                                                           | Yes                | No new; recorded 2                     | Current character killed; invalid/stale touch rejected.                          | Wrong player/character affected.                                  | Packaging only | No      |
| FUN-08 | Finish state is idempotent (Functional observations).                                                                                                                                                                                         | `REQUIRES_NEW_MANUAL_STUDIO_RUN`     | Luau test exists; no Studio observation.                                                                                  | Player A touches Finish repeatedly; capture stable `ObbyV03FinishedManifestHash` and bounded scalar query.  | Yes                | Combined fresh reference; 2            | First touch sets current hash; repeats do not change it or add side effects.     | Missing/wrong/changed finish state.                               | Run after fix  | No      |
| FUN-09 | Two-player checkpoint and respawn isolation (Functional observations).                                                                                                                                                                        | `ALREADY_PROVEN`                     | Reference and Phase 0 records show checkpoint/spawn independence; yes.                                                    | Avoid redundant rerun except combined final artifact session.                                               | Yes                | No new; recorded 2                     | Player A checkpoint, Player B Spawn, independent states.                         | State leaks between players.                                      | Packaging only | No      |
| FUN-10 | Per-player/per-character hazard debounce isolation (Functional observations).                                                                                                                                                                 | `ALREADY_PROVEN`                     | 21 hazard callbacks produced exactly two lethal actions for two players; yes.                                             | Map counts explicitly in final checklist.                                                                   | Yes                | No new; recorded 2                     | Multiple body/accessory callbacks do not duplicate a character kill.             | Lethal actions exceed expected unique characters.                 | Packaging only | No      |
| FUN-11 | Two-player finish isolation (Functional observations).                                                                                                                                                                                        | `REQUIRES_NEW_MANUAL_STUDIO_RUN`     | Luau test exists; no Studio observation.                                                                                  | Finish Player A, verify Player B unset, then finish Player B independently.                                 | Yes                | Combined fresh reference; 2            | Per-player finish attributes transition independently.                           | Player B inherits A state or cannot finish.                       | Run after fix  | No      |
| FUN-12 | Same-manifest progress survives rebuild using new Instances (Functional observations).                                                                                                                                                        | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | `G2BuilderTests` proves policy in fakes; no Studio hook/receipt.                                                          | Add a bounded progress sequence comparing old/new root and Part identity plus checkpoint/finish state.      | Yes                | Combined fresh reference; 2            | New root/Parts, old disposed, IDs and both players' valid progress preserved.    | Old Instance retained or progress lost/corrupted.                 | After fix      | No      |
| FUN-13 | Different-manifest replacement resets progress (Functional observations).                                                                                                                                                                     | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Reusable Luau test exists; no Studio hook/receipt.                                                                        | Extend progress sequence to `replacement-b` and emit per-player cleared attributes/state.                   | Yes                | Combined fresh reference; 2            | Both players' checkpoint/finish state clears on different hash.                  | Any old progress survives or players merge.                       | After fix      | No      |
| FUN-14 | Successful replacement exposes exactly one complete `GeneratedObby` root (Functional observations).                                                                                                                                           | `ALREADY_PROVEN`                     | Official sequence prints PASS only after `assertSingleActiveRoot`; yes.                                                   | Map code-to-evidence in checklist.                                                                          | Yes                | No new; recorded                       | One active complete root with expected hash.                                     | Zero/multiple/incomplete root.                                    | Packaging only | No      |
| FUN-15 | Queued old CharacterAdded callback becomes a no-op (Functional observations).                                                                                                                                                                 | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau test exists; no Studio injection hook.                                                                               | Add acceptance-only deferred placement capture/replacement/check sequence.                                  | Yes                | Combined fresh reference; 2            | Stale character CFrame unchanged; current character placed.                      | Old queued callback moves stale character.                        | After fix      | No      |
| FUN-16 | Old checkpoint callback becomes a no-op (Functional observations).                                                                                                                                                                            | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau test exists; no Studio receipt.                                                                                      | Add old-session checkpoint invocation to stale-callback suite.                                              | Yes                | Combined fresh reference; 2            | No checkpoint attribute/state mutation; stale rejection recorded.                | Progress mutates.                                                 | After fix      | No      |
| FUN-17 | Old kill callback becomes a no-op (Functional observations).                                                                                                                                                                                  | `ALREADY_PROVEN`                     | Explicit stale hazard callback rejection PASS, five rejections, zero actions; yes.                                        | Do not rerun solely for this callback; include in combined suite receipt after artifact change.             | Yes                | No new; recorded                       | Rejection delta positive, lethal delta zero.                                     | Any stale lethal action.                                          | Packaging only | No      |
| FUN-18 | Old finish callback becomes a no-op (Functional observations).                                                                                                                                                                                | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau test exists; no Studio receipt.                                                                                      | Add old-session finish invocation and per-player attribute check.                                           | Yes                | Combined fresh reference; 2            | No finish state/attribute mutation.                                              | Stale finish sets progress.                                       | After fix      | No      |
| FUN-19 | Refuse an unowned root without modification (Functional observations; compatibility Ownership rules).                                                                                                                                         | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau/Phase 0 coverage exists, but no V03 Studio hook.                                                                     | Add bounded adversarial-root refusal case with cleanup.                                                     | Yes                | Combined reference session; 2          | Typed refusal, original root unchanged, candidate destroyed.                     | Unowned root replaced/mutated.                                    | After fix      | No      |
| FUN-20 | Refuse ambiguous active roots (Functional observations; compatibility Ownership rules).                                                                                                                                                       | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau test exists; no V03 Studio hook.                                                                                     | Add duplicate-root refusal case.                                                                            | Yes                | Combined reference session; 2          | `active-root-ambiguous`, no scene mutation.                                      | Ambiguity accepted or cleanup incomplete.                         | After fix      | No      |
| FUN-21 | Refuse an other-version root (Functional observations; compatibility Ownership rules).                                                                                                                                                        | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Luau test exists; no V03 Studio hook.                                                                                     | Add `AIObbyBuilder/0.2` root refusal case in isolated harness state.                                        | Yes                | Combined reference session; 2          | Typed ownership refusal; 0.2 root unchanged.                                     | Cross-version replacement occurs.                                 | After fix      | No      |
| FUN-22 | Decorative objects never enter safe route or gameplay collision layer (Functional observations).                                                                                                                                              | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE` | Decorative fixture and exact Luau tests exist; reference has zero decoration; no Studio run.                              | Include decorative fixture in static sequence; emit collision/query/touch and safe-route membership checks. | Yes                | Combined reference session; 2          | Decorative count `1`, all authority flags false, safe-route violations `0`.      | Collision authority or safe-route membership.                     | After fix      | No      |
| FOC-01 | Bounded gameplay record passes hazard binding/touch, valid character, Humanoid, lethal action, respawns, two-player independence, stale rejection, replacement, and geometry IDs (`g2-studio-acceptance.md`, Focused reference hazard check). | `ALREADY_PROVEN`                     | All 13 observation IDs recorded PASS; yes.                                                                                | Preserve exact bounded record.                                                                              | Yes                | No new; recorded 2                     | `g2-gameplay-observation-v1`, status PASS, all IDs PASS.                         | Any missing/FAIL ID.                                              | Packaging only | No      |
| FOC-02 | Human camera inspection finds no flicker, color mixing, or z-fighting (Focused reference hazard check).                                                                                                                                       | `ALREADY_PROVEN`                     | Human visual observation recorded; yes for tested environment.                                                            | Preserve as human, not machine evidence.                                                                    | Yes                | No new; recorded human                 | Checklist PASS with environment identity.                                        | Visible flicker/mixing/z-fighting.                                | No             | No      |
| FOC-03 | Zero unauthorized geometry intersections and zero coplanar visible surfaces (Focused reference hazard check).                                                                                                                                 | `ALREADY_PROVEN`                     | Bounded record: `1378` pairs, both zero; yes.                                                                             | Preserve exact values.                                                                                      | Yes                | No new; 0                              | Both observations PASS.                                                          | Either count nonzero.                                             | Packaging only | No      |
| FOC-04 | Emit the exact focused `Stage04Hazard001` trace (Focused reference hazard check).                                                                                                                                                             | `REQUIRES_PROVENANCE_FIX_AND_RERUN`  | Procedure names Stage04, but full trace is not retained in committed evidence and current Output provenance is stale; no. | On rebuilt artifact capture `InspectHazard("Stage04Hazard001")` JSON verbatim.                              | Yes                | Combined fresh reference; 2            | Trace fixture/hash/object IDs and Part properties match Stage04, callback bound. | Missing/wrong object or FAIL/assertion.                           | Yes            | No      |
| FOC-05 | Both players manually touch `Stage04Hazard001` as specified (Focused reference hazard check).                                                                                                                                                 | `REQUIRES_NEW_MANUAL_STUDIO_RUN`     | Final record's last hazard is Stage03; broad hazard behavior is proven, exact Stage04 touch is not.                       | During combined reference run, both players use Stage04 for the required deaths.                            | Yes                | Fresh reference; 2                     | Human sheet names Stage04; bounded trace/gameplay PASS.                          | Either player uses another hazard or expected respawn fails.      | Run after fix  | No      |

### Measurements and evidence packaging

| ID      | Requirement and source                                                                                                                                                | Category                               | Current evidence; sufficient?                                                                              | Exact gap and smallest next action                                                                     | Runtime untouched? | Fresh server; players                 | Expected PASS evidence                                                 | Failure condition                                                 | Prov.           | Cutover |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------- | ------- |
| MET-01  | Record manifest stage/zone/route/transition and constructed root/folder/BasePart/SpawnLocation counts for each cold/repeated run (`g2-studio-acceptance.md`, Counts). | `REQUIRES_PROVENANCE_FIX_AND_RERUN`    | Paired observations emit most counts; root count and raw records are missing/stale; no.                    | Extend root count, repair provenance, recapture all official sequence records.                         | Yes                | Seven planned sessions                | Every run has fixture/hash/index and exact bounded counts.             | Missing record/count, mismatch, or stale commit.                  | Yes             | No      |
| MET-02  | Record runtime-owned Instances, total connections, elapsed time, heap, warnings/errors/orphans for each cold/repeated run (Counts and Logging format).                | `REQUIRES_PROVENANCE_FIX_AND_RERUN`    | Harness emits these fields, but raw records were not retained and commit field is stale; no.               | Rerun official sequences and extract exact prefixed JSON lines.                                        | Yes                | Seven planned sessions                | Complete ordered records; warnings/errors/orphans zero where required. | Missing run, invalid field, stale commit, or unexpected error.    | Yes             | No      |
| MET-03  | Record checkpoint, kill, finish, CharacterAdded, PlayerRemoving, and total connection counts (Counts).                                                                | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE`   | Only session total and hazard count are exposed; no breakdown.                                             | Derive and emit bounded counts from manifest/session/builder coordinator state.                        | Yes                | Captured in planned runs              | All named categories plus total; totals reconcile.                     | Missing category or inconsistent total.                           | After fix       | No      |
| MET-04  | Record build start/end readings from one monotonic source (Counts).                                                                                                   | `REQUIRES_ACCEPTANCE_HARNESS_CHANGE`   | Harness records only elapsed time; no start/end fields.                                                    | Emit bounded `monotonicStartSeconds` and `monotonicEndSeconds` with elapsed consistency check.         | Yes                | Captured in planned runs              | End ≥ start and elapsed matches within fixed tolerance.                | Missing/non-monotonic/inconsistent values.                        | After fix       | No      |
| MET-05  | Record Studio memory-category observations before/after when available (Counts).                                                                                      | `PROVABLE_BY_STATIC_STUDIO_INSPECTION` | Not supplied; current harness has no field. Conditional, not a runtime blocker if unavailable.             | Record displayed Studio memory values in environment/run sheet, or explicit unavailable reason.        | Yes                | Alongside planned runs; 0 extra       | Numeric before/after with units, or explicit not available.            | Silent omission or invented reading.                              | No              | No      |
| PKG-01  | Preserve all fixed-schema measurement and acceptance-observation lines (`g2-studio-acceptance.md`, Acceptance evidence).                                              | `REQUIRES_PROVENANCE_FIX_AND_RERUN`    | Only summaries and selected bounded records are committed; no.                                             | Extract exact prefixed records from corrected-artifact Output into deterministic JSONL files.          | Yes                | Seven planned sessions                | One complete ordered record set per official run.                      | Missing/edited line, stale commit, or index gap.                  | Yes             | No      |
| PKG-02  | Preserve complete server Output (`g2-studio-acceptance.md`, Acceptance evidence).                                                                                     | `REQUIRES_PROVENANCE_FIX_AND_RERUN`    | Exact full G2e server outputs were not supplied; no.                                                       | Capture verbatim sanitized server Output for each final-artifact session and attach it to review.      | Yes                | Seven planned sessions                | Full Output, no unaccounted errors, artifact/run identity.             | Truncation, missing server, stale artifact, or unexplained error. | Yes             | No      |
| PKG-03  | Preserve complete client Output (`g2-studio-acceptance.md`, Acceptance evidence).                                                                                     | `REQUIRES_NEW_MANUAL_STUDIO_RUN`       | No client Output captures; no.                                                                             | Save both client outputs for two-player sessions and the active client output for one-player sessions. | Yes                | Seven planned sessions; 1–2           | Complete client Output files, no unaccounted errors.                   | Missing client capture or unexplained error.                      | Run after fix   | No      |
| PKG-04  | Complete two-player observation sheet and exact pass/fail checklist (`g2-studio-acceptance.md`, Acceptance evidence).                                                 | `REQUIRES_NEW_MANUAL_STUDIO_RUN`       | Current notes omit exact placement, finish, progress, Stage04 target, and several refusal/stale cases; no. | Use the finite checklist during the combined reference and zero sessions.                              | Yes                | Reference/zero; 2                     | Every applicable row PASS or explicitly N/A with reason.               | Blank, inferred, or FAIL row.                                     | Run after fix   | No      |
| POST-01 | Repeat Studio acceptance after final default cutover (`g2-studio-acceptance.md`, Acceptance evidence; compatibility Server-lifetime selection).                       | `DEFERRED_UNTIL_DEFAULT_CUTOVER`       | Cutover has not occurred; correctly incomplete.                                                            | Execute only after the separately reviewed default selector/cutover.                                   | Yes in this phase  | Future fresh servers; protocol counts | Full rerun against cutover artifact/default path.                      | Marked complete before cutover or default path not tested.        | Future artifact | Yes     |

## 3. Minimal remaining Studio plan

This plan assumes the acceptance-only harness and provenance changes in sections 4 and 5 have been
reviewed, committed, and used to build a new artifact. Static environment capture is required but is
not counted as a Studio server run. The exact remaining count is **seven fresh Studio server
sessions**.

Before Run 1, record the environment sheet and verify the new artifact SHA-256. The repaired
bootstrap must expose `G2eControl` without building a scene, emit a zero-root precondition receipt,
and let the first sequence choose the cold fixture. The command names below define the bounded
acceptance interface required by this plan; they are acceptance-harness APIs, not runtime APIs.

### Run 1 — combined reference, functional, static-fixture, and refusal evidence

- **Place:** new `build/G2eStudioAcceptance.rbxlx`.
- **Fresh server:** required; invalid if any build occurred before the cold reference sequence.
- **Players:** two.
- **Expected duration:** 20–30 minutes.
- **Initial Command Bar command:**

  ```lua
  local control = game:GetService("ServerStorage").G2eControl
  control.RunReferenceColdAndReplacementSequence:Invoke()
  control.VerifyStaleHazardCallback:Invoke()
  control.ObservePlayerPlacement:Invoke("initial")
  ```

- **Manual actions:**
  1. Wait for both players to be placed and for the initial placement receipt to be `PASS`.
  2. Player A activates `Checkpoint001`.
  3. Player A touches `Stage04Hazard001`, dies once, and respawns at the checkpoint.
  4. Player B activates no checkpoint, touches `Stage04Hazard001`, dies independently, and respawns
     at Spawn.
  5. Run the post-respawn commands below.
  6. Player A touches `Finish` repeatedly. Player B must remain unfinished.
  7. Capture the first finish receipt, then let Player B touch `Finish` and capture the second.

- **Post-respawn and finish commands:**

  ```lua
  control.ObservePlayerPlacement:Invoke("respawn")
  control.InspectHazard:Invoke("Stage04Hazard001")
  control.ObserveGameplay:Invoke()
  control.ObserveFinishIsolation:Invoke("player-a-only")
  control.ObserveFinishIsolation:Invoke("both-finished")
  control.RunProgressAndStaleCallbackSequence:Invoke()
  control.RunOwnershipRefusalSequence:Invoke()
  control.RunStaticFixtureSequence:Invoke()
  ```

- **Output to capture:** complete server and both client outputs; cold/repeated/replacement
  measurements and observations; initial/respawn placement receipts; Stage04 trace; gameplay
  observation; two finish receipts; progress/stale callback receipt; ownership receipt; wedge and
  decorative static receipts; final sequence PASS lines.
- **PASS criteria:** every bounded receipt is `PASS`; official reference indices are cold `1`,
  repeated `1..5`, replacement `1,2`; exact placements match; both Stage04 deaths and respawns are
  correct; finish is idempotent/isolated; same-hash progress survives new Instances; different-hash
  progress clears; old CharacterAdded/checkpoint/kill/finish actions are rejected; all three
  ownership refusals preserve the scene; wedge/decorative/helper/Part inspections pass.
- **Failure condition:** any missing receipt, unexpected Output error, wrong hazard, placement or
  progress mismatch, cyclic-return error, scene mutation on refusal, or property/static failure.
- **Combination rule:** static fixtures and ownership cases may share this server only if the
  harness runs them after gameplay/progress capture and proves cleanup. Combining this session with
  a failure-boundary run invalidates the boundary evidence.

### Run 2 — true cold `maximum-50` plus five repeats

- **Place:** the same new G2e artifact.
- **Fresh server:** required; invalid if reference or any other fixture was built first.
- **Players:** one; no gameplay action required.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunMaximumColdAndRepeatedSequence:Invoke()
  ```

- **Output:** zero-root precondition, one maximum cold record at index `1`, repeated records `1..5`,
  paired observations, connection/count/memory fields, and final maximum PASS receipt.
- **PASS criteria:** `maximum-50` is the first runtime build in the server; all six builds PASS;
  errors, warnings, and orphans are zero; no cyclic return.
- **Failure condition:** any earlier build, false cold label, missing index, nonzero error/warning/
  orphan, or property/count failure.
- **Expected duration:** 8–12 minutes.
- **Combination rule:** cannot be combined with any other run because the cold requirement would be
  lost.

### Run 3 — two-player `minimum-zero-checkpoint`

- **Place:** the same new G2e artifact.
- **Fresh server:** required for coherent final-artifact evidence; the protocol does not require a
  separate zero-checkpoint performance cold threshold.
- **Players:** two.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunZeroCheckpointColdSequence:Invoke()
  ```

- **Manual actions:** both players independently touch `Stage03Hazard001`, die, and respawn at
  Spawn without acquiring checkpoint state.
- **Final command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.ObserveZeroCheckpointPlayers:Invoke()
  ```

- **Output:** zero fixture measurement/observation, bounded two-player Spawn receipt, full server
  and two client outputs.
- **PASS criteria:** both players independently respawn at exact Spawn placement; checkpoint count
  and player checkpoint attributes remain zero/nil; no error/warning/orphan.
- **Failure condition:** shared state, checkpoint state, wrong respawn, missing player, or Output
  error.
- **Expected duration:** 6–10 minutes.
- **Combination rule:** do not combine with failure-boundary sessions; no reference gameplay is
  needed.

### Runs 4–7 — one failure boundary per fresh server

Use one fresh one-player server for each boundary in this exact order in the evidence index:

1. `before-commit`
2. `after-retire`
3. `after-publish`
4. `before-pointer`

For each server run:

```lua
game:GetService("ServerStorage").G2eControl.RunFailureBoundarySequence:Invoke("<boundary>")
```

- **Place:** the same new G2e artifact.
- **Fresh server:** mandatory for each boundary; combining any two invalidates both records.
- **Players:** one.
- **Output:** zero-root precondition, cold reference setup record, boundary receipt, complete server
  and client Output.
- **PASS criteria:** `before-commit` returns `builder-injected-failure`; the other boundaries return
  `commit-injected-failure`; previous session/root identity remains active and exactly one root is
  present.
- **Failure condition:** wrong code, changed/destroyed previous scene, ambiguous root, leaked
  candidate, or unrelated Output error.
- **Expected duration:** 3–5 minutes each.

No new Phase 0 run belongs in this minimal pre-cutover plan. The 2026-07-31 regression execution is
already recorded. The post-default-cutover rerun is also excluded because the cutover has not
occurred.

## 4. Harness gaps identified by the audit

Only gaps that cannot be closed reliably with the current harness are listed here. All proposed
changes remain under acceptance/build tooling; runtime gameplay modules in `roblox/src` remain
untouched.

Implementation update: all six rows were completed by
`70e2c1ec3d3ed8cdcdd7f51e118beb1494f5b50c`. The table is retained to preserve the reviewed scope
and rerun mapping.

| Gap                                                           | Current limitation                                                                                                                                                          | Smallest bounded change                                                                                                                                                                                              | Likely files                                                                               | Tests                                                                                                                       | Rebuild? | Studio evidence repeated                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| H-01 Cold fixture selection and pre-build proof               | Bootstrap immediately builds reference, so maximum “cold” is false and no zero-root record exists.                                                                          | Bind controls first; assert zero active roots; let one sequence choose the first fixture; forbid a second cold start.                                                                                                | `roblox/g2e/G2eAcceptanceBootstrap.server.luau`, `G2eAcceptanceHarness.luau`, protocol doc | Bootstrap state-machine tests; cold selection and duplicate-cold rejection.                                                 | Yes      | Reference, maximum, zero, all boundaries.                                                      |
| H-02 Acyclic control receipts                                 | Generic `Build` returns the cyclic runtime result, causing `tables cannot be cyclic` at the Command Bar interface.                                                          | Never return runtime/session/root tables from Bindables. Print and return frozen bounded scalar receipts with schema, fixture, run kind/index, status, and diagnostic fields.                                        | Bootstrap, harness, `G2eObservationV03.luau` or a new acceptance receipt module            | Validate every receipt shape; prove no Instance/function/cycle and deterministic field set.                                 | Yes      | Any generic/static/progress/refusal sequence; official sequences recaptured with new artifact. |
| H-03 Complete measurement schema                              | Root count, connection breakdown, monotonic start/end, and Studio memory status are absent; counts are split across two schemas.                                            | Add a versioned measurement/observation receipt with active-root count; checkpoint/kill/finish/CharacterAdded/PlayerRemoving/total connections; monotonic start/end/elapsed; memory numeric or explicit unavailable. | Harness, observation module, tests, protocol logging example                               | Required-field, ordering, numeric-bound, unavailable-memory, and reconciliation tests.                                      | Yes      | All seven final sessions.                                                                      |
| H-04 Bounded static fixture sequence                          | Exact assertions exist, but wedge/decorative are not run and generic Build ends ambiguously.                                                                                | Add `RunStaticFixtureSequence` that builds wedge and decorative after gameplay, uses existing `assertScene`, checks decorative safe-route exclusion, restores/cleans state, and emits one receipt per fixture.       | Bootstrap, harness, G2e project if extra fixture config is needed                          | Wedge count/class, decorative authority/safe-route, cleanup, receipt tests.                                                 | Yes      | Combined reference session only.                                                               |
| H-05 Placement, finish, progress, and stale-callback receipts | Exact placement, finish isolation/idempotence, same/different-hash progress, and old CharacterAdded/checkpoint/finish actions have reusable Luau tests but no Studio hooks. | Add bounded observers plus one ordered acceptance-only progress/stale sequence using existing Builder/session APIs; do not alter runtime behavior.                                                                   | Bootstrap, harness, optional new `G2eFunctionalObservationV03.luau`, harness tests         | Port expected receipt cases from `G2RuntimeSessionTests` and `G2BuilderTests`; include two-player and stale no-op failures. | Yes      | Combined reference session only.                                                               |
| H-06 V03 ownership refusal receipts                           | Unowned, ambiguous, and other-version refusals exist only in Luau/Phase 0 coverage.                                                                                         | Add an isolated acceptance-only refusal sequence that creates bounded adversarial roots, invokes V03 build, proves no mutation, cleans fixtures, and emits typed receipts.                                           | Bootstrap, harness, tests                                                                  | One test per ownership case plus cleanup/idempotence.                                                                       | Yes      | Combined reference session only.                                                               |

`ObserveGameplay` lacking a zero-checkpoint hazard configuration is not a formal blocker because the
protocol accepts a two-player human observation sheet for that fixture. `ObserveZeroCheckpointPlayers`
in the plan is a bounded convenience receipt; if omitted, exact human observations plus complete
Output remain sufficient.

## 5. Provenance repair plan

Implementation update: this plan was implemented by
`2046121c5e5505397601ac7c6630a9fea9f0831b`. The explicit `G2E_REPOSITORY_COMMIT` override has
precedence over Git; Git is the fallback source, not a historical fallback value. Both sources are
strict lowercase 40-hex, and missing or malformed identity fails closed. The rebuilt artifact uses
the reviewed harness commit as its source/release identity.

### Exact source and meaning

- **Source:** `roblox/g2e/G2eAcceptanceBootstrap.server.luau`, local `environment` table,
  `repositoryCommit` field.
- **Value:** `9a92540aad3183342096501f268eb1f966d640bf`.
- **Origin:** introduced when the isolated G2e harness was created; it equals the branch's original
  `main` base.
- **Propagation:** `G2eAcceptanceHarness.emitMeasurement` copies
  `environment.repositoryCommit` into every `[G2 runtime measurement]` payload.
- **Classification:** hardcoded source, not generated data and not fixture metadata. Fixture
  identities are separate `expectedHash` values and manifest hashes.

The audited historical artifact could never produce correct commit-bound measurement evidence while
this literal remained hardcoded. An external document could associate its SHA with implementation commit
`1379849686525d88c71245626e0360a00f1d48a9`, but that does not satisfy the machine record's own
repository-commit field.

### Deterministic injection method

1. Add an acceptance-build preparation script, for example
   `tools/prepare-g2e-build-provenance.ts`.
2. Build only from a clean committed checkout. Resolve the exact artifact-source commit with
   `git rev-parse HEAD^{commit}` and validate lowercase 40-hex form.
3. Keep `implementationCommit` separately as
   `1379849686525d88c71245626e0360a00f1d48a9` while runtime inputs remain unchanged. The emitted
   `repositoryCommit` must identify the new commit containing the reviewed harness/provenance
   changes that actually produced the artifact.
4. Write a deterministic ignored build-input module such as
   `build/g2e-provenance/G2eBuildProvenance.luau` with fixed key ordering, UTF-8/LF bytes, the two
   commit identities, and no timestamp or local path. Map it through `g2e-smoke.project.json` and
   require it from the bootstrap.
5. Make `npm run roblox:g2e:build` generate that module before `rojo build`. A second same-commit
   build must produce identical provenance bytes and artifact SHA.
6. When Git metadata is unavailable, require an explicitly supplied trusted
   `G2E_REPOSITORY_COMMIT` and validate it. Fail closed if neither Git nor the explicit value exists;
   never emit `unknown`, zero hash, or the historical literal.
7. Add TypeScript tests for clean checkout resolution, explicit-value parity, malformed/missing
   identity failure, deterministic bytes, and no local path/timestamp leakage.

The artifact SHA-256 will change because the embedded provenance bytes change. All G2e measurement,
acceptance-observation, hazard-trace, gameplay-observation, and server/client Output evidence from
the old `B6D3…3401` artifact remains historical but cannot close the new artifact's formal gate.
Phase 0 evidence is unaffected because it uses a different project/artifact.

The minimum coherent rerun is the seven-session plan in section 3. It recaptures all required G2e
machine records and manual observations under one corrected artifact identity. Historical evidence
must remain preserved and explicitly marked superseded for formal commit binding, not deleted or
rewritten.

## 6. Evidence packaging plan

Use one deterministic directory for the corrected artifact run, for example:

```text
docs/generator/evidence/g2e/2026-07-31-r2/
```

Do not commit `.rbxlx` artifacts; the repository ignores them. Record their cryptographic identity.
Capture Studio Output in a clean session so files contain no credentials, cookies, private keys, or
absolute local filesystem paths.

| File                                                                                                                                           | Contents                                                                                                                                                                 | Production method                                                             | Commitment policy                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `environment.json`                                                                                                                             | Date, tester evidence ID, Studio version/channel, OS, CPU/logical processors, RAM, play mode/player counts, graphics mode/API/quality, conditional Studio memory fields. | Manually authored from displayed values; reviewed against screenshots/Output. | Commit.                                                                                              |
| `artifact-identity.json`                                                                                                                       | Artifact filename, SHA-256, artifact-source `repositoryCommit`, runtime `implementationCommit`, Rojo project, fixture hashes, provenance schema.                         | Generated deterministically by the build/evidence script.                     | Commit.                                                                                              |
| `measurements.jsonl`                                                                                                                           | Exact JSON payloads from every `[G2 runtime measurement]` line in server-run order.                                                                                      | Deterministic extractor copies payload bytes; no semantic rewriting.          | Commit.                                                                                              |
| `acceptance-observations.jsonl`                                                                                                                | Exact `[G2 acceptance observation]` payloads.                                                                                                                            | Deterministic extractor.                                                      | Commit.                                                                                              |
| `hazard-traces.jsonl`                                                                                                                          | Exact Stage04 trace and any bounded stale/fixture trace records.                                                                                                         | Deterministic extractor.                                                      | Commit.                                                                                              |
| `gameplay-observations.jsonl`                                                                                                                  | Exact reference and optional zero-checkpoint bounded gameplay receipts.                                                                                                  | Deterministic extractor.                                                      | Commit.                                                                                              |
| `human-pass-fail.md`                                                                                                                           | Exact two-player actions, static environment checks, visual observation, fixture/run IDs, PASS/FAIL per matrix row, and harness limitations.                             | Manually authored; clearly labels human observations.                         | Commit.                                                                                              |
| `server-reference.txt`, `server-maximum-50.txt`, `server-minimum-zero-checkpoint.txt`                                                          | Complete verbatim server Output for Runs 1–3.                                                                                                                            | Export/copy from Studio without edits.                                        | Commit when bounded and safe; otherwise attach to review and commit its hash in `output-index.json`. |
| `server-failure-before-commit.txt`, `server-failure-after-retire.txt`, `server-failure-after-publish.txt`, `server-failure-before-pointer.txt` | Complete verbatim server Output for Runs 4–7.                                                                                                                            | Export/copy from Studio without edits.                                        | Same policy as above.                                                                                |
| `client-<run>-player-<n>.txt`                                                                                                                  | Complete client Output for each active client.                                                                                                                           | Export/copy from Studio without edits.                                        | Same policy as server Output.                                                                        |
| `output-index.json`                                                                                                                            | Deterministic list of every server/client Output filename, SHA-256, run ID, player role, and whether committed or attached.                                              | Generated from captured files.                                                | Commit.                                                                                              |
| `provenance-statement.md`                                                                                                                      | Explains the historical `9a92540…` records, corrected artifact source commit, implementation commit, supersession boundary, and preserved historical evidence.           | Manually authored from Git/build facts.                                       | Commit.                                                                                              |

Complete raw Output need not be duplicated both in Git and the review system. It must exist in one
complete immutable location and be referenced by SHA-256 from the committed `output-index.json`.
Bounded extracted records plus a human sheet alone are insufficient if the full server/client Output
is neither committed nor attached.

The documentation commit is the Git commit containing the evidence package; a file cannot safely
self-reference its own commit hash. Report that exact commit in the pull request and final handoff.
If a machine-readable documentation SHA is mandatory, use a second metadata commit that identifies
the first evidence-content commit rather than repeatedly changing a self-referential file.

## 7. Closure recommendation

**`READY_FOR_FINAL_EVIDENCE_COLLECTION`**

The exercised runtime paths appear accepted and no remaining repository evidence proves a runtime
defect. Deterministic provenance, true cold selection, bounded returns, measurement v2, exact Part
inspection, placement/finish/progress/stale observations, and ownership refusals are now implemented
in the acceptance artifact. Gameplay runtime code remains unchanged.

The only pre-cutover closure work is operator evidence: record the environment, execute the seven
fresh sessions in `g2e-final-studio-rerun.md`, preserve complete server/client Output, package the
bounded records and human sheet, and review them. Until that evidence exists, pre-cutover G2e must
remain incomplete and the future post-default-cutover rerun remains deferred.
