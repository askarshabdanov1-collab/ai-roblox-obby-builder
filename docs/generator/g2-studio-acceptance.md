# G2 manual Roblox Studio measurement and acceptance

This is the required engine-dependent G2 acceptance protocol. It supplements Luau tests; it is not
Studio automation and must not be reported as passed until a human has performed and recorded every
applicable observation. The accepted pre-cutover package under `docs/generator/evidence` records the
reference, `maximum-50`, zero-checkpoint, failure-boundary, and Phase 0 executions against the
isolated harness. The distinct seven-session rerun through the official default-runtime acceptance
mode is recorded in [the final rerun sheet](./g2e-final-studio-rerun.md). Post-default-cutover G2e
Studio acceptance: PASS. This is a technical acceptance result, not a claim of external stakeholder
approval.

## Measurement environment

The execution record must include:

- date and tester;
- exact Roblox Studio version and release channel;
- Windows edition, version, and OS build;
- CPU model and logical processor count;
- installed memory;
- Studio Play mode and player count;
- graphics mode/API and quality level where displayed;
- reference fixture ID and `manifestHash`;
- `maximum-50` fixture ID and `manifestHash`; and
- repository commit and Rojo build artifact identity.

Do not substitute an undocumented Studio or fixture version. Engine changes can invalidate prior
observations.

## Build protocol

Run `npm ci`, `npm run g2:fixtures:check`, and `npm run validate` before either build below.

### Production default-place diagnostic

`npm run roblox:build` builds `roblox/default.project.json` as `build/AIObbyBuilder.rbxlx` with
`RuntimeConfiguration.Version = "0.3"` and `ExecutionMode = "production"`. Opening that place is a
production diagnostic only: `ObbyBootstrap` automatically builds the accepted reference scene and
the project does not map or activate the G2e acceptance harness. A successful diagnostic cannot be
reported as post-cutover Studio acceptance.

### Post-default-cutover acceptance build

Run `npm run roblox:default-acceptance:build` and open
`build/AIObbyBuilderDefaultStudioAcceptance.rbxlx`. The committed
`roblox/default-studio-acceptance.project.json` retains the production default project's
`ObbyBootstrap`, complete `ObbyRuntime` mapping, `GeneratedManifests` mapping, SceneManifest `0.3`
selection, accepted reference module, and accepted manifest hash. Its only runtime selection change
is `ExecutionMode = "studio-acceptance"`; it also maps the bounded G2e harness and additional
session fixtures. The shared fail-closed selector prevents `ObbyBootstrap` from building
automatically, after which the harness exposes `G2eControl` and emits the zero-root precondition.

This is the official post-cutover artifact. Do not insert scripts manually and do not substitute
`roblox/g2e-smoke.project.json`. That isolated project remains only as the preserved pre-cutover
artifact path.

For the official artifact:

1. Confirm no scene exists when the controls-ready marker appears.
2. Run one cold reference build after opening the place.
3. Run five same-manifest reference rebuilds in the same server.
4. Replace reference with the distinct valid replacement fixture, then replace back.
5. Start a fresh server and run one cold `maximum-50` build plus five repeated same-manifest
   rebuilds.
6. Perform the two-player behavior procedure for the reference and zero-checkpoint fixtures.
7. Run every test-only failure injection in a separate fresh server and confirm the previous scene
   result specified by the transaction matrix.
8. Rerun the existing Phase 0 Studio smoke unchanged as the `0.2` regression oracle.

Cold means the first runtime build after opening a fresh Studio server session. Repeated means the
same valid manifest is rebuilt with a new runtime generation token without restarting that server.
The bootstrap must expose `G2eControl` while `[G2 precondition]` reports zero active roots; it must
not build reference automatically.

Both G2e build commands embed deterministic source provenance before Rojo runs. An explicitly
supplied `G2E_REPOSITORY_COMMIT` takes precedence over Git and represents the reviewed release/source
commit. Without the override, the build uses `git rev-parse HEAD^{commit}`. Both paths require
exactly 40 lowercase hexadecimal characters and fail closed when missing or malformed. Studio does
not query Git or the network. See
[the implementation record](./g2e-provenance-harness-implementation.md).

## Functional observations

Record pass/fail and Output errors for:

- exact gameplay/decorative Part counts, native classes, names, transforms, size, material, color,
  collision, touch, and query properties;
