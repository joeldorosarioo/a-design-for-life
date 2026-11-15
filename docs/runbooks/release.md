# Release and operations

Launch requires explicit authorization for the candidate, target and window. The [current status](../current-status.md) records delivered work, evidence, accepted exceptions and pending conditions. This guide describes the operational procedure; no live account state was rechecked for this revision.

## Recorded staging reference

The [current status](../current-status.md#referência-operacional-registrada) holds the recorded image, migration tree, backup and compatible rollback. The target is Coolify Atlas → a-design-for-life → staging → app. Recheck and preserve mount identities, private storage/publication namespaces, image cache and log rotation before operating. Historical health and backup do not replace current checks.

## Staging release

The protected [workflow](../../.github/workflows/checks.yml) runs `pnpm verify:ci` without database access, builds one Linux amd64 image, publishes to private GHCR, requires a fresh verified encrypted backup, deploys by manifest and records its healthy digest in the staging marker. Candidate acceptance also requires integration, E2E and recovery evidence from the fixed local database, linked to the reviewed source and candidate. Application and operational changes need a new candidate through `develop → staging`. A later documentation-only production tree can reuse an explicitly approved candidate under the source checks below.

Automatic checks run on pull requests and pushes to `develop`/`main`; other branches use their PR or manual dispatch. Superseded PR checks are cancelled. Branch deployments remain serialized through the health check and marker. Compilation caches never skip checks. Buildx reuses intermediate layers from the same private GHCR package at `build-cache`, with visibility checked before registry access. This cache tag is not a release candidate or a tested marker. Candidate publication still follows image inspection and the restricted runtime smoke. A missing cache causes a normal build; cache export failure does not block the verified image.

Before enabling `STAGING_AUTODEPLOY_ENABLED`, confirm the authorized resource, database, private R2 buckets, persistent volumes, runtime flags and previous pinned digest. Separate registry publish/deployment credentials and backup/media credentials. The exact `APPROVED_MIGRATION_TREE` is required; deployment does not migrate.

Bind workflow receipt, registry marker and running image to the same digest. Check health, PT/EN, admin, media, confirmed publication root, anonymous denial, `noindex` and disabled Analytics. Retain release, backup and rollback receipts.

## Before authorization

- **Owner/editors:** approve final PT/EN copy, contacts, alt text, metadata and replacement résumé PDFs. Review the [pending conditions](../current-status.md#o-que-ainda-falta), including current dependency advisories. The formal reader review is an accepted exception; other accessibility checks remain required.
- **Infrastructure operator:** verify domain/DNS/TLS, separate production resource/database/buckets/namespaces, secrets, email, persistent volumes and shared-host capacity. Validate a production backup executor and rehearse recovery in the fixed local database. The embedded executor accepts staging only.
- **Release operator:** verify branch protection, production environment, source proof, backup and write window before enabling `PRODUCTION_AUTODEPLOY_ENABLED`. Record revision, manifest, origin, operators and launch authorization. Candidate acceptance and launch may be approved together only when both decisions are explicit.

## Production source proof

By default, production resolves the staging-tested marker for its entire Git tree. To reuse a candidate after documentation-only changes, set repository variables `APPROVED_STAGING_REVISION` and `APPROVED_IMAGE_DIGEST` to the explicitly approved commit and manifest. Both are required together.

The resolver compares the approved candidate to the production commit, admitting only `README.md`, `AGENTS.md` and `docs/**`, then checks the existing marker, image revision and manifest digest. Changes to application code, assets, dependencies, configuration, CI or operations require a new tested candidate. CI still runs for the current source; migration and predeploy backup guards remain in force. Setting these variables does not authorize launch or enable deployment.

An incomplete, stale or mismatched approval is refused without fallback. After testing a new application candidate, update both approval variables or clear both to return to the normal whole-tree resolution.

## Authorized release

1. Keep production private: approved HTTPS `SITE_ORIGIN`, `APP_ENV=production`, `PUBLIC_SITE_ENABLED=false`, proxy authentication and `X-Robots-Tag: noindex, nofollow`. Confirm anonymous denial.
2. Record previous compatible digest, catalog, volumes and publication root. Verify a fresh complete encrypted backup: source, manifest, ciphertext readback, sizes, hashes and completion marker.
3. Compare catalog and `APPROVED_MIGRATION_TREE`. Suspend writers for an authorized controlled migration. Stop on catalog mismatch, backup failure or an unapproved destructive change.
4. Promote the tested manifest without rebuilding. Verify digest, user, limits, volumes, cache, health and logs; stop on identity mismatch.
5. While private, check TLS, SSR PT/EN, canonical/alternates, media/PDFs, login and denial of drafts/private bytes. Email requires its authorized window. Automated suites and fault injection use isolated local/staging resources.
6. Open only in the authorized window. Record time/digest, remove temporary access/indexing guards and verify public HTTP, sitemap and robots. Use targeted HEAD/GET checks and block Google requests during manual browser checks.

Keep Analytics disabled with `loadScript=null`. Activation requires a separate decision, effective SDK/privacy review and available-report evidence under permanent `analytics_storage: denied`. Synthetic/editorial traffic never sends Google measurements.

## Rollback and recovery

Image failure: restore private access and record target/time/digest and safe correlation ID. Verify catalog compatibility, redeploy the previous exact manifest with unchanged volumes, then check digest, health, PT/EN, admin, media and access guards. Production needs its own rollback point.

Data loss: suspend writes; preserve original data, volumes, logs and backups. Verify/decrypt a complete set in private quarantine and rehearse recovery in the fixed local database under its exclusive lease. Checkpoint its current contents before replacing the schema. Compare catalog, publication roots, media hashes, PT/EN, login and captured reset mail, then restore the checkpoint. Restoring the production or staging database requires separate authorization.

## Backups and recovery

For a local backup, keep PostgreSQL running and stop development, tests and other database clients. On the first use, prepare the operational tools image and the host age tools.

```sh
docker build -f ops/backup/Dockerfile -t adfl:backup-local .
pnpm setup:backup-tools
pnpm backup:local
```

Repeat the image build when its dependency check requests it. `backup:local` holds the shared database lease and reads the host publication directory and configured local media, or source R2 media. It mounts host sources and data read-only, records the host source fingerprint and writes encrypted sets to `.work/backup-sets`. Preserve the original database volume and keep the age identity separate from the backup location.

Staging: use the authorized Coolify `encrypted-full-backup` task or app container as `appuser`. Confirm resource/database/volume/publication namespace; configure dedicated backup-bucket credentials, `OPS_BACKUP_RECIPIENT` and `OPS_BACKUP_SOURCE`.

```sh
node --conditions=react-server src/backup-runtime.mjs backup
```

The staging operator keeps `PUBLIC_SITE_ENABLED`, `PUBLICATION_RETRIES_ENABLED`, `PUBLICATION_RETRY_WORKER_ENABLED` and `PUBLICATION_HTTP_VERIFICATION_ENABLED` false, with schema drop disabled. [Job settings](../../ops/backup/job-settings.ts) enforce this boundary. The recorded schedule was Sunday 03:00 in the server time zone; recheck the actual task/time zone.

Backups cover a consistent PostgreSQL custom dump, confirmed root and required media. Verify source, manifest, every size/hash, complete marker and destination readback before updating. Retain complete sets for 56 days; incomplete sets do not authorize retention cleanup. Keep the private age identity outside the VPS, image, repository and bucket.

Rehearsal: use the fixed local database; creating disposable application databases is retired. Verify ciphertext, decrypt in private quarantine, checkpoint the local state and restore into its prepared schema with development stopped. Read source R2 media only; recovered files stay local. Before reading recovered publication data, call `pinPublicRoot(directory, capturedRoot)` to prepare the render snapshot beside `current.json`.

Check restored schema, routes, media, login and reset with captured email. Restore the checkpoint and verify the original local state before releasing the lease. This proves sequential recovery in the same database; it does not prove a simultaneous copy with the source online. Preserve database/container/volume identities and remove only acquired quarantine files.

## Controlled migrations

Confirm target/reviewed tree, suspend writers, keep PostgreSQL available and verify backup first. The executor shares backup's advisory lock. Only reviewed additive migration `20261106_035830_cms_user_profile` is accepted from the exact 16-entry predecessor; all 17 reviewed entries yield `already-current`.

```sh
OPS_ALLOW_REVIEWED_MIGRATION=true node --conditions=react-server src/backup-runtime.mjs migrate
```

Run only in the authorized operator process. Recheck complete backup marker and final catalog before resuming writers. Startup/promotion do not migrate; image rollback does not reverse data. See [migration guard](../../ops/migrations/controlled.ts) and [staging-only executor](../../ops/backup/runtime-entry.ts).

## Publication and health

Persist the private publication volume. For stale content, compare served generation with confirmed root; pending updates may retain the last confirmed edition. Use native durable receipt/retry state, checking intent, catalog, volume, origin and correlation ID before retry.

Check `/health` for HTTP 200 and `{"status":"ready"}`, running digest and protected logs together. Use redacted correlation IDs; exclude database URLs, private paths, credentials and message bodies from reports. Preserve log rotation; assess readiness alongside cached-page availability.

## Editorial access and email

Use individual accounts and native Payload reset. Local/test resets use private capture in the host's `.work/editorial-mail`. Keep reset URLs and captured messages private.

For staging/production, verify sender domain and server secrets `RESEND_API_KEY`, `EDITORIAL_EMAIL_FROM_ADDRESS`, `EDITORIAL_EMAIL_FROM_NAME`. Test delivery only with an authorized consenting recipient. Keep tokens/reset URLs private. See [CMS editing](cms-editorial.md).
