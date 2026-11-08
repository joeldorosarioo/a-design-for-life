# Launch

A4 was approved on 8 November 2026. Launch is deferred and requires explicit authorization for the release, target, and window. The [A4 record](../verification/A4.md) tracks the outstanding gates.

## Approved staging image

| Identity       | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Revision       | `befe22bc711d88f43f134983d151d0f87f6c7af2`                                                                         |
| Image          | `ghcr.io/joeldorosarioo/a-design-for-life@sha256:557ba0fbcdc8bd8bb2e225d84846c90271bdf7d0489e180796ee2d7a7f18d5aa` |
| Config digest  | `sha256:6091f5c0b43994ee062ee55290fcc0255fe21cfcab3f88c52c97cc8246aa37bc`                                          |
| Git tree       | `e96ee4338b8640d6c5208e36be1240885e9f248f`                                                                         |
| Migration tree | `863d5c13d017c3435b43a2e4e9cc36d68b06f89a`                                                                         |
| Staging        | Coolify Atlas → a-design-for-life → staging → app                                                                  |

The [staging receipt](../verification/artifacts/E4-operations/stage4-staging-release-001.json) records the Alpine image, `appuser` (UID/GID 70), 1 CPU, 2 GiB, and runtime state. The [promotion workflow](../../.github/workflows/checks.yml) looks up the tested marker by the entire Git tree. Use the approved tree and exact digest without rebuilding. A later application change requires a new candidate and validation through `develop → staging`.

## Before authorization

- **Project owner and editors** confirm final PT/EN content, contacts, alt text, metadata, and working résumés in place of the temporary blank PDFs. Resolve or explicitly disposition the remaining A4 gates, including the formal screen-reader review and dependency advisory refresh.
- **Infrastructure operator** confirms domain, DNS/TLS, private access, a separate production resource, private PostgreSQL and R2, storage and publication namespaces, runtime secrets, email, and capacity on the shared VPS. Validate a production backup executor and restore procedure. The [current executor](../../ops/backup/runtime-entry.ts) accepts staging only.
- **Release operator** verifies branch protection, the production environment, the tested marker, a recovery point, and the planned write window before enabling `PRODUCTION_AUTODEPLOY_ENABLED`. Record the exact revision, digest, origin, and operators with the authorization. [Build and promotion](build-e-promocao.md)

## Authorized release

1. **Keep the target private.** Configure `APP_ENV=production` and the approved HTTPS `SITE_ORIGIN`. Require access control and `X-Robots-Tag: noindex, nofollow` at the proxy during validation. Keep `PUBLIC_SITE_ENABLED=false` and confirm anonymous access is denied.
2. **Verify the recovery point.** Record the previous compatible digest, catalog, volumes, and publication roots. Verify a complete encrypted backup of the database, publication data, and required media, including readback, sizes, SHA-256, source, and completion marker. Retain it for eight weeks and keep the age identity outside the VPS and bucket. [Backup and recovery](backup-e-restauracao.md)
3. **Compare migrations.** Check the target catalog and `APPROVED_MIGRATION_TREE`. If an authorized migration is required, suspend writers, run the exclusive migration job, and verify the catalog before resuming writes. Stop on catalog mismatch, backup failure, or an unapproved destructive change. [Migrations](migracoes.md)
4. **Promote by digest.** Apply the approved manifest to the authorized resource. Verify the registry marker, running digest, `appuser`, resource limits, volumes, cache, health, and runtime logs. Stop if the digest differs. [Health and logs](saude-e-logs.md)
5. **Check private access.** Verify TLS, `/health` returning 200 and `{"status":"ready"}`, server-rendered PT/EN, canonical and alternate URLs, public media and PDFs, editor login, and access denials for private media and drafts. Check email only in its authorized window with a consenting recipient. Run automated suites and fault injection in isolated local or staging environments. [Editorial access](acesso-editorial.md) · [Email recovery](recuperacao-de-acesso.md)
6. **Open when authorized.** Remove the temporary access and indexing restrictions, record the time and digest, and verify public HTTP, canonical and alternate URLs, sitemap, and robots at the final origin. Use targeted HEAD/GET checks and block Google requests during manual browser checks. Keep Analytics disabled with `loadScript=null`.

`BLOCK-GA4-REPORT-LIMITATION` remains open. Any later measurement needs a separate decision, SDK and privacy review, and evidence of which reports are available with `analytics_storage: denied`. Keep synthetic and editorial traffic out of Google measurement. [Analytics policy](../verification/analytics.md)

## Rollback and recovery

- **Image failure.** Restore private access. Record the time, target, observed digest, and safe correlation ID. If the previous image is compatible with the current catalog, redeploy its exact digest with the same volumes. Verify health, PT/EN, the admin, media, access, and the running digest. The [staging predecessor receipt](../verification/artifacts/E3-operations/stage3-final-staging-release-001.json) identifies the staging rollback image. Record a separate point for production. [Rollback](rollback.md)
- **Data loss or corruption.** Suspend writes and preserve the original data, volumes, logs, and latest backup. Verify the selected complete backup before decrypting and restoring to an isolated copy database. The approved staging procedure uses the existing media read-only. Compare catalog, publication roots, media hashes, PT/EN routes, login, and recovery mail with isolated capture. A connection switch or write to the real target requires separate authorization. [Backup and recovery](backup-e-restauracao.md)