- Wedge construction as `WedgePart` and no fallback Block;
- exactly one invisible non-authoritative `_RuntimeSpawnLocation` owned by the scene;
- exact initial HumanoidRootPart center, vertical offset, and route-facing direction;
- exact checkpoint respawn center, offset, and next-route facing;
- zero-checkpoint spawn/death behavior;
- hazards affecting only a current matching player character;
- idempotent finish state;
- two-player checkpoint, respawn, debounce, and finish isolation;
- same-manifest progress preservation using new Instances;
- new-manifest progress reset;
- successful replacement exposing one complete `GeneratedObby` root;
- every injected failure preserving the transaction-specified scene;
- queued old CharacterAdded/checkpoint/kill/finish callbacks becoming no-ops;
- unowned, ambiguous, and other-version root refusal; and
- decorative objects never entering the safe route or gameplay collision layer.

Touch and character observations are empirical evidence for this environment. They are not proof of
universal Roblox physics feasibility or scheduling.

### Focused reference hazard check

The concrete visible reference hazard for G2e is `Stage04Hazard001` in source stage `stage-04`
(`layout-stage-04`), produced from `mechanic-intent-04` / mechanic `hazard-avoidance`. Its manifest
role is `kill`, its behavior is `kind: "kill"` plus `killMode: "touch"`, and its constructed Part
must remain anchored, non-colliding, touch-enabled, query-enabled, and in the default collision
group.

Run the following from the server Command Bar after the controls-ready message:

```lua
local control = game:GetService("ServerStorage").G2eControl
local result = control.RunReferenceColdAndReplacementSequence:Invoke()
assert(result.status == "PASS", result.diagnosticCode .. ":" .. result.diagnosticField)
```

After the sequence, confirm in both client windows that both avatars are visible and fully formed.
If either is absent or incomplete, preserve Output and invalidate the session. Once both are visible,
run this separate server Command Bar block exactly once:

```lua
local control = game:GetService("ServerStorage").G2eControl
local result = control.CheckPlayerCharacterReadiness:Invoke()
assert(result.status == "PASS", result.diagnosticCode .. ":" .. result.diagnosticField)
result = control.VerifyStaleHazardCallback:Invoke()
assert(result.status == "PASS", result.diagnosticCode .. ":" .. result.diagnosticField)
result = control.ObservePlayerPlacement:Invoke("initial")
assert(result.status == "PASS", result.diagnosticCode .. ":" .. result.diagnosticField)
result = control.InspectHazard:Invoke("Stage04Hazard001")
assert(result.status == "PASS", result.diagnosticCode .. ":" .. result.diagnosticField)
```

The readiness handshake immediately requires exactly two connected players and a real character
BasePart for each. The stale-hazard control then scans every player for at most 120 scheduler
resumes, sorts candidates by numeric `UserId`, and selects the first ready candidate in that stable
order. It emits counts/slots only, never UserIds or hierarchy data. Exhaustion returns typed FAIL
records distinguishing no Character, no BasePart, no ready player, invalid identity, and wrong
player count. A successful probe still resolves a real player-character touch and must increment the
retired session's stale rejection exactly once with zero lethal action or current-scene mutation.

The placement observer emits `g2e-placement-observation-v2`. It waits for the active session's
deferred placement callbacks and records each HumanoidRootPart CFrame immediately after the real
runtime placement call succeeds. Expected-vs-observed comparison retains the exact `0.00001`
tolerance. A later live CFrame is not valid exact-placement evidence because character activation,
physics settling, player input, and two-player separation can move it after assignment. Missing or
incorrect runtime assignment still fails closed.

The replacement sequence ends on a fresh reference scene. Player A must then touch
`Checkpoint001`, touch `Stage04Hazard001`, die once, and respawn at that checkpoint. Player B must
touch the same hazard without a checkpoint, die independently, and respawn at the initial Spawn.
Accessory and multiple body-Part contacts from one character must not create a second lethal
action. Local Studio test players may have negative integer `UserId` values; those are valid
server-owned test identities, while zero remains invalid.

Finally run:

```lua
game:GetService("ServerStorage").G2eControl.ObserveGameplay:Invoke()
```

`InspectHazard` and `ObserveGameplay` emit bounded `[G2 hazard trace]` and
`[G2 gameplay observation]` records. The trace includes manifest/build-plan metadata, Part name and
class, fixed attributes, sorted tags, touch/collision/query/anchored properties, collision group,
exact callback binding, touched Part name/class, character and Humanoid resolution, lethal action,
and spawn/checkpoint respawn counters. Missing evidence produces
`code=gameplay-evidence-incomplete` with the first missing observation ID as its field. A static
controls-ready line or hazard count cannot satisfy this check.

