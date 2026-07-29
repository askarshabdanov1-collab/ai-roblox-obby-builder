# G2 manual Roblox Studio measurement and acceptance

This is the required engine-dependent G2 acceptance protocol. It supplements Luau tests; it is not
Studio automation and must not be reported as passed until a human has performed and recorded every
applicable observation. G2a defines the procedure but does not execute it because no `0.3` runtime
construction exists.

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

1. Run `npm ci`, the future G2 fixture drift check, `npm run validate`, and the future dedicated G2
   Rojo smoke build command.
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
