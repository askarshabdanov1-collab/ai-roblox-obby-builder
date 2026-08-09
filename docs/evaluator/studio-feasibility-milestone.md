# Studio feasibility milestone

**Status:** Repository guard model and a development-only loopback HTTP prototype are complete. No
Studio acceptance result is introduced here; the human-only transport/lifecycle matrix remains
pending.

This decision record implements the repository-owned portion of issue #23. It is a deterministic,
pure TypeScript model in `apps/orchestrator/src/studio-feasibility.ts`; it does not open a socket,
launch Roblox Studio, edit a place, execute Luau, invoke a shell, read/write files, or retain an
account credential.

## Pinned feasibility target

| Component              | Pinned target                             | Status                                                                                                                                              |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roblox Studio / engine | `0.732.0.7321040`                         | Human-only target derived from accepted G2e environment evidence; the recorded observation used `0.732.0.7321043`, so it cannot inherit this target |
| Windows                | Windows 10 Pro `10.0.19045` build `19045` | Human-only target; the recorded observation used `19045.6456`, so it cannot inherit this target                                                     |
| Protocol               | `studio-feasibility-protocol` `1.0.0`     | Implemented repository model                                                                                                                        |
| Plugin                 | `0.1.0-dev`                               | Development-only local plugin; no production distribution or call site                                                                              |
| Bridge                 | `0.1.0-dev`                               | Development-only Node HTTP bridge, bound only to `127.0.0.1:4318`                                                                                   |
| Orchestrator           | `@obby/orchestrator` `0.2.0`              | Hosts the pure guard model only                                                                                                                     |
| Multiplayer            | `unsupported-unproven`                    | Not enabled by negotiation or lifecycle state                                                                                                       |

The Studio/engine and Windows values are pinned test targets, not an assertion that this branch was
run in that environment. A new Studio or Windows build requires a new human probe record; it cannot
inherit a pass from this document.

## Decision

The selected feasibility candidate is development-only plugin-originated loopback HTTP polling. The
repository model admits it only after both peers negotiate a documented compatible capability
intersection, all integrity features are present, and the adapter ID is allowlisted. The prototype
does not select a production transport: a missing plugin permission, unavailable `HttpService`, or
any non-loopback peer is `manual-evidence-required` or rejected before a command is accepted. The
user-mediated signed bundle exchange remains the operational fallback.

The model fails closed for unknown protocol majors, malformed offers, unapproved adapters, missing
integrity features, unavailable required capabilities, unavailable/unknown transports, non-loopback
peers, unexpected origins, expired sessions/messages, wrong sessions, replayed sequences, disallowed
commands, oversized payloads, payload digest mismatches, invalid authentication tags, wrong
scene/generation bindings, stale/replayed evidence, and interrupted evidence.

Run the repository model tests with:

```text
npm run evaluator:studio-feasibility:test
```

## Capability matrix

| Candidate                                       | Repository model                                                              | Human-only feasibility question                                                                         | Rejection / no-go condition                                                                            | Current result             |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| Plugin-originated loopback HTTP polling         | Development-only local plugin and `127.0.0.1` bridge; no production call site | Can an explicitly approved plugin reach the local bridge within lease/cancel bounds?                    | Missing plugin permission, non-loopback peer, failed HMAC/version/binding, or cleanup uncertainty      | `human-probe-pending`      |
| Plugin-originated loopback WebSocket proxy      | Negotiated identifier only; no proxy/client is implemented                    | Does the pinned Studio/plugin environment expose an audited client path that authenticates every frame? | Unsupported API, LAN/broad network exposure, missing frame authentication, or unavailable cancellation | `UNSUPPORTED`              |
| File-based user-mediated signed bundle exchange | Documented manual fallback; no filesystem API is implemented                  | Can a user explicitly export/import a bounded signed bundle and verify its hash without path escape?    | Hash cannot be verified, path scope is ambiguous, or user confirmation is absent                       | `manual-evidence-required` |
| MCP-hosted bridge with narrow Studio adapter    | Negotiated identifier only; no MCP adapter is implemented                     | Can a capability-allowlisted adapter authenticate Studio-originated evidence without hiding provenance? | Any arbitrary Studio/script/tool execution, filesystem/shell access, or opaque provenance              | `UNSUPPORTED`              |

## Recorded human-only Studio observation

