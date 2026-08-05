# G2 runtime compatibility and rollback

G2 adds an explicit SceneManifest `0.3` runtime beside the existing SceneManifest `0.2` path. It
does not widen, reinterpret, or migrate `0.2` records.

## Compatibility matrix

| Concern                        | SceneManifest `0.2` rollback                                 | SceneManifest `0.3` default after cutover                                                                 |
| ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Active status                  | Committed rollback selection                                 | Active default                                                                                            |
| Manifest transport             | `roblox/generated/VerticalSliceManifest.luau`                | `roblox/generated/G2ReferenceManifestV03.luau`                                                            |
| Validator                      | `ManifestValidator.luau`                                     | `ManifestValidatorV03.luau`                                                                               |
| Builder                        | Existing `Builder`/`SceneBuilderCore`                        | `BuilderV03` plus G2c core                                                                                |
| Gameplay session               | Existing `PlayerProgress` and runtime                        | `RuntimeSessionV03`                                                                                       |
| Owner marker                   | `AIObbyBuilder/0.2`                                          | `AIObbyBuilder/0.3`                                                                                       |
| Stage/checkpoint bounds        | Legacy maximum 20; checkpoint required                       | 5–50 stages; zero checkpoints allowed                                                                     |
| Version selection              | `RuntimeConfiguration.Version = "0.2"`                       | `RuntimeConfiguration.Version = "0.3"`                                                                    |
| Production execution mode      | `RuntimeConfiguration.ExecutionMode = "production"`          | `RuntimeConfiguration.ExecutionMode = "production"`                                                       |
| Cross-version coercion         | Rejected                                                     | Rejected                                                                                                  |
| Live cross-version replacement | Not supported                                                | Prohibited                                                                                                |
| Studio evidence                | [Phase 0 regression recorded](./phase0-smoke-2026-07-31.txt) | [Pre-cutover acceptance recorded](./evidence/g2e-final-observation-sheet.txt); post-cutover rerun pending |

## Server-lifetime selection

One server runs one runtime version and one execution mode. `roblox/default.project.json` commits
the explicit `RuntimeConfiguration.Version` and `RuntimeConfiguration.ExecutionMode` selectors plus
both versioned manifest transports. The shared selector accepts production `0.2`, production `0.3`,
or Studio-acceptance `0.3`. Unknown values and Studio-acceptance `0.2` fail closed before a builder
is loaded. Running both builders would duplicate `Players` and `CharacterAdded` bindings and is
prohibited. Changing either selector requires a configuration change, a rebuilt place, and a fresh
server.

Production `0.3` automatically builds the accepted reference scene and does not map the acceptance
harness. The committed `roblox/default-studio-acceptance.project.json` changes only the execution
mode to `studio-acceptance` for the default 0.3 path, adds the bounded harness/session fixtures, and
begins with zero generated roots. It is an evidence-collection artifact, not a production default.

The separately reviewed default cutover selects `0.3` after automated validation and the accepted
pre-cutover Studio evidence. It does not complete or claim the post-default-cutover Studio rerun
required by `g2-studio-acceptance.md` and `g2e-final-studio-rerun.md`.

## Ownership rules

- A `0.2` builder may replace only a root marked `GeneratedBy = "AIObbyBuilder/0.2"`.
- The opt-in `0.3` builder may replace only a root marked `GeneratedBy = "AIObbyBuilder/0.3"`.
- An unowned, ambiguously owned, or other-version root fails closed and is not modified.
- G2 does not attempt to translate progress, object IDs, or live Instances between versions.

## Rollback procedure

1. Stop admitting new servers on the `0.3` configuration.
2. In `roblox/default.project.json`, set the `RuntimeConfiguration.Version` StringValue property from
   `"0.3"` to `"0.2"` and keep `RuntimeConfiguration.ExecutionMode = "production"`. Leave both
   versioned manifest mappings and the bootstrap unchanged.
3. Start a fresh server; do not replace a live `0.3` root with `0.2`.
4. Rebuild the default place. The bootstrap selects `Builder` and loads
   `roblox/generated/VerticalSliceManifest.luau`; it does not load `BuilderV03`.
5. Run `npm run validate`, build `roblox/smoke.project.json`, and execute the Phase 0 Studio smoke
   procedure if the rollback follows a relevant Roblox/runtime change.
6. Confirm the root is owned by `AIObbyBuilder/0.2` and no `0.3` runtime session is present.

Rollback does not delete `0.3` contracts or G1 artifacts. It changes runtime selection only. Player
state is in-memory and server-scoped, so a fresh server begins with no migrated checkpoint or finish
state.

## G2a protection

G2a changes no file under `roblox/src`, `roblox/generated`, `roblox/smoke`, or either Rojo project.
`npm run g2a:scope:check` audits the branch diff against the G2a baseline. This historical scope
check is deliberately separate from the general validation chain so a future reviewed G2b branch
can add its authorized modules.
