# G2e final pre-cutover Studio rerun sheet

Status: `READY_FOR_FINAL_EVIDENCE_COLLECTION`

This sheet contains exactly seven required fresh-server sessions. It does not record their
execution. Historical 2026-07-31 runs remain preserved, but their stale machine provenance cannot
close commit-bound acceptance for this artifact.

## Fixed artifact identity

| Field                         | Required value                                                     |
| ----------------------------- | ------------------------------------------------------------------ |
| Artifact path                 | `D:\ai-roblox-obby-builder\build\G2eStudioAcceptance.rbxlx`        |
| Artifact SHA-256              | `37C53E0FA4E9B2B3FD7444CCFDB5AD12025028B8ED6CEAC7E4C077C87EFC275F` |
| Embedded `repositoryCommit`   | `70e2c1ec3d3ed8cdcdd7f51e118beb1494f5b50c`                         |
| Runtime implementation commit | `1379849686525d88c71245626e0360a00f1d48a9`                         |
| Provenance implementation     | `2046121c5e5505397601ac7c6630a9fea9f0831b`                         |
| Harness implementation        | `70e2c1ec3d3ed8cdcdd7f51e118beb1494f5b50c`                         |
| Measurement schema            | `g2-studio-measurement-v2`                                         |
| Control-result schema         | `g2e-control-result-v1`                                            |

Before Session 1, record the environment fields required by `g2-studio-acceptance.md` and verify
the artifact hash with `Get-FileHash`. This environment capture is not an eighth Studio session.
Every invocation must return a bounded control result with `status="PASS"`; an invocation error,
missing result, or `status="FAIL"` fails the session.

## Bounded Output schemas

Capture every complete line with these prefixes:

| Prefix                              | Schema and fixed identity                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `[G2 precondition] `                | `g2e-precondition-v1`; commit, status, active/expected root counts, failure field                                            |
| `[G2 runtime measurement] `         | `g2-studio-measurement-v2`; commit, fixture/hash, run kind/index, timing, counts, connections, heap, warnings/errors/orphans |
| `[G2 acceptance observation] `      | `g2-acceptance-observation-v1`; fixture/hash, bounded counts/evidence/status                                                 |
| `[G2 control result] `              | `g2e-control-result-v1`; status, command, fixture/run identity, count, typed diagnostic                                      |
| `[G2 hazard trace] `                | `g2-hazard-trace-v1`; Stage04 manifest/plan/Part/callback/respawn trace                                                      |
| `[G2 gameplay observation] `        | bounded gameplay status and ordered observation array                                                                        |
| `[G2 placement observation] `       | `g2e-placement-observation-v1`; phase, tolerance, sorted player slots, expected/observed CFrames                             |
| `[G2 finish observation] `          | `g2e-finish-observation-v1`; phase and isolated two-player finish state                                                      |
| `[G2 progress observation] `        | `g2e-progress-stale-observation-v1`; preservation/reset and four stale no-op fields                                          |
| `[G2 ownership observation] `       | `g2e-ownership-refusal-v1`; sorted refusal cases and transaction preservation                                                |
| `[G2 part inspection] `             | `g2e-part-inspection-v1`; deterministic Parts/helper properties and safe-route isolation                                     |
| `[G2 zero-checkpoint observation] ` | `g2e-zero-checkpoint-observation-v1`; two-player state/attribute/respawn fields                                              |

Complete server Output and every active client Output must be preserved verbatim. Extracted JSON
records do not replace complete Output.

## Session 1 — `G2E-FINAL-01-REFERENCE`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Required. Any prior build invalidates the session.
- **Players:** Two.
- **Artifact:** Fixed artifact above.
- **Server evidence file:** `g2e-final-run-01-reference-server.txt`.
- **Client evidence files:** `g2e-final-run-01-reference-client-1.txt` and
  `g2e-final-run-01-reference-client-2.txt`.
