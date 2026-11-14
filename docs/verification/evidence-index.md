# Verification evidence

The approval records and release receipts identify the reviewed revisions. Checks from those records belong to those revisions. A later code change needs a new candidate and validation through `develop → staging`.

[Corrective source ? 14 November 2026](2026-11-14-audit-fixes.md) records the four audit fixes and their regression checks. The updated source requires fresh candidate validation; the historical A4 approval remains tied to its recorded image.

## Approvals and progress

| Stage | Approval    | Execution and checklist                                             |
| ----- | ----------- | ------------------------------------------------------------------- |
| 1     | [A1](A1.md) | [Execution](execucao-etapa-1.md)                                    |
| 2     | [A2](A2.md) | [Execution](execucao-etapa-2.md) · [Progress](progresso-etapa-2.md) |
| 3     | [A3](A3.md) | [Execution](execucao-etapa-3.md) · [Progress](progresso-etapa-3.md) |
| 4     | [A4](A4.md) | [Execution](execucao-etapa-4.md) · [Progress](progresso-etapa-4.md) |

## Stage 4 checks

The staged candidate passed CI with 2,335 tests, 123 browser journeys, and 48 deployed browser checks. The receipts tie each result to its revision and environment. [Local gates](artifacts/E4-gates/final-local-001.json) · [Staging release](artifacts/E4-operations/stage4-staging-release-001.json) · [Browser policy checks](artifacts/E4-operations/staging-device-policy-browser-001.json)

### Integrated journeys

The focused run passed 107 of 107 Chromium journeys with a disposable PostgreSQL instance and synthetic storage and email. It covered two independent editor sessions, anonymous access, publication, route history, withdrawal, localization, media, and recovery. The full local and CI runs passed 123 journeys. [Focused run, commands, and individual results](artifacts/E4-journeys/focused-e2e-001.json) · [Full local run](artifacts/E4-gates/final-local-001.json)

### Security

The staging audit checked authorization, private previews, upload boundaries, editorial recovery and rate limits, third-party requests, secrets, and dependency advisory applicability. Recheck current advisories before release. [Dependency audit](artifacts/E4-security/dependency-audit-001.json) · [Access and secret scan](artifacts/E4-security/staging-access-and-secret-scan-001.json)

### Visual accessibility and SEO

The final candidate passed browser and SSR comparisons against the staging baseline, including case cover geometry, layouts, SEO metadata, zoom, keyboard, focus, and HTTP error states. The formal screen-reader review remains open. [Candidate visual and accessibility checks](artifacts/E4-quality/candidate-quality-003.json) · [SSR and HTTP](artifacts/E4-quality/candidate-ssr-003.json) · [Zoom](artifacts/E4-quality/zoom-002.json)

### Performance

The final cold-browser run passed 12 of 12 scenarios across 36 measurements. Mobile PT case median LCP fell from 2,803.06 ms to 1,867.62 ms after correcting responsive cover selection. These are lab results for the candidate. [Pinned protocol](E4.2-performance-protocol.md) · [Final measurements](artifacts/E4-performance/staging-cold-browser-002.json) · [Cover regression](artifacts/E4-performance/cover-red-green-001.json)

### Final editorial content

The ten localized staging routes were inspected. Both résumé links opened PDFs in new tabs. The two one-page PDFs are temporary and blank. Editors still need to approve the final PT/EN content, alt text, metadata, contact destinations, and replacement résumés. [Content checks](artifacts/E4-content/staging-content-readonly-001.json) · [Résumé browser check](artifacts/E4-content/staging-resume-popup-001.json)

### Release review and traceability

The original plan maps acceptance criteria to the test and release gates. The recorded staging candidate is the only image covered by A4. [Plan](../specs/2026-10-29-portfolio-plano-implementacao.md#9-rastreabilidade-e-matriz-de-aceite) · [Progress](progresso-etapa-4.md) · [A4](A4.md) · [Operations](../runbooks/lancamento.md)

## Backup and recovery

Staging rehearsals used the approved PostgreSQL server and a new isolated database. The restore read existing R2 objects, checked data and media, and exercised login and password recovery with captured email. [Backup before deploy](artifacts/E3-backup/staging-predeploy-backup-001.json) · [Retention](artifacts/E3-backup/staging-retention-operation-001.json) · [Recovery copy](artifacts/E3-backup/staging-recovery-copy-001.json)

## Analytics

Analytics is disabled with `loadScript=null`. `BLOCK-GA4-REPORT-LIMITATION` remains open. Any later activation requires a separate decision and SDK and privacy review. Preserve `analytics_storage: denied` and keep synthetic and editorial traffic out of Google measurement. The A3 record documents the test setup and reporting limits. [A3](A3.md) · [Staging browser policy](artifacts/E4-operations/staging-device-policy-browser-001.json)

## Archived records

The complete Markdown originals, including unchanged approval dossiers and intermediate notes, are in commit `bee7667e911fc6ec117087ad981475b322f27ae2`. Older source paths cited in execution ledgers and generated progress refer to this snapshot. Links to this section show the original Git object in their link title. Use `git show` to read any original by its path.

```sh
git show bee7667e911fc6ec117087ad981475b322f27ae2:docs/verification/A4.md
git show bee7667e911fc6ec117087ad981475b322f27ae2:docs/verification/rastreabilidade-etapa-4.md
git ls-tree -r --name-only bee7667e911fc6ec117087ad981475b322f27ae2 docs/verification
```

| Originals                                        | Location in the snapshot                   |
| ------------------------------------------------ | ------------------------------------------ |
| Editorial rules, contracts, and design decisions | `docs/architecture/` and `docs/decisions/` |
| Local, editorial, and operational procedures     | `docs/runbooks/`                           |
| Stage checks, reviews, and intermediate notes    | `docs/verification/`                       |
| Markdown attachments                             | `docs/verification/artifacts/`             |

The JSON receipts, screenshots, and other non-Markdown artifacts remain in their existing paths. The approval records preserve their decision text and point to the corresponding sections of the consolidated guides.
