# Agent instructions

## Load the relevant context

- [README.md](README.md): setup, local commands, verification and documentation index.
- [SPECIFICATION.md](documentation/SPECIFICATION.md): product behavior, content, accessibility and Analytics contracts.
- [ARCHITECTURE.md](documentation/ARCHITECTURE.md): module boundaries, publication flow and runtime identity.
- [OPERATIONS.md](documentation/OPERATIONS.md): editorial operations, deployment, backup, recovery and performance.
- [PENDING.md](documentation/PENDING.md): unmet launch conditions and accepted exceptions.

## Work and commits

- Work on `develop` unless the user requests another branch.
- Use English names for files, folders and branches. Write English commit subjects with Conventional Commits.
- Make cohesive commits, including affected consumers, tests and migrations. Generate lockfiles and migrations through project commands.
- Keep exactly four files in `documentation`, with uppercase English names: `SPECIFICATION.md`, `ARCHITECTURE.md`, `OPERATIONS.md` and `PENDING.md`. Update them in place; use Git for history and `.work/verification/evidence` for private receipts.
- Before reporting progress, review the evidence and affected conditions in [PENDING.md](documentation/PENDING.md). Follow the user's latest scope and release authorization.

## Verification

Use `pnpm verify:ci` for types, lint, formatting, units, architecture, scripts and build. Run `pnpm test:integration` for affected server/database flows and `pnpm test:e2e` for affected browser journeys. Prepare the local environment as described in the [README](README.md#verificação).