After completing the reference-fixture gameplay actions, invoke
`game:GetService("ServerStorage").G2eControl.ObserveGameplay:Invoke()` from the server Command Bar.
The bounded `[G2 gameplay observation]` record remains `FAIL` until it has observed a bound hazard,
a valid character touch, Humanoid resolution, a lethal action, an expected respawn, a preserved
checkpoint respawn, initial-spawn fallback, two-player independence, an explicitly rejected stale
hazard callback, and a completed replacement with zero stale callback actions. It also requires zero
unauthorized gameplay intersections and zero coplanar visible surfaces. This record does not verify
camera-dependent flicker: move the camera around every visible route and hazard surface and record
that human observation separately.

## Counts and memory observations

For each cold and repeated run record:

- manifest gameplay, decorative, stage, zone, route, and transition counts;
- constructed root/folder/BasePart/SpawnLocation counts;
- total runtime-owned Instances;
- checkpoint, kill, finish, CharacterAdded, PlayerRemoving, and total connection counts;
- build start/end readings from one monotonic timing source;
- elapsed milliseconds as an observation;
- Lua heap reading from the same documented API before and after, when available;
- Studio memory category observations before and after, when available; and
- warnings/errors plus cleanup or orphan counts.

G2a sets **no millisecond pass threshold**. G2e records raw cold and repeated measurements first.
Any performance threshold proposed afterward must identify the measured population, statistic,
environment, and rollback response and receive review before cutover.

## Logging format

Emit one JSON object per measurement to Studio Output, prefixed by `[G2 runtime measurement] `. The
v2 schema uses a status field plus numeric zero for an unavailable Lua heap reading, rather than
omitting fixed keys:

```json
{
  "schemaVersion": "g2-studio-measurement-v2",
  "repositoryCommit": "<40-hex>",
  "studioVersion": "<recorded>",
  "osBuild": "<recorded>",
  "fixtureId": "reference",
  "manifestHash": "sha256:<64-hex>",
  "runKind": "cold",
  "runIndex": 1,
  "monotonicStartSeconds": 0,
  "monotonicEndSeconds": 0,
  "elapsedMilliseconds": 0,
  "gameplayObjects": 0,
  "decorativeObjects": 0,
  "runtimeOwnedInstances": 0,
  "activeRootCount": 1,
  "checkpointConnections": 0,
  "killConnections": 0,
  "finishConnections": 0,
  "sessionConnections": 0,
  "characterAddedConnections": 0,
  "playerAddedConnections": 1,
  "playerRemovingConnections": 1,
  "coordinatorConnections": 2,
  "totalConnections": 2,
  "connections": 0,
  "luaHeapStatus": "available",
  "luaHeapKilobytesBefore": 0,
  "luaHeapKilobytesAfter": 0,
  "warnings": 0,
  "errors": 0,
  "orphans": 0
}
```

Measurement logging is local test instrumentation. It sends no network request and contains no
player name, UserId, credential, local path, or arbitrary manifest content.

Every Command Bar BindableFunction returns `g2e-control-result-v1` with fixed primitive keys. A
manual one-off `Build:Invoke("<fixture>")` is always labelled `manual`; callers cannot provide a
false cold/repeated label. Official run indices are cold `1`, repeated `1..5`, and replacement
`1,2`, and counters reset only with a fresh server.

## Acceptance evidence

Attach the environment record, all measurement lines, two-player observation sheet, server/client
Output, and exact pass/fail checklist to the relevant PR. Manual Studio execution is mandatory before
G2 runtime acceptance and must be repeated after the final default cutover. A procedure document or
successful Luau test is not a substitute for execution.

The accepted pre-cutover evidence identifies the implementation commit, fixture hashes, built
artifact and SHA-256, Studio/OS environment, complete bounded records, observations, Output, and
provenance. It remains historical evidence for the isolated project and is not evidence for the
default selector.

The reviewed post-cutover package records `PASS` against tested commit
`944a35af47e5cb234dcc4480c8a51ffa435e5fb4` and evidence commit `cc4cb64`. The artifact SHA-256 is
`2C1079BFE3B53BD3A02A8DB99838C59E42C1A878853224D77D9AEF8EEAB14FFF`. The evidence ZIP is
`docs/generator/evidence/g2e-post-cutover-final-package.zip`, with SHA-256
`525590EFFFA058E8045340989F169776AB1FC2B031E93096DB1BC9ED3ADB3E09`. The final integrity and
session review is recorded in [the final rerun sheet](./g2e-final-studio-rerun.md).
