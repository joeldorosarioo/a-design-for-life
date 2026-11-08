# Repository conventions

- Work on `develop` unless the user explicitly requests another branch.
- Write branch names and commit subjects in English. Use Conventional Commits.
- Make cohesive commits for one complete, reviewable change, including its related tests, contracts, migrations and evidence. Prefer coherence over an arbitrary file or line count; avoid artificial fragmentation. Keep generated lockfiles and migrations intact.
- Before implementation, read the approved references in `docs/specs/` and the current progress/gates in `docs/verification/execucao-etapa-1.md`. Follow the latest explicit user authorization for scope and stage approvals.

- Before every progress update, review new evidence, revise affected checklist states, and run scripts/recalculate-stage-progress.mjs to recalculate the percentage, completed/total items and wholly closed tasks; report those fresh values. For stage 2, use docs/verification/progresso-etapa-2.md (the original thirty checklist items, five per task). Report wholly closed tasks separately. Count a checklist item only when its full criterion has evidence; keep visual acceptance and final gates open until verified.
