# Security policy

Report vulnerabilities privately to the repository owner. Do not include credentials, exploit
artifacts, Roblox cookies, or sensitive project data in a public issue.

## Credential policy

Only placeholders belong in `.env.example`. Local `.env` files, cloud credentials, service-account
JSON, private keys, tokens, and generated model artifacts must not be committed. `npm run
security:secrets` is a required check, but contributors must still inspect diffs.

## Phase 0 trust boundary

Phase 0 accepts repository-controlled JSON fixtures and produces validated deterministic manifests
and native Roblox instances. It does not call cloud APIs or external workers.

Natural-language input, model output, generated assets, external repository content, and worker
responses will be untrusted when introduced. Future adapters must address prompt injection, command
and path injection, SSRF, resource exhaustion, artifact parsing, provenance, timeouts, and
credential isolation before they can enter the pipeline.

Modly, Blender, Vertex AI, Roblox Open Cloud, image generation, analytics, and external ML systems
are explicitly outside the supported Phase 0 boundary.
