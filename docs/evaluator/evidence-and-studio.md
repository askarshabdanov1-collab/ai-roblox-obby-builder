# Evidence model, Studio integration, and screenshot protocol

## Evidence graph

Every metric and finding is a node derived from immutable evidence:

```text
SceneManifest hash + EvaluationPlan hash + evaluator/config versions
    ├── geometry facts ── route transitions ── feasibility metrics
    ├── runtime observations ── checkpoint/playability/performance metrics
    ├── screenshot artifacts ── image regions/features ── visual metrics
    ├── reference snapshot/features ── contextual comparison metrics
    ├── human labels ── subjective aggregate metrics
    └── first-party analytics snapshot ── calibration/readiness metrics

metrics + catalog/profile versions ── findings ── EvaluationReport
```

An evidence record identifies:

- manifest, run, plan, evaluator, configuration, and producer versions;
- source kind and derivation parents;
- exact subject object IDs, route transitions, coordinates, screenshots, and image regions;
- artifact hashes, runtime log ranges, test-player slots, and performance sample windows;
- capture/calculation time and deterministic sequence where applicable;
- validity checks, confidence, limitations, and retention/access class.

The graph is acyclic and content-addressed. Final reports can be reproduced without resolving
mutable “latest” references.

## Evidence storage

Proposed local layout (logical, not created in E0):

```text
workspace evaluation store
├── runs/<run-id>/index.json
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
- deletion of a governed source preserves a non-reversible tombstone and invalidates dependent
  future comparisons without rewriting historical reports;
- reports remain readable when optional artifacts are deleted, but declare missing governed
  evidence.

## Explainability and reproduction

Every finding includes a minimal reproduction:

- manifest hash and object/transition IDs;
- analyzer and metric definition versions;
- input coordinates/surface regions and resolved thresholds;
- for runtime evidence: session, sequence range, player slot, scene generation, Studio version;
- for screenshots: view protocol, camera transform, artifact hash, regions and overlay coordinates;
- for performance: sample interval, device profile, summary method, and raw sample artifact;
- for comparisons: reference snapshot and candidate/reference feature versions;
- deterministic root command or future API request using content hashes.

Human-readable reports may render annotated images, but the annotations are separate overlays so
the original screenshot hash remains unchanged.

## Future Roblox Studio integration

### Responsibilities

The future Studio plugin or MCP bridge will:

1. advertise protocol/plugin/Studio versions and capabilities;
2. authenticate a single local evaluator session;
3. receive a validated manifest hash and scene payload reference;
4. stage and rebuild through the existing owned-root runtime path;
5. confirm generated-root ownership, manifest hash, and generation token;
6. configure one-player or multiplayer test sessions;
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

The exact transport (plugin HTTP, WebSocket proxy, or MCP-hosted bridge) remains an E0 unresolved
decision and requires a Studio capability/security prototype.

### Scene lifecycle and stale-scene protection

Each command carries:

- `runId`;
- expected `manifestHash`;
- `sceneGeneration` opaque token;
- command sequence and deadline;
- optional playtest session ID.

After any rebuild, Studio returns a new generation token. Collectors reject observations/captures
unless current generated-root attributes, manifest hash, generation token, run ID, and playtest
session all match. A callback registered under an older generation can log a discarded-stale-event
counter but cannot publish evidence or apply corrections.

Rebuild remains staged and atomic. Failed validation/build preserves the previous valid scene.

### Playtest control

- One-player mode uses one evaluator-local slot.
- Multiplayer mode declares an exact slot count, currently bounded to a small test profile.
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
orchestrator force-closes transport after the grace period and marks cleanup uncertain; a new run
must re-handshake and verify Studio state.

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

Initial protocol ID: proposed `roblox-obby-fixed-views-v1`.

| Setting          | Deterministic requirement                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Camera           | `Scriptable`; world CFrame recorded to full supported precision                                                                         |
| FOV              | 70° unless view override is versioned                                                                                                   |
| Resolution       | Desktop `1920×1080`; mobile profile `1280×720` render with declared safe-area simulation, plus future portrait profile after validation |
| Graphics quality | Fixed named quality level and observed engine quality recorded                                                                          |
| Lighting         | Versioned evaluator lighting profile; time, ambient, brightness, shadows, atmosphere, post-processing recorded                          |
| UI               | Core/game UI hidden unless a UI-specific plan requests it; evaluator overlay never included in source image                             |
| Character        | Hidden for geometry/composition views; visible with fixed rig/pose for scale views; policy recorded                                     |
| Dynamic state    | Physics paused or scene settled; animations seeded/frozen where possible                                                                |
| Timing           | Wait for scene ready, two render frames, configured settle time, then capture at a fixed monotonic offset                               |
| Format           | Lossless PNG preferred; colorspace and alpha policy recorded                                                                            |
| Validity         | Manifest hash/generation checked immediately before and after capture                                                                   |

The protocol records requested and observed settings because Roblox/driver versions may not honor
every request identically.

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
- Unsupported resolution/quality: mark protocol deviation and confidence penalty or reject if
  strict.
- Blank/corrupt image or unexpected UI: reject artifact.
