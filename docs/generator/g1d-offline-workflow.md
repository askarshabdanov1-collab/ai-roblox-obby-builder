# G1d offline workflow and final G1 acceptance

## Supported command

G1d adds one offline command to the existing generator CLI:

```text
npm run generator -- layout --bundle examples/g1-workflow/reference/generation-bundle.json --output build/g1d-output
```

The input is a validated G0 `GenerationBundle`. When authority flags are omitted, the command uses
the exact versioned defaults exported by `@obby/obby-generator` and `@obby/obby-layout-engine`.
Audited callers may supply all four authorities explicitly with `--generator-config`, `--catalog`,
`--layout-config`, and `--layout-definitions`. Every path must be a normalized relative regular-file
path below the working directory. The output root is also relative and may not overlap an input.

This command does not accept natural-language input, access a network, select assets, construct a
Roblox scene, or activate SceneManifest 0.3 in the runtime. The existing `generate` command and the
entire 0.2 path remain unchanged.

## Pipeline and artifact contract

`buildG1ArtifactSet` is the pure in-memory boundary:

```text
validated GenerationBundle + exact G0/G1 authorities
  -> generateLayout
  -> validated LayoutBundle 0.1
  -> projectLayoutBundle
  -> validated PlaceSpec 0.3
  -> compilePlaceSpecV03
  -> validated SceneManifest 0.3
  -> emitManifestModuleV03
  -> complete in-memory artifact set
  -> atomic absent-or-complete publication
```

Every JSON artifact is canonical UTF-8 JSON followed by one LF. The Luau artifact is the exact
deterministic validation transport returned by the 0.3 emitter. The public directory contains only:

```text
layout-bundle.json
place-spec-v0.3.json
scene-manifest-v0.3.json
scene-manifest-v0.3.luau
```

The workflow re-parses and semantically validates the exact three JSON byte sequences before the
first filesystem mutation. Layout work admission, recipe support, reference closure, packing,
reachability, and byte limits therefore fail before publication.

## Content address and deterministic equivalence

The public directory is `g1-<64 lowercase hex characters>`. Its hash is SHA-256 over canonical JSON
with this exact preimage:

```json
{
  "identityDomain": "G1ArtifactSetPublicationPreimage",
  "workflowVersion": "g1d-offline-v1",
  "artifacts": [{ "filename": "...", "contentHash": "sha256:..." }]
}
```

Artifact entries are ordered by Unicode scalar value of `filename`; `contentHash` is SHA-256 of the
exact published bytes. The result hash is absent from its own preimage. Timestamps, output paths,
process IDs, staging names, host/platform data, execution/session identity, and filesystem metadata
are excluded. Two executions are equivalent when all four named byte sequences are equal. Equal
inputs and exact authorities therefore produce equal artifact bytes, hash, and directory name. A
seed change changes the G0 identity and deterministically propagates to the downstream identities;
the fixture catalog records the expected changed address.

## Atomic publication and security guarantees

The CLI reuses the G0 private publication boundary. It creates a mode-0700 staging directory, writes
mode-0600 files with exclusive creation, synchronizes every file and the staging directory, rechecks
every output-ancestor identity, claims a private lock, and commits the complete directory with the
audited platform-specific no-replace primitive. Linux uses the committed
`renameat2(RENAME_NOREPLACE)` helper; Windows uses the committed `MoveFileExW` helper. Both helpers
receive argument arrays with shell execution disabled. No helper is downloaded at runtime and
ordinary rename is never a fallback.

An existing file or directory returns `output-conflict`; a symlink, junction, or reparse point
returns `path-safety`. The foreign object is not opened, removed, replaced, or modified. Concurrent
identical publishers yield exactly one complete success and one typed conflict. Unsupported atomic
publication returns `output-publication`. A cleanup failure returns `cleanup-failed`. JSON error
mode returns only a stable code and sanitized message, never a stack, local path, input content, or
helper stderr. Normal success and ordinary failure cleanup leave no staging or lock debris.

An identical rerun against the same output root intentionally returns `output-conflict`; it never
silently treats an existing directory as success. To compare reruns, publish to two distinct empty
output roots and compare the equal directory names and bytes.

## Fixtures, mechanics, and reachability limitations

`examples/g1-workflow/positive-fixtures.json` records the minimum 5-stage zero-checkpoint case, a
representative multi-stage case, 20/21/50-stage boundaries, and a controlled different-seed case.
The reference directory commits the representative source and complete output bytes.
`negative-fixtures.json` records the typed expectation and owning executable test for stale G0/G1
authorities, unsupported/deferred mechanics, invalid references, work/output/packing exhaustion,
infeasible/indeterminate reachability, every destination identity class, concurrency, unsupported
publication primitives, and cleanup failure.

G1 supports only mechanics whose catalog capability is `g1-static-supported` and whose exact
versioned native-Part recipe authority is supplied. Dynamic or deferred mechanics fail closed.
Reachability is a deterministic conservative model result (`feasible-under-model`), not exact proof
of Roblox physics. An infeasible or indeterminate required transition blocks publication.

## Validation and compatibility

Focused commands are:

```text
npm run layout:workflow:fixtures:check
npm run layout:workflow:test
npm run layout:workflow:check
npm run build:smoke
npm run validate
```

The built-package smoke imports the compiled workflow through plain Node and invokes the compiled
CLI binary through plain Node. CI runs the same publication tests on Ubuntu and Windows. The 0.2
schemas, compiler, emitter, fixtures, and Roblox runtime remain intact. The 0.3 artifacts are
offline review/validation products only: Roblox runtime construction and scene replacement for 0.3
remain intentionally unimplemented.

## Rollback and G2 boundary

Rollback removes or disables the `layout` command, `buildG1ArtifactSet`, and G1d fixture gates. It
does not require a schema migration, geometry rollback, projector/compiler change, or runtime
change. The existing G0 `generate` command, pure G1b engine, pure G1c projection, and 0.2 runtime
remain available.

G2 may propose runtime construction or broader product workflows only through a separate ADR,
tests, branch, and reviewed pull request. G1d adds no dynamic mechanics, external assets, meshes,
Vertex AI, Modly, Blender, Roblox Open Cloud, analytics, Studio automation, or network access.
