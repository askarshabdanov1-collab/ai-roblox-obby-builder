# Contributing

All changes use branches and pull requests. Direct changes to `main` are not part of the development
workflow.

## Local setup

1. Install Node `20.20.2` and npm `10.8.2`.
2. Install Rokit `1.2.0`.
3. Run `rokit trust rojo-rbx/rojo JohnnyMorganz/StyLua Kampfkarren/selene lune-org/lune` after
   reviewing the pinned repositories.
4. Run `npm run toolchain:install`.
5. Run `npm ci`.

Create a focused branch such as `chore/phase-0-foundation`. Keep commits small enough to review and
include tests with behavioral changes.

## Required checks

Run:

```text
npm ci
npm run validate
git diff --check
git status --short
```

Generated files must be regenerated through repository commands and reviewed like source. A pull
request must explain contract changes, determinism impact, generated diffs, and security-boundary
changes.