- **Expected duration:** 20–30 minutes.
- **Initial commands:**

  ```lua
  local control = game:GetService("ServerStorage").G2eControl
  control.RunReferenceColdAndReplacementSequence:Invoke()
  control.VerifyStaleHazardCallback:Invoke()
  control.ObservePlayerPlacement:Invoke("initial")
  ```

- **Manual actions:**
  1. Confirm the precondition has zero active roots and the reference sequence records cold `1`,
     repeated `1..5`, and replacement `1,2`.
  2. Player A activates `Checkpoint001`.
  3. Player A touches `Stage04Hazard001`, dies once, and respawns at the checkpoint.
  4. Player B activates no checkpoint, touches the same `Stage04Hazard001`, dies independently, and
     respawns at Spawn.
- **Post-respawn commands:**

  ```lua
  control.ObservePlayerPlacement:Invoke("respawn")
  control.InspectHazard:Invoke("Stage04Hazard001")
  control.ObserveGameplay:Invoke()
  ```

- **Finish actions and commands:** Player A touches `Finish` repeatedly; Player B remains unfinished.

  ```lua
  control.ObserveFinishIsolation:Invoke("player-a-only")
  ```

  Then Player B touches `Finish` once.

  ```lua
  control.ObserveFinishIsolation:Invoke("both-finished")
  control.RunProgressAndStaleCallbackSequence:Invoke()
  control.RunOwnershipRefusalSequence:Invoke()
  control.RunStaticFixtureSequence:Invoke()
  ```

- **Required machine Output:** all prefixes listed above except zero-checkpoint; final lines for the
  reference, progress/stale, ownership, and static sequences.
- **PASS:** every receipt is `PASS`; exact Stage04 death/respawn behavior is independent; placement
  CFrames match within `0.00001`; finish state is isolated/idempotent; same-hash progress survives;
  different-hash progress clears; stale CharacterAdded/checkpoint/kill/finish actions are no-ops;
  all refusal cases preserve the scene; wedge is a `WedgePart`; decoration and helper are isolated.
- **FAIL:** any missing line, non-PASS receipt, wrong index/hazard/placement, cyclic-return error,
  scene mutation, incomplete cleanup, or unexplained server/client error.
- **Combination rule:** The bounded functional/static/refusal commands above belong to this session.
  Combining it with a failure-boundary session invalidates the boundary evidence.

## Session 2 — `G2E-FINAL-02-MAXIMUM-50`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Required; no reference or manual build may run first.
- **Players:** One.
- **Server evidence file:** `g2e-final-run-02-maximum-50-server.txt`.
- **Client evidence file:** `g2e-final-run-02-maximum-50-client-1.txt`.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunMaximumColdAndRepeatedSequence:Invoke()
  ```

- **Required Output:** precondition; maximum cold index `1`; repeated indices `1..5`; paired
  measurement/acceptance records; control result; final maximum PASS line.
- **PASS:** `maximum-50` is the first build; six builds succeed; active root count is one after each;
  warnings, errors, and orphans are zero; connection totals reconcile; no cyclic return.
- **FAIL:** any earlier build, false cold label, missing/duplicate index, nonzero diagnostic count,
  property/count mismatch, or unexplained Output error.
- **Expected duration:** 8–12 minutes.
- **Combination rule:** Cannot be combined with another session.

## Session 3 — `G2E-FINAL-03-ZERO-CHECKPOINT`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Required.
- **Players:** Two.
- **Server evidence file:** `g2e-final-run-03-zero-checkpoint-server.txt`.
- **Client evidence files:** `g2e-final-run-03-zero-checkpoint-client-1.txt` and
  `g2e-final-run-03-zero-checkpoint-client-2.txt`.
- **Initial command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunZeroCheckpointColdSequence:Invoke()
  ```

- **Manual actions:** Both players independently touch `Stage03Hazard001`, die, and respawn at Spawn
  without acquiring checkpoint state.
