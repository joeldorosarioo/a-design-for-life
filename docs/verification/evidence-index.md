# Verification evidence

The approval records and release receipts identify the reviewed revisions. Checks from those records belong to those revisions. A later code change needs a new candidate and validation through `develop → staging`.

[Corrective source - 14 November 2026](2026-11-14-audit-fixes.md) records the four audit fixes and their regression checks. The [candidate validation follow-up](2026-11-14-audit-validation.md) identifies the new healthy private staging image, current Linux and visual gates, fresh backup and performance work. The historical A4 approval remains tied to its recorded image.

## Approvals and progress

| Stage | Approval    | Execution and checklist                                             |
| ----- | ----------- | ------------------------------------------------------------------- |
| 1     | [A1](A1.md) | [Execution](execucao-etapa-1.md)                                    |
| 2     | [A2](A2.md) | [Execution](execucao-etapa-2.md) · [Progress](progresso-etapa-2.md) |
| 3     | [A3](A3.md) | [Execution](execucao-etapa-3.md) · [Progress](progresso-etapa-3.md) |
| 4     | [A4](A4.md) | [Execution](execucao-etapa-4.md) · [Progress](progresso-etapa-4.md) |

## Stage 4 checks

The corrective candidate `1640d972` passed 2,350 Linux tests without skips and 140 browser journeys. Its private deployment used a fresh verified encrypted backup, preserved volumes and publication data, and matched independent SSH/GHCR reads. [Current pipeline](artifacts/audit-fixes/validation-2026-11-14/pipeline-43618818421.json) · [Release binding](artifacts/audit-fixes/validation-2026-11-14/release-binding-43618818421.json) · [Current dossier](2026-11-14-audit-validation.md)

The earlier A4 candidate passed 2,335 tests, 123 browser journeys and 48 deployed browser checks. Those results remain historical and belong to that revision. [Historical local gates](artifacts/E4-gates/final-local-001.json) · [Historical staging release](artifacts/E4-operations/stage4-staging-release-001.json) · [Historical browser policy checks](artifacts/E4-operations/staging-device-policy-browser-001.json)

### Integrated journeys

The focused run passed 107 of 107 Chromium journeys with a disposable PostgreSQL instance and synthetic storage and email. It covered two independent editor sessions, anonymous access, publication, route history, withdrawal, localization, media, and recovery. The full local and CI runs passed 123 journeys. [Focused run, commands, and individual results](artifacts/E4-journeys/focused-e2e-001.json) · [Full local run](artifacts/E4-gates/final-local-001.json)

### Security

The staging audit checked authorization, private previews, upload boundaries, editorial recovery and rate limits, third-party requests, secrets, and dependency advisory applicability. Recheck current advisories before release. [Dependency audit](artifacts/E4-security/dependency-audit-001.json) · [Access and secret scan](artifacts/E4-security/staging-access-and-secret-scan-001.json)

### Visual accessibility and SEO

The corrective candidate passed 30 deployed layouts, 50 axe states, keyboard/focus, real 200% zoom, ten SSR pages and nine HTTP states. All 30 captures have identical pixels and media geometry to the actual predecessor. Eighteen exact-source original-content Figma views were separately reviewed with explicit projection limits. [Current visual receipt](artifacts/audit-fixes/validation-2026-11-14/visual-validation.json) · [Original-content frame review](artifacts/audit-fixes/validation-2026-11-14/figma-visual-review.json)

The earlier A4 candidate's browser/SSR comparisons remain available. The formal screen-reader review stays open. [Historical visual checks](artifacts/E4-quality/candidate-quality-003.json) · [Historical SSR/HTTP](artifacts/E4-quality/candidate-ssr-003.json) · [Historical zoom](artifacts/E4-quality/zoom-002.json)

### Performance

The first corrective candidate's fresh 36-measurement round passed 10/12 scenarios and failed LCP in the PT/EN mobile listings. All samples remain intact. A three-file image-priority correction passed 20 focused tests and local checks; new candidate validation is pending. Current resource measurements select payment flexibility as the heaviest case, unlike the older financing case. [Current protocol and status](2026-11-14-audit-validation.md#fresh-performance-validation) · [All 36 measurements](artifacts/audit-fixes/validation-2026-11-14/performance-candidate-001.json) · [RED/GREEN](artifacts/audit-fixes/validation-2026-11-14/listing-priority-verification.json)

The earlier A4 cold-browser run passed 12 of 12 scenarios across 36 measurements. Mobile PT financing-case median LCP fell from 2,803.06 ms to 1,867.62 ms after correcting responsive cover selection. These historical lab results belong to that image and route. [Pinned protocol](E4.2-performance-protocol.md) · [Historical measurements](artifacts/E4-performance/staging-cold-browser-002.json) · [Cover regression](artifacts/E4-performance/cover-red-green-001.json)

### Final editorial content

The ten localized staging routes were inspected. Both résumé links opened PDFs in new tabs. The two one-page PDFs are temporary and blank. Editors still need to approve the final PT/EN content, alt text, metadata, contact destinations, and replacement résumés. [Content checks](artifacts/E4-content/staging-content-readonly-001.json) · [Résumé browser check](artifacts/E4-content/staging-resume-popup-001.json)

### Release review and traceability

The original plan maps acceptance criteria to the test and release gates. The 8 November approval covers its recorded historical image. The corrective candidate has its own [validation dossier](2026-11-14-audit-validation.md) and awaits complementary A4 approval and explicit launch authorization. [Plan](../specs/2026-10-29-portfolio-plano-implementacao.md#9-rastreabilidade-e-matriz-de-aceite) · [Progress](progresso-etapa-4.md) · [A4](A4.md) · [Operations](../runbooks/lancamento.md)

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