The bounded records in [human-probes](evidence/studio-feasibility-human-probes-2026-08-08.json)
contain the complete reported observation set. They were taken on Windows 10 Pro 22H2, OS build
`19045.6456`, with Roblox Studio `0.732.0.7321043` (64-bit) on
`zbuck2release-732-control`. Those observed patch builds differ from the pinned target above and
therefore cannot establish compatibility for it.

| Probe | Status                     | What was observed                                                                                                                                                    | What remains unproven                                                                                                                 |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SF-01 | `manual-evidence-required` | Explorer and Properties were available. The local unpublished Baseplate was not published; HTTP stayed unchanged. No scripts/plugins or prohibited access were used. | Full permission/capability inventory and HTTP eligibility require a separately reviewed, explicitly configured probe.                 |
| SF-02 | `UNSUPPORTED`              | No bridge/plugin existed, HTTP was not enabled, and no candidate transport was connected.                                                                            | Authentication, loopback/origin constraints, version negotiation, replay/expiry/oversize rejection, and cancellation.                 |
| SF-03 | `manual-evidence-required` | Single-player Play created a character; normal Stop, and a repeated Play/Stop, returned to Edit mode with the Baseplate visually preserved.                          | Execution/scene/manifest/generation binding, bounded observation capture, stale/replay/oversize rejection, and interruption handling. |
| SF-04 | `manual-evidence-required` | Closing Studio during active Play produced no save prompt; reopening the local Baseplate returned to Edit mode with the Baseplate visually preserved.                | Identity/ownership verification, evaluator-owned cleanup, and the required signed bounded recovery export.                            |

The observation did **not** use Roblox/Open Cloud credentials, asset upload, arbitrary network
access, or a published experience. Experience Settings for the unpublished local place required
"Save to Roblox"; publication was declined, so **Allow HTTP Requests** was not changed. This is a
capability boundary, not a failed authenticated transport attempt.

## Repository model

`apps/orchestrator/src/studio-feasibility.ts` is intentionally pure and non-operational. It models:

- protocol-major and capability negotiation with required security features;
- authenticated loopback session state with an ephemeral in-memory secret, a single increasing
  sequence, one active control lease, expiry, fixed peer/origin, HMAC authentication tag, command
  allowlist, and a maximum 64 KiB message limit;
- single-player lifecycle states for start, stop, cancellation, timeout, lease expiry, interruption,
  reconciliation, cleanup uncertainty, and explicit manual recovery;
- evidence binding to `executionId`, `sceneId`, generated-root ownership, `manifestHash`,
  `sceneGeneration`, `playtestSessionId`, ordered evidence sequence, payload SHA-256, byte limit,
  and completion marker;
- immutable `unsupported-unproven` multiplayer status.

There is no API route and no call site that makes the model mutate a scene. Its only permitted
command labels are `start`, `stop`, `cancel`, `submit-evidence`, and `reconcile`; labels are checked
as data and never dispatch to code.

## Human-only Studio validation

Run every probe in a fresh copy of the pinned default place, under the target Windows and Studio
versions above. Do not edit a production place, enable a setting automatically, enter credentials,
or treat an Output line as authoritative evidence. Record `PASS`, `FAIL`, or `UNSUPPORTED`; no
result may be inferred from repository tests.

### Probe SF-01 — permissions and capability inventory

1. Open Roblox Studio manually and record the exact Studio/engine version and Windows build.
2. Inspect plugin enablement, active-place access, selection/camera/evaluator-owned-instance access,
   `HttpService`, **Allow HTTP Requests**, playtest, camera, screenshot, and performance API
   availability.
3. Confirm script injection/editing, filesystem, clipboard, Open Cloud, asset upload, cookies, and
   arbitrary network access are not requested by the evaluated artifact.
4. If HTTP is disabled, leave it disabled and record `manual-evidence-required`; do not enable it
   for this probe.

Expected result: each unavailable capability is explicitly `manual-evidence-required` or
`unsupported`; no Studio state changes occur.

### Probe SF-02 — one candidate transport at a time

1. Choose exactly one matrix candidate and record its candidate ID before connecting anything.
2. For loopback candidates, verify the peer is exactly `127.0.0.1` or `::1`, the origin matches the
   recorded local origin, and no LAN interface is bound.
3. Send one bounded, authenticated capability handshake with protocol `1.0.0`; try one unknown
   major, missing `integrity-v1`, unapproved adapter, replayed sequence, expired message, and
   oversized payload.
