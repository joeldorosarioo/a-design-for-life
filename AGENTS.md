# Repository conventions

- Work on `develop` unless the user explicitly requests another branch.
- Write branch names and commit subjects in English. Use Conventional Commits.
- Make cohesive commits for one complete, reviewable change, including its related tests, contracts, migrations and evidence. Prefer coherence over an arbitrary file or line count; avoid artificial fragmentation. Keep generated lockfiles and migrations intact.
- Use English filenames. Before implementation, read the relevant approved references in `docs/specs/` and the current decisions and pending work in `docs/current-status.md`. Follow the latest explicit user authorization for scope and release approvals.

- Before reporting progress, review the evidence and update affected entries in `docs/current-status.md`. Distinguish completed work, pending validation, accepted exceptions and conditional actions. Record the source/image and scope of checks; close a pending entry only when its completion condition has evidence. Stage percentages and automatic stage recalculation were retired by the user on 2026-11-15.
