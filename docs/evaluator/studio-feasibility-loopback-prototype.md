# Development-only Studio feasibility loopback prototype

This is a narrow feasibility artifact for issue #23, not a production plugin, runtime-evidence
collector, or unattended Studio automation. It selects **plugin-originated loopback HTTP polling**
only for a manually supervised probe. The local Node bridge binds exclusively to `127.0.0.1:4318`.
Roblox documents that Studio plugins may communicate with `localhost` and `127.0.0.1`, subject to
the user's plugin permission decision; if permission or `HttpService` is unavailable, this probe is
`manual-evidence-required`, not a reason to enable a setting automatically.

## Repository artifacts

- plugin project: `roblox/studio-feasibility.plugin.project.json`
- built plugin: `build/AIObbyBuilderStudioFeasibilityDevLocalV4.rbxm`
- bridge command: `npm run evaluator:studio-feasibility:bridge`
- production-default diagnostic place: `build/AIObbyBuilder.rbxlx`, from `npm run roblox:build`

The bridge creates a fresh in-memory 32-byte secret and a single session for each process. It prints
one activation JSON document to the local terminal. Paste that document into the plugin only for the
active local probe; do not save it, commit it, send it in a comment, or include it in evidence. The
plugin keeps it in memory only.

Every bridge message uses protocol `1.0.0`, HMAC-SHA-256, a SHA-256 payload digest, monotonically
increasing sequence, expiry, the fixed plugin origin, the fixed loopback peer, the 64 KiB transport
bound, and one of `start`, `stop`, `cancel`, `submit-evidence`, or `reconcile`. The bridge accepts
one controlling session only. Evidence remains additionally capped by the existing 1 KiB feasibility
model bound. There is no shell, filesystem, arbitrary Luau, Open Cloud, credential, cookie,
asset-upload, MCP, WebSocket, or broad-network capability.

## Human-proven Play context limitation

The 2026-08-11 `local-v3` probe armed successfully in the plugin/edit context while the production
server separately printed a successful 0.3 build. The plugin remained armed after Stop and never
observed `Workspace.GeneratedObby`. Roblox Studio Test runs distinct client and server simulations,
and Stop resets runtime objects to the pre-test edit state. Therefore a local plugin's edit-context
`game`/`workspace` lookup is not accepted as access to the server simulation DataModel. Automatic
root detection and Play auto-start are `unsupported-unproven` and have been removed.

`local-v4` uses the repository's required manual fallback. The human inspects the ephemeral root in
Studio's **Server** view during Play and transcribes only four bounded identity fields. After Stop,
the plugin validates that JSON, binds its in-memory execution and a fresh playtest session ID, then
performs the authenticated `reconcile`/`start` protocol transitions. This proves the loopback and
binding rejection paths, but it is `manual-evidence-required`; it is not automated server-runtime
evidence collection or unattended Play control.

The stale `user_StudioFeasibility.rbxmx` may still execute and print its historical `.Click` error.
`local-v4` has a distinct Script, toolbar, widget, and build artifact identity and never calls or
reads that plugin, so the probe does not depend on it. No Studio-UI removal path for that local file
was demonstrated; do not edit the Plugins directory during the probe. Treat only messages prefixed
by the `local-v4` widget/status as feasibility results.

## Human-only procedure

1. In a repository terminal run `npm run roblox:build` and then
   `npm run roblox:studio-feasibility:plugin:build`.
2. Start the bridge in a second terminal: `npm run evaluator:studio-feasibility:bridge`. Keep that
   terminal local and visible; it prints the one-time activation JSON and must be stopped when the
   probe ends.
3. Install the locally built plugin through Studio rather than copying its `.rbxm` into the Plugins
   directory. Open a throwaway local Baseplate, drag
   `build/AIObbyBuilderStudioFeasibilityDevLocalV4.rbxm` into **Explorer**, expand its model, select
   the `StudioFeasibilityLocalV4` Script, and choose **Plugins → Save as Local Plugin**. Studio owns
   the local plugin installation and will expose it after a restart. This version has a deliberately
   unique Script identity, so Studio writes a separate local plugin rather than silently continuing
   to load an older `StudioFeasibility.rbxmx`; use only the toolbar and widget marked `local-v4`.
   The build intentionally has a `Model` root so this import-and-install flow contains a loadable
   Script; it is not a serialized `Plugin` instance. Do not publish the Baseplate.
