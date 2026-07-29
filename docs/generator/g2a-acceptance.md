# Phase G2a acceptance and G2b handoff

G2a resolves runtime decisions only. It deliberately leaves SceneManifest 0.3 runtime construction,
loading, scene replacement, behavior wiring, bootstrap selection, and Studio runtime execution
unimplemented.

## Ten decisions

- [x] **Spawn semantics:** the manifest Part remains gameplay authority; one invisible,
      non-authoritative scene-owned SpawnLocation is selected as initial-spawn infrastructure, subject
      to manual Studio evidence.
- [x] **Wedge mapping:** `className: "Part"` is the logical native primitive family and `Wedge` maps
      to `WedgePart`; mismatch fails candidate construction without fallback geometry.
- [x] **Manifest trust:** repository-packaged ModuleScript plus configured expected-hash equality,
      immutable snapshot, and semantic validation; no claim of Luau canonical hash recomputation or
      arbitrary-input authentication.
- [x] **Runtime transport:**
      `examples/g1-workflow/reference/scene-manifest-v0.3.luau`, owned by
      `tools/g1-workflow-fixture-content.ts` and exact-byte checked by
      `npm run layout:workflow:fixtures:check`.
- [x] **Replacement transaction:** complete off-Workspace candidate, explicit no-yield commit
      window, current-pointer callback authority, injected failure matrix, and bounded cleanup; not an
      engine transaction.
- [x] **Cross-version behavior:** no live `0.2` ↔ `0.3` replacement; explicit server-lifetime
      selection and fresh-server rollback.
- [x] **Player state:** checkpoint and finish keys use `(UserId, manifestHash)`; same-hash rebuilds
      preserve ID-based state; new hashes clear state; stale callbacks are no-ops.
- [x] **Performance evidence:** documented Windows/Studio environment, representative and 50-stage
      cold/repeated measurement, counts, memory observations, and stable log shape; no invented time
      threshold.
- [x] **Fixture coverage:** exact existing owner plus specified generated fixtures for zero
      checkpoints, 50 stages, native shapes/decoration, replacement, injected failure, stale callbacks,
      and two players.
- [x] **Validator parity:** explicit TypeScript/Luau matrix; every incomplete rule is marked as a
      G2b blocker, with canonical hash recomputation as the one intentional trust-model exception.

## Required documents and owners

| Document                                        | Authority established                                            |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `docs/decisions/0003-g2-runtime-boundary.md`    | Runtime boundary, trust model, and all ten decisions             |
| `docs/generator/g2-scene-replacement.md`        | Activation order, ownership, failure injection, rollback         |
| `docs/generator/g2-compatibility-rollback.md`   | `0.2`/`0.3` coexistence and fresh-server rollback                |
| `docs/generator/g2-player-session-lifecycle.md` | Per-player state, rebuild, removal, and stale callback semantics |
| `docs/generator/g2-validator-parity.md`         | Structural and semantic parity requirements                      |
| `docs/generator/g2-fixtures-and-drift.md`       | Fixture identities, generators, scenarios, and exact-byte drift  |
| `docs/generator/g2-studio-acceptance.md`        | Manual functional and measurement evidence protocol              |
| This checklist                                  | G2a closure and G2b admission gate                               |

`tools/check-g2-runtime-decisions.ts` verifies document markers, existing runtime references,
absence of reserved G2b modules, active default `0.2` fixture selection, the fixture-owner command,
and exact G1d transport bytes. `npm run g2a:scope:check` proves the G2a branch diff contains only
documentation, package scripts, and that check.

## G2a validation checklist

- [ ] `npm ci`
- [ ] `npm run g2:decisions:check`
- [ ] `npm run g2a:scope:check`
- [ ] `npm run validate`
- [ ] `npm run roblox:format:check`
- [ ] `npm run roblox:lint`
- [ ] `npm run roblox:test`
- [ ] `npm run roblox:build`
- [ ] `git diff --check origin/main...HEAD`
- [ ] Ubuntu and Windows CI after the PR is opened
- [ ] PR review confirms no active runtime, bootstrap, generated contract, schema, or Rojo project
      changed

Command results belong in the PR report rather than being hard-coded as permanent facts in this
document.

## Studio-dependent evidence still pending

These are intentionally not claimed by G2a:

- that the non-authoritative SpawnLocation produces reliable initial character creation in the
  tested Studio version;
- actual HumanoidRootPart placement, `Touched`, respawn, and multiplayer behavior for `0.3`;
- event-scheduling observations around the no-yield replacement window;
- reference and maximum-50 object/connection counts, elapsed time, and memory observations; and
- any measured basis for a runtime performance threshold.

The decisions specify what G2 will test; they do not convert unexecuted Studio procedures into
evidence.

## G2b handoff gate

G2b may begin only after this G2a PR is reviewed and merged with all validation green. G2b is limited
to the immutable snapshot/work-admission loader and Luau validator parity unless a separately
approved phase plan says otherwise. Before any manifest can reach construction, G2b must:

1. preserve the exact configured-transport and expected-hash trust boundary;
2. close every matrix item labeled **G2b blocker**;
3. add shared positive/negative parity fixtures and N−1/N/N+1 limit tests;
4. generate and exact-byte drift-check the reference, zero-checkpoint, and maximum-50 transports;
5. reject metatables, mutation after admission, unknown properties, non-finite numbers, duplicate
   IDs, dangling references, invalid routes/transitions, and collision-authority violations;
6. remain pure with respect to Workspace, Players, Instance construction, and bootstrap behavior;
   and
7. keep the active `0.2` runtime path byte-unchanged.

If implementation reveals that `className: "Part"` cannot lawfully support the selected Wedge
interpretation, or any other proven G1 contract defect, work stops for contract review instead of
changing a contract within G2.

## Explicit phase boundary

SceneManifest 0.3 runtime construction remains unimplemented. No `ManifestLoaderV03`,
`BuildPlanV03`, `NativePartFactoryV03`, `SceneBuilderCoreV03`, or `RuntimeSessionV03` production
module exists in G2a. The default bootstrap continues to use the existing SceneManifest `0.2`
vertical slice. G2b, external assets, dynamic mechanics, networking, cloud services, analytics,
deployment, and Studio automation have not started.
