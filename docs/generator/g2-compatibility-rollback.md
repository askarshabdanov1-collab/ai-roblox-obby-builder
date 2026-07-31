# G2 runtime compatibility and rollback

G2 adds an explicit SceneManifest `0.3` runtime beside the existing SceneManifest `0.2` path. It
does not widen, reinterpret, or migrate `0.2` records.

## Compatibility matrix

| Concern                        | SceneManifest `0.2`                                          | SceneManifest `0.3` G2 policy                                                                 |
| ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Active status after G2d        | Active default                                               | Opt-in library only; not selected by bootstrap                                                |
| Manifest transport             | `roblox/generated/VerticalSliceManifest.luau`                | G1d/G2 fixture; not selected by the default project                                           |
| Validator                      | `ManifestValidator.luau`                                     | `ManifestValidatorV03.luau` with G2b parity implemented                                       |
| Builder                        | Existing `Builder`/`SceneBuilderCore`                        | `BuilderV03` plus G2c core; no production caller                                              |
| Gameplay session               | Existing `PlayerProgress` and runtime                        | `RuntimeSessionV03`, implemented but not default                                              |
| Owner marker                   | `AIObbyBuilder/0.2`                                          | `AIObbyBuilder/0.3`                                                                           |
| Stage/checkpoint bounds        | Legacy maximum 20; checkpoint required                       | 5–50 stages; zero checkpoints allowed                                                         |
| Version selection              | Current bootstrap is implicitly `0.2`                        | Future explicit server-lifetime selection                                                     |
| Cross-version coercion         | Rejected                                                     | Rejected                                                                                      |
| Live cross-version replacement | Not supported                                                | Prohibited                                                                                    |
| Studio evidence                | [Phase 0 regression recorded](./phase0-smoke-2026-07-31.txt) | [Pre-cutover sequences completed](./g2e-studio-evidence-2026-07-31.md); evidence gaps pending |

## Server-lifetime selection

One server runs one runtime version. The future selector must be explicit, fail closed on an unknown
value, and load only one builder. Running both builders would duplicate `Players` and
`CharacterAdded` bindings and is prohibited. Changing versions requires a fresh server.

The default project and `ObbyBootstrap.server.luau` remain unchanged throughout G2a–G2e. A final,
separately reviewed cutover may select `0.3` only after automated validation and manual Studio
acceptance. It must retain a documented way to select `0.2`.

## Ownership rules

- A `0.2` builder may replace only a root marked `GeneratedBy = "AIObbyBuilder/0.2"`.
- The opt-in `0.3` builder may replace only a root marked `GeneratedBy = "AIObbyBuilder/0.3"`.
- An unowned, ambiguously owned, or other-version root fails closed and is not modified.
- G2 does not attempt to translate progress, object IDs, or live Instances between versions.

## Rollback procedure

1. Stop admitting new servers on the `0.3` configuration.
2. Select the committed `0.2` runtime configuration.
3. Start a fresh server; do not replace a live `0.3` root with `0.2`.
4. Load `roblox/generated/VerticalSliceManifest.luau` through the existing bootstrap.
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
