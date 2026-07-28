# `@obby/obby-generator`

Pure Phase G0 normalization and reference planning. Given a structured request, validated
configuration, and mechanic catalog, it returns a validated deterministic `GenerationBundle`.
It performs no filesystem or network IO and produces no physical geometry.

Public runtime inputs cross a descriptor-inspected plain-data boundary: Proxies, accessors,
inherited semantic fields, custom prototypes/arrays, symbols, cycles, and coercion hooks are
rejected without invocation. The complete graph is copied into one deeply frozen snapshot before
work admission or callbacks, and every semantic phase consumes only that snapshot. Callback
exceptions are sanitized as `callback-failed`. Work budget is execution metadata and does not
affect semantic configuration, bundle, hash, byte, seed, or output-name identity.

See [`docs/generator/g0-architecture.md`](../../docs/generator/g0-architecture.md).
