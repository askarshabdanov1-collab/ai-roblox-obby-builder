# ADR 0001: Deterministic-first generation

## Status

Accepted.

## Context

AI-generated content is probabilistic, difficult to debug, and potentially untrusted. Roblox
gameplay also needs stable collision, predictable respawning, and reproducible review artifacts.

## Decision

The first supported product boundary builds gameplay entirely from native Roblox Parts using a
validated SceneManifest. A PlaceSpec, seed, and generator version must produce byte-identical
canonical output and stable hashes.

The SceneManifest separates gameplay and decorative layers. Decorative objects cannot own gameplay
collision in contract version `0.2`. Runtime validation completes before generated scene cleanup,
and only explicitly owned content may be replaced.

AI-generated 3D assets can be considered only after contracts, reproducible builds, route
validation, rollback, and fixed-camera evaluation are independently established.

## Consequences

- Generation and runtime errors are replayable from committed inputs.
- Contract changes are explicit and versioned.
- Visual variety is deliberately limited during Phase 0.
- Future asset workers remain replaceable and outside the trusted gameplay layer.
