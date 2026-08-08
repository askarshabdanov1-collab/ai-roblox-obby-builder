# Evidence model, Studio integration, and screenshot protocol

## Evidence graph

Every metric and finding is a node derived from immutable evidence:

```text
SceneManifest hash + EvaluationPlan configurationHash + evaluator/config versions
    ├── geometry facts ── route transitions ── feasibility metrics
    ├── runtime observations ── checkpoint/playability/performance metrics
    ├── screenshot artifacts ── image regions/features ── visual metrics
    ├── reference snapshot/features ── contextual comparison metrics
    ├── human labels ── subjective aggregate metrics
    └── first-party analytics snapshot ── calibration/readiness metrics

metrics + catalog/profile versions ── findings ── EvaluationReport
```

An evidence record identifies:

- manifest, execution, plan, evaluator, catalog, profile, configuration, and producer versions;
- source kind and derivation parents;
- exact subject object IDs, route transitions, coordinates, screenshots, and image regions;
- artifact hashes, runtime log ranges, test-player slots, and performance sample windows;
- capture wall-clock time only in the named execution envelope, monotonic sequence/relative time
  only for runtime or performance content, and calculation time only as execution metadata;
- validity checks, confidence, limitations, and retention/access class.

The graph is acyclic and content-addressed. Final reports can be reproduced without resolving
mutable “latest” references.

## Evidence storage

Proposed local layout (logical, not created in E0):

```text
workspace evaluation store
├── executions/<execution-id>/index.json
├── records/sha256/<prefix>/<hash>.json
├── artifacts/sha256/<prefix>/<hash>
├── reports/sha256/<prefix>/<hash>.json
└── reports/sha256/<prefix>/<hash>.md
```

Rules:

- write to a temporary file, hash/verify, then atomically publish;
- deduplicate by content hash;
- never store credentials, Studio auth tokens, Roblox usernames/user IDs, chat, or unrelated logs;
- store only evaluator player slots and approved event fields;
- binary artifacts have media type, dimensions, byte length, and capture provenance;
- each external/reference artifact has a retention class and deletion/tombstone process;
- deleting governed evidence never mutates its record or any finalized report;
- an external immutable `AvailabilityRecord`, identified by `availabilityRecordHash`, records the
  affected evidence/artifact/reference identity, state, reason, semantic effective point, authority,
  producer, policy, supersession parents, optional successor, and impact scope without containing deleted
  material;
- a later derived report may reference the original report and ordered `availabilityRecordHash`
  values, but receives a new payload hash; the original report and hash remain unchanged;
- reproduction is `complete`, `partial`, or `impossible` according to whether all behavior-bearing
  inputs remain available and verifiable.

