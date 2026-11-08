# Release and operations

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

## Staging release

The protected develop workflow runs verification, builds the exact committed Git tree for Linux amd64, publishes its digest to private GHCR, and updates private staging after the verified backup. Use runtime secrets and keep the registry publish credential separate from the deployment reader. Confirm the pinned image, the expected private namespaces, and isolated database and R2 access before opening an authorized test window. Keep existing services, volumes, and limits attached.

Check the deployed revision and digest against the workflow receipt. Verify authentication and indexing guards, health, both localized editions, editor access, confirmed generation, and backup readiness. Retain the workflow run, tested marker, and rollback digest. [Release workflow](../../.github/workflows/checks.yml) · [Staging receipt](../verification/artifacts/E4-operations/stage4-staging-release-001.json)

## Before authorization

- **Project owner and editors** confirm final PT/EN content, contacts, alt text, metadata, and working résumés in place of the temporary blank PDFs. Resolve or explicitly disposition the remaining A4 gates, including the formal screen-reader review and dependency advisory refresh.
- **Infrastructure operator** confirms domain, DNS/TLS, private access, a separate production resource, private PostgreSQL and R2, storage and publication namespaces, runtime secrets, email, and capacity on the shared VPS. Validate a production backup executor and restore procedure. The [current executor](../../ops/backup/runtime-entry.ts) accepts staging only.
- **Release operator** verifies branch protection, the production environment, the tested marker, a recovery point, and the planned write window before enabling `PRODUCTION_AUTODEPLOY_ENABLED`. Record the exact revision, digest, origin, and operators with the authorization. [Build and promotion](lancamento.md#approved-staging-image)

## Authorized release

1. **Keep the target private.** Configure `APP_ENV=production` and the approved HTTPS `SITE_ORIGIN`. Require access control and `X-Robots-Tag: noindex, nofollow` at the proxy during validation. Keep `PUBLIC_SITE_ENABLED=false` and confirm anonymous access is denied.
2. **Verify the recovery point.** Record the previous compatible digest, catalog, volumes, and publication roots. Verify a complete encrypted backup of the database, publication data, and required media, including readback, sizes, SHA-256, source, and completion marker. Retain it for eight weeks and keep the age identity outside the VPS and bucket. [Backup and recovery](lancamento.md#backups-and-recovery)
3. **Compare migrations.** Check the target catalog and `APPROVED_MIGRATION_TREE`. If an authorized migration is required, suspend writers, run the exclusive migration job, and verify the catalog before resuming writes. Stop on catalog mismatch, backup failure, or an unapproved destructive change. [Migrations](lancamento.md#controlled-migrations)
4. **Promote by digest.** Apply the approved manifest to the authorized resource. Verify the registry marker, running digest, `appuser`, resource limits, volumes, cache, health, and runtime logs. Stop if the digest differs. [Health and logs](lancamento.md#publication-and-health)
5. **Check private access.** Verify TLS, `/health` returning 200 and `{"status":"ready"}`, server-rendered PT/EN, canonical and alternate URLs, public media and PDFs, editor login, and access denials for private media and drafts. Check email only in its authorized window with a consenting recipient. Run automated suites and fault injection in isolated local or staging environments. [Editorial access](lancamento.md#editorial-access-and-email) · [Email recovery](lancamento.md#editorial-access-and-email)
6. **Open when authorized.** Remove the temporary access and indexing restrictions, record the time and digest, and verify public HTTP, canonical and alternate URLs, sitemap, and robots at the final origin. Use targeted HEAD/GET checks and block Google requests during manual browser checks. Keep Analytics disabled with `loadScript=null`.

`BLOCK-GA4-REPORT-LIMITATION` remains open. Any later measurement needs a separate decision, SDK and privacy review, and evidence of which reports are available with `analytics_storage: denied`. Keep synthetic and editorial traffic out of Google measurement. [Analytics policy](../verification/evidence-index.md#analytics)

## Rollback and recovery

- **Image failure.** Restore private access. Record the time, target, observed digest, and safe correlation ID. If the previous image is compatible with the current catalog, redeploy its exact digest with the same volumes. Verify health, PT/EN, the admin, media, access, and the running digest. The [staging predecessor receipt](../verification/artifacts/E3-operations/stage3-final-staging-release-001.json) identifies the staging rollback image. Record a separate point for production. [Rollback](lancamento.md#rollback-and-recovery)
- **Data loss or corruption.** Suspend writes and preserve the original data, volumes, logs, and latest backup. Verify the selected complete backup before decrypting and restoring to an isolated copy database. The approved staging procedure uses the existing media read-only. Compare catalog, publication roots, media hashes, PT/EN routes, login, and recovery mail with isolated capture. A connection switch or write to the real target requires separate authorization. [Backup and recovery](lancamento.md#backups-and-recovery)

## Backups and recovery

For local Compose, keep the original volume attached and run `pnpm backup:local`. Keep the local age identity separate from the backup location.

The private staging job uses the same Alpine app image as the service. Set the private bucket credentials, `OPS_BACKUP_RECIPIENT`, and `OPS_BACKUP_SOURCE` on its executor. Confirm the resource, volume, database, and publication namespace. In Coolify, use the authorized `encrypted-full-backup` task or the app container as `appuser`.

```sh
node --conditions=react-server src/backup-runtime.mjs backup
```

The weekly schedule is Sunday at 03:00 in the server's configured time zone. Confirm a complete marker and readback before an update. The backup covers the PostgreSQL dump, confirmed publication data, and required media. Check the manifest, object sizes, SHA-256, and source. Retention is 56 days. Keep the private age identity outside the VPS, image, repository, and bucket.

For a recovery rehearsal, verify the ciphertext, decrypt in private quarantine, and restore to a new UUID-named database in the approved PostgreSQL instance. The A3 staging procedure reads existing R2 media only. Before mounting the recovered publication directory read-only, call `pinPublicRoot(directory, capturedRoot)` to prepare the render snapshot alongside `current.json`. Verify schema, public routes and media, editor login, and password recovery with captured email. Confirm ownership before disposing of the copy and quarantine. Any write to the real target needs explicit authorization. [Backup and recovery receipts](../verification/evidence-index.md#backup-and-recovery)

## Controlled migrations

Confirm the target database and reviewed migration tree. Pause all writers, keep PostgreSQL available, and verify the backup before applying a reviewed migration. The staging executor coordinates with backup through the same advisory lock. It accepts the reviewed additive migration `20261106_035830_cms_user_profile` from a catalog with 16 entries and reports `already-current` when all 17 are present.

```sh
OPS_ALLOW_REVIEWED_MIGRATION=true node --conditions=react-server src/backup-runtime.mjs migrate
```

Run the command only in the authorized operator process. Verify the complete backup marker and final catalog before resuming writers. Promotion and application startup leave the catalog alone. [Migration executor](../../ops/migrations/controlled.ts)

## Publication and health

Keep the publication root on its private persistent volume. Compare the served generation with the confirmed root when diagnosing stale content. Follow the durable receipt and retry state through the native editor interface. A pending update can leave the previous confirmed content available. Before retrying, confirm the intent, catalog, volume, origin, and correlation ID.

Check `/health`, the running digest, and protected operational logs together. Use a redacted correlation ID to connect events. Keep database connection details, private paths, credentials, and message bodies out of reports. [Release checks](../verification/evidence-index.md#stage-4-checks)

## Editorial access and email

Use individual editor accounts and the native Payload reset form. Local and test resets use private captured email. To inspect local captures, copy `portfolio:/app/.work/editorial-mail` with `docker compose -f compose.local.yaml cp` into a private `.work` directory. For staging or production, confirm the sender domain and configure `RESEND_API_KEY`, `EDITORIAL_EMAIL_FROM_ADDRESS`, and `EDITORIAL_EMAIL_FROM_NAME` as server secrets. Verify delivery in an authorized window with a consenting recipient. Keep tokens and reset URLs private. [Editing the portfolio](cms-editorial.md)
