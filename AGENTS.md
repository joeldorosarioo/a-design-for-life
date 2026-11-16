# Agent instructions

## Load the relevant context

- [README.md](README.md): setup, local commands, verification and documentation index.
- [specification.md](documentation/specification.md): product behavior, content, accessibility and Analytics contracts.
- [architecture.md](documentation/architecture.md): module boundaries, publication flow and runtime identity.
- [operations.md](documentation/operations.md): editorial operations, deployment, backup, recovery and performance.
- [pending.md](documentation/pending.md): unmet launch conditions and accepted exceptions.

## Work and commits

- Work on `develop` unless the user requests another branch.
- Use English names for files, folders and branches. Write English commit subjects with Conventional Commits.
- Make cohesive commits, including affected consumers, tests and migrations. Generate lockfiles and migrations through project commands.
- Keep exactly four files in `documentation`: `specification.md`, `architecture.md`, `operations.md` and `pending.md`. Update them in place; use Git for history and `.work/verification/evidence` for private receipts.
- Before reporting progress, review the evidence and affected conditions in [pending.md](documentation/pending.md). Follow the user's latest scope and release authorization.

## Verification

Use `pnpm verify:ci` for types, lint, formatting, units, architecture, scripts and build. Run `pnpm test:integration` for affected server/database flows and `pnpm test:e2e` for affected browser journeys. Prepare the local environment as described in the [README](README.md#verificação).
