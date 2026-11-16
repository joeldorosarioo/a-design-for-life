# Repository conventions

- Work on `develop` unless the user explicitly requests another branch.
- Write branch names and commit subjects in English. Use Conventional Commits.
- Make cohesive commits for one complete, reviewable change, including its related tests, contracts, migrations and evidence. Prefer coherence over an arbitrary file or line count; avoid artificial fragmentation. Keep generated lockfiles and migrations intact.
- Use English filenames. Keep exactly four files in `documentation`: `specification.md`, `architecture.md`, `operations.md` and `pending.md`. Update them in place; use Git for history and `.work/verification/evidence` for private receipts.
- Before implementation, read the relevant contracts in `documentation/specification.md` and open conditions in `documentation/pending.md`. Consult `documentation/architecture.md` for module boundaries and `documentation/operations.md` for editorial, deployment, recovery or performance procedures. Follow the latest explicit user authorization for scope and release approvals.

- Before reporting progress, review the evidence and affected entries in `documentation/pending.md`. Close an item only when its full condition has evidence, then remove completed tasks from the list. Keep accepted exceptions and conditional actions distinct. Record source/image and check scope in the evidence; avoid parallel progress logs or stage percentages.
