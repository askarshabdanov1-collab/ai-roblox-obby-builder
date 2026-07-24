# AI Roblox Obby Builder

Deterministic-first pipeline for generating Roblox Obbies from a structured description.

## Current milestone

1. `PlaceSpec` describes the intended Obby.
2. `SceneManifest` describes the exact scene to build.
3. A Roblox builder creates the first playable vertical slice from native Parts.
4. AI image generation, Modly, mesh processing, visual ranking, and retention analytics are connected only after the deterministic pipeline is stable.

## Planned pipeline

```text
Description
→ PlaceSpec
→ Game Design Agent
→ Art Director Agent
→ SceneManifest
→ Roblox Builder
→ Play Tests
→ Screenshots
→ Visual Evaluation
→ Retention Feedback
```

## Confirmed open-source 3D component

- Repository: `lightningpixel/modly`
- Role: local image-to-3D generation and GLB export
- Integration target: Modly CLI / local API
- Required attribution: `Based on Modly by Lightning Pixel`

Modly is not bundled yet. It will run as an external audited worker.

## Repository layout

```text
docs/                    Architecture and decisions
packages/contracts/      PlaceSpec and SceneManifest schemas
examples/                Example validated specifications
roblox/                  Rojo project and deterministic builder
```

## Security rules

- Never commit Google Cloud, Roblox Open Cloud, or GitHub credentials.
- Pin external repositories and model extensions to audited commit SHAs.
- Do not execute arbitrary GitHub extensions.
- Native Roblox Parts remain the gameplay and collision layer.
- AI meshes are decorative until separately validated.