- **Final command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.ObserveZeroCheckpointPlayers:Invoke()
  ```

- **Required Output:** precondition; zero-checkpoint measurement/acceptance; control results;
  zero-checkpoint and placement observations; complete server and both client outputs.
- **PASS:** two players; at least two respawns and two Spawn respawns; internal checkpoint state and
  visible checkpoint attributes remain clear; both CFrames equal exact Spawn placement.
- **FAIL:** shared or nonzero checkpoint state, wrong placement, missing player/respawn, failed
  receipt, or unexplained Output error.
- **Expected duration:** 6–10 minutes.
- **Combination rule:** Do not combine with another session.

## Session 4 — `G2E-FINAL-04-BEFORE-COMMIT`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Mandatory.
- **Players:** One.
- **Evidence:** `g2e-final-run-04-before-commit-server.txt` and
  `g2e-final-run-04-before-commit-client-1.txt`.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunFailureBoundarySequence:Invoke("before-commit")
  ```

- **PASS:** zero-root precondition; cold reference index `1`; failure code
  `builder-injected-failure`; previous root/session remains active; exactly one root; PASS control.
- **FAIL:** any other code, mutation/destruction, leaked/ambiguous root, or unrelated Output error.
- **Expected duration:** 3–5 minutes.
- **Combination rule:** Combining with any other boundary invalidates this session.

## Session 5 — `G2E-FINAL-05-AFTER-RETIRE`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Mandatory.
- **Players:** One.
- **Evidence:** `g2e-final-run-05-after-retire-server.txt` and
  `g2e-final-run-05-after-retire-client-1.txt`.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunFailureBoundarySequence:Invoke("after-retire")
  ```

- **PASS:** zero-root precondition; cold reference index `1`; failure code
  `commit-injected-failure`; previous root/session remains active; exactly one root; PASS control.
- **FAIL:** wrong code, mutation/destruction, leaked/ambiguous root, or unrelated Output error.
- **Expected duration:** 3–5 minutes.
- **Combination rule:** Combining with any other boundary invalidates this session.

## Session 6 — `G2E-FINAL-06-AFTER-PUBLISH`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Mandatory.
- **Players:** One.
- **Evidence:** `g2e-final-run-06-after-publish-server.txt` and
  `g2e-final-run-06-after-publish-client-1.txt`.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunFailureBoundarySequence:Invoke("after-publish")
  ```

- **PASS:** zero-root precondition; cold reference index `1`; failure code
  `commit-injected-failure`; previous root/session remains active; exactly one root; PASS control.
- **FAIL:** wrong code, mutation/destruction, leaked/ambiguous root, or unrelated Output error.
- **Expected duration:** 3–5 minutes.
- **Combination rule:** Combining with any other boundary invalidates this session.

## Session 7 — `G2E-FINAL-07-BEFORE-POINTER`

- [ ] Completed and evidence reviewed.
- **Fresh server:** Mandatory.
- **Players:** One.
- **Evidence:** `g2e-final-run-07-before-pointer-server.txt` and
  `g2e-final-run-07-before-pointer-client-1.txt`.
- **Command:**

  ```lua
  game:GetService("ServerStorage").G2eControl.RunFailureBoundarySequence:Invoke("before-pointer")
  ```

- **PASS:** zero-root precondition; cold reference index `1`; failure code
  `commit-injected-failure`; previous root/session remains active; exactly one root; PASS control.
- **FAIL:** wrong code, mutation/destruction, leaked/ambiguous root, or unrelated Output error.
- **Expected duration:** 3–5 minutes.
- **Combination rule:** Combining with any other boundary invalidates this session.

After all seven checkboxes are complete, package the environment record, exact bounded JSONL,
verbatim outputs, observation sheet, output hash index, artifact identity, and provenance statement.
Do not mark pre-cutover G2e `PASS` until that package is reviewed. The separate future
post-default-cutover rerun remains incomplete.
