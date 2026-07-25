# Architecture

The repository is an npm workspace with four library/application boundaries:

- `packages/contracts`: authoritative schemas, generated static types, and semantic validation;
- `packages/canonical-json`: deterministic serialization, number normalization, and hashing;
- `packages/obby-compiler`: pure PlaceSpec-to-SceneManifest compilation;
- `packages/roblox-emitter`: deterministic Luau transport generation;
- `apps/orchestrator`: loopback-only process health boundary reserved for later orchestration.

Roblox contains a server-only generated manifest, a runtime validator, a build plan, an instance
builder, and a minimal bootstrap. The builder validates before staging or cleanup. It refuses to
replace an unowned `Workspace.GeneratedObby`.

External AI and asset systems are not architecture participants in Phase 0.