Evidence identities follow the named preimages in
[Evaluation contract design](contracts.md#hash-and-reproducibility-domains). Static content hashes
never absorb execution provenance. Runtime, screenshot, and human evidence keep deterministic
content/payload identity separate from execution-specific envelopes. Screenshot storage records
`screenshotBinaryHash`, `screenshotProtocolMetadataHash`, and
`screenshotEvidenceEnvelopeHash`; the three identities are never treated as interchangeable.
Availability assertions use `availabilityRecordHash` computed only from
`AvailabilityRecordPreimage`; conflicting or changed assertions create new records and never
overwrite prior records.

## Explainability and reproduction

Every finding includes a minimal reproduction:

- manifest hash and object/transition IDs;
- analyzer and metric definition versions;
- input coordinates/surface regions and resolved thresholds;
- for runtime evidence: session, sequence range, player slot, scene generation, Studio version;
- for screenshots: view protocol, camera transform, `screenshotBinaryHash`,
  `screenshotProtocolMetadataHash`, execution-envelope reference, regions, and overlay coordinates;
- for performance: sample interval, device profile, summary method, and raw sample artifact;
- for comparisons: reference snapshot and candidate/reference feature versions;
- deterministic root command or future API request using content hashes.

Human-readable reports may render annotated images, but the annotations are separate overlays so
the original `screenshotBinaryHash` remains unchanged.

## Future Roblox Studio integration

Studio automation is not assumed feasible. A dedicated future **Studio feasibility milestone** must
precede implementation. It must test permissions, transport, lifecycle recovery, single-player
control, and evidence integrity against a pinned Studio/engine version. Multiplayer automation
remains unproven until that prototype demonstrates repeatable slot creation and isolation.

The repository-owned guard model, pinned human-probe target, capability matrix, and exact
human-only evidence procedure are recorded in [Studio feasibility milestone](studio-feasibility-milestone.md).
Its [bounded 2026-08-08 human-probe batch](evidence/studio-feasibility-human-probes-2026-08-08.json)
records only manual Play/Stop/close/reopen observations and unavailable capability boundaries. It
does not claim authenticated transport, evidence binding, a signed recovery record, Studio
acceptance, or selection of an automated transport.

### Required permissions and Studio settings

The feasibility prototype must inventory and minimize:

- plugin install/enable permission and access only to the active place, selection, camera, and
  evaluator-owned instances;
- `HttpService` availability and the user's explicit **Allow HTTP Requests** setting when HTTP is
  attempted; disabled HTTP must be detected, never silently enabled;
- script injection/edit permissions, filesystem, clipboard, Open Cloud, asset upload, account
  cookies, and arbitrary network access, all rejected for the evaluator;
- local loopback networking and firewall behavior on supported Windows configurations;
- playtest, camera, screenshot, and performance APIs actually exposed to the chosen plugin context.

The plugin displays every required setting and permission before a run. Missing capability yields
`manual-evidence-required` or `unsupported`, not a partial claim of automation.

### Capability and version negotiation

Before accepting work, each side exchanges protocol version/range, Studio and engine build,
plugin/bridge/orchestrator versions, supported transports, playtest modes, capture capabilities,
payload limits, and security features. The orchestrator selects only a documented compatible
intersection. Unknown major versions, missing integrity features, unsupported required
capabilities, or unapproved adapters reject the job before scene mutation.

Transport availability is actively probed without changing Studio state:

| Candidate                                                  | Feasibility question                                                                 | Reject when                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Plugin-originated loopback HTTP polling                    | Can enabled `HttpService` reach only the authenticated local endpoint reliably?      | HTTP is disabled, peer/origin cannot be bound, or polling cannot meet lease/cancel guarantees |
| Plugin-originated loopback WebSocket through a local proxy | Does the supported Studio/plugin environment expose a stable audited client path?    | Requires unsupported APIs, broad network exposure, or cannot authenticate every frame         |
| File-based user-mediated bundle exchange                   | Can a user export/import signed bundles through explicit UI?                         | Paths cannot be safely scoped or artifact hashes cannot be verified                           |
| MCP-hosted bridge with a narrow Studio adapter             | Can capabilities remain allowlisted and Studio-originated evidence be authenticated? | It exposes arbitrary Studio/script/tool execution or obscures provenance                      |

No transport is selected in E0. Manual signed bundle import is the required fallback when automation
or local networking is unavailable.

### Responsibilities

The future Studio plugin or MCP bridge will:

1. advertise protocol/plugin/Studio versions and capabilities;
2. authenticate a single local evaluator session;
3. receive a validated manifest hash and scene payload reference;
4. stage and rebuild through the existing owned-root runtime path;
5. confirm generated-root ownership, manifest hash, and generation token;
6. configure one-player test sessions and, only after proven capability negotiation, bounded
   multiplayer sessions;
7. start/stop playtests and reset deterministic evaluator player slots;
8. collect bounded runtime observations and filtered logs;
9. configure fixed cameras and capture screenshots;
10. collect performance samples;
11. return content hashes and evidence records;
12. optionally preview approved correction patches in a staging scene;
13. restore the prior Studio state on completion, cancellation, or failure.

The bridge does not expose arbitrary script execution, filesystem access, shell commands, or
unbounded log streaming.

### Localhost transport and authentication

- Bind only to `127.0.0.1`/`::1`; never listen on LAN interfaces by default.
- Desktop/orchestrator generates a cryptographically random, short-lived session secret and displays
  a user confirmation code in both clients.
- Derive per-connection keys through a nonce-based handshake; do not persist the secret.
- Require authenticated messages with protocol version, session ID, monotonically increasing
  sequence, request ID, expiration, and payload digest.
- Permit one active controlling client unless the user explicitly ends or transfers the session.
- Apply strict command allowlists and contract validation before dispatch.
- Redact secrets from errors/logs and close the connection after repeated authentication failures.
- If WebSocket/HTTP is used, reject non-loopback peers and unexpected `Origin` values; browser
  clients require anti-CSRF/session binding.
- No Roblox account credential, cookie, API key, or Open Cloud secret is needed for local Studio
  evaluation.

The exact transport remains unresolved pending the feasibility milestone.

### Scene lifecycle and stale-scene protection

Each command carries:

- `executionId`;
- expected `manifestHash`;
- `sceneGeneration` opaque token;
- command sequence and deadline;
- optional playtest session ID.

After any rebuild, Studio returns a new generation token. Collectors reject observations/captures
unless current generated-root attributes, manifest hash, generation token, execution ID, and playtest
session all match. A callback registered under an older generation can log a discarded-stale-event
counter but cannot publish evidence or apply corrections.

Rebuild remains staged and atomic. Failed validation/build preserves the previous valid scene.

### Playtest control

- One-player mode uses one evaluator-local slot.
- Multiplayer automation is `unsupported-unproven` until the feasibility milestone passes; a
  future compatible mode must declare an exact bounded slot count.
- Session start waits for generated scene ready, all expected characters ready, and root placement
  complete.
- Actions use a future bounded test-driver vocabulary (spawn, reset, move to test marker, attempt
  transition, touch checkpoint/hazard/finish), not arbitrary Luau.
- Observations are tagged by slot; no real player identity is collected.
- Stop is idempotent and always attempts cleanup.
- Runtime evidence cannot be reused across a rebuild or Studio restart.

### Cancellation, timeout, and recovery

| Operation            |             Proposed default | On timeout/cancel                                                         |
| -------------------- | ---------------------------: | ------------------------------------------------------------------------- |
| Connect/authenticate |                         10 s | Close session, no state change                                            |
| Validate/stage scene |                         15 s | Destroy staging only; keep prior scene                                    |
| Rebuild/confirm      |                         30 s | Cancel generation, preserve prior valid scene                             |
| Start playtest       |                         30 s | Stop partial session                                                      |
| Character ready      |                15 s per slot | Mark runtime evidence incomplete; stop                                    |
| Single capture       |                         10 s | Discard capture, reset camera                                             |
| Runtime scenario     |                         60 s | Stop scenario; retain only validated partial observations if plan permits |
| Entire Studio stage  | Plan budget, initially 5 min | Stop playtest, restore camera/UI, release session                         |

Cancellation requests are acknowledged quickly, then cleanup has a bounded grace period. The
orchestrator force-closes transport after the grace period and marks cleanup uncertain; a new execution
must re-handshake and verify Studio state.

### Lease, crash, and startup reconciliation

- The controller grants one short lease keyed by session and execution IDs. Authenticated
  heartbeats renew it; missed heartbeats expire control and prohibit new mutations.
- Before mutation, the plugin persists a minimal pre-run snapshot: place identity, play/edit mode,
  camera/UI state, generated-root identity/hash/generation, and evaluator-owned temporary IDs. It
  never snapshots unrelated user content.
- On normal cancellation it stops play, discards unpublished evidence, removes only owned temporary
  objects, restores the snapshot, and releases the lease.
- After an abrupt plugin, Studio, bridge, or orchestrator crash, the next startup performs
  reconciliation before accepting work. Expired leases and owned temporary jobs become orphaned;
  the user sees the detected state and approves destructive cleanup when ownership is not certain.
- Evidence from an interrupted job remains quarantined until hashes, execution/session identity,
  manifest generation, and completion markers validate. Stale jobs can never resume mutation.
- If automatic restoration cannot be proven, the job is `cleanup-uncertain`, automation remains
  locked, and the UI provides a bounded manual recovery checklist and signed evidence export.

### Logs and observations

The collector allowlists structured evaluator events. General Studio output is bounded and
redacted, attached only when relevant to a failed stage, and never parsed as authoritative gameplay
facts. Stack traces are local diagnostic artifacts with restricted retention.

### Approved corrections

Future `suggest_corrections` emits non-executable typed intents. To apply:

1. reviewer selects individual suggestions;
2. UI shows manifest/object diffs, evidence, predicted score effects, and risks;
3. current scene hash/generation must match the evaluated revision;
4. repository-side code produces a new PlaceSpec/SceneManifest through normal validation/generation;
5. Studio stages/rebuilds the new revision;
6. evaluator runs again; the prior report remains immutable.

No evaluator component directly edits collision geometry in Studio outside the validated pipeline.

## Screenshot protocol

### Global protocol

Initial protocol ID: `roblox-obby-fixed-views-draft-0`. It is a design target, not a reproducible v1
standard. Affected visual metrics are incomparable by default when any required requested/observed
setting differs; a versioned compatibility rule supported by validation data is the only exception.

| Parameter           | Draft-0 treatment                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Graphics quality    | Fixed requested level and observed engine level recorded; exact supported level is deferred to feasibility testing        |
| Renderer/API/GPU    | Renderer, graphics API, GPU vendor/device, and driver recorded; cross-environment compatibility is deferred               |
| Resolution/viewport | Requested and observed pixel resolution plus viewport rectangle recorded                                                  |
| DPI/OS scaling/DPR  | OS scaling, DPI, and device-pixel ratio recorded; no compatibility classes approved                                       |
| Colorspace/format   | Lossless PNG target; observed colorspace, transfer/alpha behavior recorded and unresolved behavior rejects strict capture |
| Lighting/time       | Content-addressed lighting profile, clock time, ambient, brightness, exposure, atmosphere, and post-processing recorded   |
| Shadows/sky/clouds  | Requested and observed shadow mode, sky identity, cloud state recorded; final fixed assets/settings deferred              |
| Particles           | Disabled/frozen when capability permits; otherwise count/state and deviation recorded                                     |
| Animation/physics   | Seed/freeze policy, observed animation state, simulation state, and settle result recorded                                |
| Settle/readiness    | Settle duration, frame count, streaming completion signal, and texture readiness signal recorded; thresholds deferred     |
| Camera              | `Scriptable`; full observed CFrame, eye anchor, pitch, yaw, roll, and FOV recorded per view                               |
| Desktop/mobile      | Desktop, mobile landscape, and mobile portrait profiles remain distinct; exact dimensions deferred                        |
| UI/safe area        | Core/game/evaluator UI policy, UI scale, safe-area insets, and unexpected overlays recorded                               |
| Character           | Explicit per-view hidden/visible policy, rig, pose, eye position, and scale recorded                                      |
| Locale              | Studio/OS locale and language recorded because UI/text/rendering may differ                                               |
| Validity            | Manifest hash, generation, execution/session, and protocol settings checked before and after capture                      |

The protocol records requested and observed settings because Roblox/driver versions may not honor
every request identically.

Draft-0's proposed analysis views hide the character; a separately named scale view may show a
pinned rig/pose. The exact eye offset and non-level camera pitch rule are deferred and therefore
must be plan fields before a capture can claim protocol compliance. A plan that omits them produces
draft evidence only, not comparable visual metrics.

### View definitions

| View                   | Anchor and camera rule                                                                                                 | Required purpose                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Spawn view             | Camera at default character eye approximation above spawn center, yaw equal to deterministic spawn facing, level pitch | First frame, first objective, route contrast          |
| First-route view       | Look from spawn/first approach toward first safe-route object, framing source and target                               | First transition readability                          |
| Checkpoint approach    | Position on previous route object's approach region, look at checkpoint center                                         | Checkpoint recognition and hazard context             |
| Checkpoint respawn     | Camera at fixed eye offset from checkpoint respawn CFrame, route-aware yaw                                             | Next objective after respawn                          |
| Hazard approach        | Safe-route approach point before each representative hazard, look toward transition landing                            | Visibility, safe margin, fairness                     |
| Finish approach        | Previous safe-route object/approach point looking at finish center                                                     | Goal visibility and final transition                  |
| Top-down               | Center above world/route bounds, `-Y` look, orthogonal north convention; perspective FOV/height computed by protocol   | Route topology, density, skips                        |
| Three-quarter overview | Deterministic corner selected from bounds and route direction, look at route-bounds center                             | Composition, hierarchy, world extent                  |
| Mobile viewport        | Spawn and critical approach camera rules rendered with mobile profile/safe area                                        | Estimated mobile readability                          |
| Failure-specific       | Derived from finding subject; camera basis selected by deterministic rule ID                                           | Explain a transition, occlusion, overlap, or softlock |

For multiple checkpoints/hazards, the plan declares all or a deterministic sampling policy (first,
median, last, plus every blocking-finding subject). Sampling is recorded and lowers coverage for
unsampled objects.

### Camera calculations

- Object targets use transform centers or named surface/landing-region centroids.
- Route-facing views ignore vertical difference for yaw, matching runtime placement, then apply a
  versioned pitch to keep source and target within frame.
- Overview bounds use safe-route bounds plus a fixed proportional margin, not decorative outliers;
  a second whole-world overlay may identify excluded outliers.
- Top-down uses fixed `-Z` as screen-up unless the coordinate protocol changes.
- Near/far clipping, camera collision avoidance, and occlusion handling are recorded; the controller
  does not silently move a camera to obtain a better score.

### Capture failure rules

- Wrong hash/generation/session: discard and fail stale.
- Missing anchor/target: finding plus missing screenshot; do not substitute another view.
- Unsettled dynamic state: retry once only if plan permits and the retry is recorded.
- Unsupported resolution/quality or any other required setting: mark protocol deviation and make
  affected visual metrics incomparable; reject when the plan requires protocol compliance.
- Blank/corrupt image or unexpected UI: reject artifact.