4. Open `build/AIObbyBuilder.rbxlx` in Roblox Studio. Do not publish it. Approve a plugin permission
   only for `127.0.0.1` if Studio presents one. Do not approve any other host. Do not enable
   **Allow HTTP Requests** for the place: plugin localhost permission is the only expected network
   permission.
5. In **Plugins → AI Obby Builder Dev local-v4**, open **Studio feasibility local-v4** in Edit mode.
   Paste the activation JSON and click **Prepare / Arm**. The plugin clears the TextBox and retains
   activation only in current-process memory; it reports `manual-runtime-observation-required` plus
   `isRunning`, `isEdit`, `pluginWorkspaceRootVisible`, and `placeId`. It never uses plugin settings
   or a file for `secretHex`.
6. Start one single-player Play session. Switch Studio's playtest toggle to **Server**. In Explorer,
   select `Workspace.GeneratedObby` and copy exactly its `GeneratedBy`, `ManifestHash`, and
   `GenerationToken` attributes. Record scene ID as `place-<PlaceId>` (`place-0` for an unpublished
   local place). Do not copy broad Output, a path, account identity, or any other attribute. Confirm
   `GeneratedBy` is exactly `AIObbyBuilder/0.3`, then click Studio **Stop**.
7. Reopen **Studio feasibility local-v4** in Edit mode. Paste exactly this bounded JSON, substituting
   only the four observed values:

   `{"sceneId":"place-0","generatedRootOwner":"AIObbyBuilder/0.3","manifestHash":"sha256:<64 lowercase hex>","sceneGeneration":"<GenerationToken>"}`

   Click **Verify observed**. The plugin must return `manual-observed-binding-verified` with
   limitation `plugin-server-runtime-datamodel-unavailable`; the bridge performs authenticated
   `reconcile` followed by `start`. Any malformed, wrong-scene, wrong-owner, wrong-hash, or wrong
   generation value fails closed.

8. Capture only the redacted result code and displayed binding values. Click **Submit evidence**
   once; it submits only the fixed bounded `binding-observed` record. Then click plugin **Stop** and
   confirm the returned result is successful.
9. In a separate fresh session, click **Recovery** while the bridge session is still running
   to simulate the bridge/plugin interruption path. The response contains a bounded signed recovery
   JSON and signature. Copy those two fields into a new redacted record; never include the activation
   secret, terminal path, account identity, or broad Studio Output. Then stop Play manually.
10. Stop the bridge with Ctrl+C, close the plugin, and manually restore Edit mode. If any state cannot
    be verified, record `manual-recovery-required`; do not retry automatically.

## Required probe matrix

Run each row in a fresh bridge process and record the result code, not a PASS inference.

| Case                                      | How to exercise                                                                                     | Expected bridge result                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Valid handshake                           | Follow steps 1–8 with the current activation and bounded manual observation.                        | `manual-observed-binding-verified`; exact binding displayed.         |
| Unknown major                             | Use the development harness test; the plugin does not offer an unsafe free-form editor.             | `protocol-major-mismatch`                                            |
| Missing `integrity-v1`                    | Development harness test.                                                                           | `missing-integrity-feature`                                          |
| Unapproved adapter                        | Development harness test.                                                                           | `unapproved-adapter`                                                 |
| Replay / expiry / oversized transport     | Development harness test.                                                                           | `replayed-sequence`, `expired-message`, `malformed-loopback-request` |
| Wrong scene / generation / stale evidence | Development harness test or a future reviewed fixture; never hand-edit an accepted evidence record. | `wrong-scene`, `wrong-generation`, `replayed-evidence`               |
| Interrupted evidence                      | Use recovery flow; no interrupted evidence may be finalized.                                        | `interrupted-evidence` or `manual-recovery-required`                 |

The harness proves the implementation paths locally. A Studio result is only the explicit human
record created after this runbook; no result from this document is a Studio PASS.
