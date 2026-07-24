# Deterministic compilation

The deterministic input tuple is the complete validated PlaceSpec, its embedded integer seed, and
generator version `0.2.0`.

Objects use input-defined stable IDs and explicit integer order. The compiler sorts obstacles by
that order, normalizes computed bounds to six decimal places, and emits canonical JSON with
lexicographically sorted object keys while preserving array order.

`sourceSpecHash` is SHA-256 over the canonical PlaceSpec. `manifestHash` is SHA-256 over the
canonical SceneManifest after replacing `manifestHash` with the documented all-zero placeholder.
This avoids an impossible self-referential digest while protecting every other field.

`npm run fixtures:check` recreates contract types, the example SceneManifest, and the Roblox Luau
module in memory and compares them byte-for-byte with committed files.