4. End the session and confirm no secret, cookie, account ID, payload body, or unrelated Output was
   retained in the evidence bundle.

Expected result: only the exact compatible, loopback, non-expired, bounded message is accepted. Any
other result is `FAIL` for that candidate; it does not select the transport.

### Probe SF-03 — single-player lifecycle and evidence binding

1. Record `executionId`, `sceneId`, manifest hash, generated-root ownership, generation token, and one
   evaluator-local player slot before mutation.
2. Start one playtest only after the scene-ready and character-ready conditions are visible.
3. Capture one bounded observation with the recorded binding, then attempt one stale/wrong scene,
   wrong generation, replayed, oversized, and post-interruption observation.
4. Exercise stop, cancellation, timeout, lease expiry, and simulated bridge/plugin/orchestrator
   interruption in separate fresh attempts. Confirm cleanup/restoration only for evaluator-owned
   temporary state.
5. If restoration cannot be proven, record `cleanup-uncertain`, lock automation, and follow the
   manual recovery checklist below. Do not publish interrupted evidence.

Expected result: one correctly bound observation may be accepted; every stale/replayed/oversized or
interrupted observation is rejected. Multiplayer remains `unsupported-unproven` regardless of a
single-player result.

### Probe SF-04 — manual recovery

1. Stop playtest manually.
2. Verify the active place identity, edit/play mode, camera/UI state, generated-root ownership/hash/
   generation, and evaluator-owned temporary IDs against the pre-run record.
3. Remove only clearly evaluator-owned temporary objects. If ownership is not certain, stop and
   preserve the place for reviewer recovery.
4. Create a signed export of the bounded probe record; do not include credentials, cookies, player
   identities, chat, unbounded logs, or arbitrary Studio Output.

Expected result: recovery is either visibly complete and recorded, or remains
`manual-recovery-required`. A new execution must re-handshake; interrupted work never resumes.

## Human-probe evidence format

Each probe produces one UTF-8 LF-only JSON record and any referenced bounded artifacts. A committed
human-probe batch may contain those records under a top-level `probes` array, as the recorded batch
above does. `binding` is `null` when no runtime bridge captured the required values; placeholder
identities are forbidden. A non-`PASS` record never selects a transport or proves a runtime contract:

```json
{
  "schemaVersion": "studio-feasibility-probe-v1",
  "probeId": "SF-01",
  "status": "PASS | FAIL | UNSUPPORTED | manual-evidence-required",
  "environment": {
    "studioVersion": "exact observed value",
    "windowsVersion": "exact observed value",
    "protocolVersion": "1.0.0"
  },
  "selectedTransportCandidate": "none | documented candidate ID",
  "binding": {
    "executionId": "opaque execution ID",
    "sceneId": "opaque scene ID",
    "generatedRootOwner": "AIObbyBuilder/0.3",
    "manifestHash": "sha256:<64 lowercase hex>",
    "sceneGeneration": "opaque generation ID",
    "playtestSessionId": "opaque session ID"
  },
  "observations": ["bounded, redacted structured facts only"],
  "artifactHashes": ["sha256:<64 lowercase hex>"],
  "limitations": ["human-only validation; no automatic pass claim"]
}
```

The record must state the selected candidate or `none`, the exact unavailable/rejected condition where
applicable, and SHA-256 values for every retained artifact. It must not contain session secrets, Roblox account
credentials/cookies, filesystem paths, shell commands, arbitrary payload bodies, usernames/user IDs,
chat, or broad Studio logs.

## Limitations and no-go findings

- The recorded observation proves only the narrow manual Play/Stop/close/reopen facts stated above;
  it does not prove a Studio capability inventory, transport, API, security setting, or evidence-bound
  lifecycle behavior.
- No candidate transport is approved; `manual-fallback-only` is not an automated transport.
- No production Studio plugin, bridge, local HTTP endpoint, WebSocket proxy, MCP adapter, evidence
  collector, screenshot collector, or unattended automation exists.
- This milestone does not change evaluator scoring semantics, evaluator/SceneManifest schemas,
  generated contracts, G2 runtime behavior, or accepted G2 evidence bytes.
- Multiplayer has no implementation or evidence and remains `unsupported-unproven`.

A future runtime-evidence issue may begin only after reviewed human-probe evidence selects a
transport (or records an explicit no-go) and defines a new bounded collection contract.
