# G2 manual Roblox Studio measurement and acceptance

This is the required engine-dependent G2 acceptance protocol. It supplements Luau tests; it is not
Studio automation and must not be reported as passed until a human has performed and recorded every
applicable observation. The [2026-07-31 Studio evidence](./g2e-studio-evidence-2026-07-31.md)
records the focused reference hazard/gameplay/geometry subsection as `PASS`; full G2e remains
incomplete because the record does not cover every mandatory sequence and evidence field below.

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

1. Run `npm ci`, `npm run g2:fixtures:check`, `npm run validate`, and
   `npm run roblox:g2e:build`.
2. Open the produced G2 smoke place, not the active `0.2` default place.
3. Confirm no scene exists before the test bootstrap invokes the opt-in `0.3` builder.
4. Run one cold reference build after opening the place.
5. Run five same-manifest reference rebuilds in the same server.
6. Replace reference with the distinct valid replacement fixture, then replace back.
7. Start a fresh server and run one cold `maximum-50` build plus five repeated same-manifest
   rebuilds.
8. Perform the two-player behavior procedure for the reference and zero-checkpoint fixtures.
9. Run every test-only failure injection in a separate fresh server and confirm the previous scene
   result specified by the transaction matrix.
10. Rerun the existing Phase 0 Studio smoke unchanged as the `0.2` regression oracle.

Cold means the first runtime build after opening a fresh Studio server session. Repeated means the
same valid manifest is rebuilt with a new runtime generation token without restarting that server.

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

Run the following from the server Command Bar after the initial `Reference ready` message:

```lua
local control = game:GetService("ServerStorage").G2eControl
control.RunReferenceReplacementSequence:Invoke()
control.VerifyStaleHazardCallback:Invoke()
control.InspectHazard:Invoke("Stage04Hazard001")
```

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
`Reference ready` line or hazard count cannot satisfy this check.

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

Emit one JSON object per measurement to Studio Output, prefixed by `[G2 runtime measurement] `. Keys
are fixed and values unavailable from Studio are `null`, not omitted:

```json
{
  "schemaVersion": "g2-studio-measurement-v1",
  "repositoryCommit": "<40-hex>",
  "studioVersion": "<recorded>",
  "osBuild": "<recorded>",
  "fixtureId": "reference",
  "manifestHash": "sha256:<64-hex>",
  "runKind": "cold",
  "runIndex": 1,
  "elapsedMilliseconds": 0,
  "gameplayObjects": 0,
  "decorativeObjects": 0,
  "runtimeOwnedInstances": 0,
  "connections": 0,
  "luaHeapKilobytesBefore": null,
  "luaHeapKilobytesAfter": null,
  "warnings": 0,
  "errors": 0,
  "orphans": 0
}
```

Measurement logging is local test instrumentation. It sends no network request and contains no
player name, UserId, credential, local path, or arbitrary manifest content.

## Acceptance evidence

Attach the environment record, all measurement lines, two-player observation sheet, server/client
Output, and exact pass/fail checklist to the relevant PR. Manual Studio execution is mandatory before
G2 runtime acceptance and must be repeated after the final default cutover. A procedure document or
successful Luau test is not a substitute for execution.

The [2026-07-31 Studio evidence](./g2e-studio-evidence-2026-07-31.md) identifies the implementation
commit, fixture manifest hash, built artifact and its SHA-256, supplied Studio/OS environment, and
the bounded static, gameplay, geometry, and visual observations separately. It supports the focused
reference subsection only. Missing environment fields, raw cold/repeated measurements, the
`maximum-50` and zero-checkpoint sequences, all four fresh-server failure-boundary sequences, the
Phase 0 regression smoke, and the remaining functional and Output records keep full G2e incomplete.
