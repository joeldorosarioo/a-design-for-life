# Native persisted publication retries — preparation / waiting for lease

2026-11-03. Only new `src/helpers/payload/publication-retries.ts` and adjacent `.integration.test.ts` were added. The helper is explicitly an importable fail-closed RED scaffold; it does not implement or wire Native execution-metadata writes. Shared collection/enqueue/coordinator/types/schema/config/migrations remain unchanged. No integration test, DB/PG/Docker operation, migrate CLI, Next/service or full gate was run. Root currently owns allocation of55434 after the image HTTP gate.

Scoped static preparation: focused TypeScript exit0; Prettier write exit0; ESLint exit0 with11 expected unused-argument warnings in the deliberately unimplemented scaffold, zero errors. Logs: `publication-retries-preparation-typecheck.txt` and `publication-retries-preparation-lint.txt` in this Cwork directory. No Native behavior is yet claimed passing.

## Chosen migration-safe shape

Follow root's smaller separate Native execution-metadata collection proposal. New hidden `publication-retries` collection, keyed uniquely by operationId, stores only:

```ts
{
  id: string;
  operationId: string;
  retryUserId: string | null;
  startedAttemptsVersion: number;
  automaticAttempts: number;
  nextAttemptAt: string | null;
}
```

It stores no publication target, revision, public/pending/superseded state or grant. Those remain exclusively in `publication-updates` plus the confirmed root/coordinator. The reviewed pure policy is projected with `attempts = startedAttemptsVersion`, state from the independently read authoritative outbox, and automatic counter/due from execution metadata. Existing coordinator attempts remains its legacy metric; this slice neither increments it on claim nor removes its existing coordinator increments. No double-count or complete legacy-audit claim is made.

When outbox is terminal, any still-present execution due time is only stale scheduling metadata: normalize it for the pure policy and clear it conditionally without inventing another visibility state. Pending outcomes preserve the pre-armed schedule. `recordPublicationRetryOutcome` must independently match operation, targetRevision and actual outbox state to the supplied coordinator receipt; it never sets outbox public. Stale/future version tokens cannot overwrite a newer metadata row.

## Historical migration trap — actual source evidence

Only historical `20261030_124550_publication_coordination.ts` invokes current feature code: after creating the original outbox table, it calls current `captureLegacyPublications(req)`, which uses current adapters and `enqueuePublicationUpdate`. The capture's explicit legacy selects protect future editorial reads; enqueue's head `select:{id:true}` protects future RETURNING fields.

They do not protect INSERT column lists. Installed Drizzle pg dialect `buildInsertQuery` enumerates every current table column and emits DEFAULT for omitted values. Adding retry columns to the existing outbox model would therefore reference absent future columns during old Native capture, even if new data/defaults were suppressed and RETURNING selected id. This is why an additive-last-column migration alone is unsafe.

The separate new Native collection avoids that: the existing outbox schema/INSERT shape stays unchanged. New ordinary enqueue can create outbox+execution metadata using the same req/transaction after the new migration exists. Existing server-owned `legacy-bootstrap` dependencies provide an explicit historical call-path discriminator: skip **all** new-table access, not merely actor/due assignment, for those captures. Root may prefer an internal explicit no-auto option instead; either stays in current helper/capture code, with no edits to published old migration files. Do not inspect the new table to decide whether to skip it during historical replay.

## Additive migration / legacy policy

After genuine Native RED and root approval:

1. Register the new hidden technical collection, generate types and generate one additive native migration/snapshot for its new table/indexes (plus native locked-document relation metadata if generated). Avoid adding fields to the old outbox table.
2. Actor is nullable text UUID; no new editorial account or account-deletion policy. Native relationship on the new table is possible but not needed for minimum execution metadata.
3. Backfill only pending legacy outbox operations through Native Payload adapter calls **after** the new table DDL has run in the additive migration transaction. Explicit old outbox projections use existing fields. Initialize actor=NULL, due=NULL, started version0 and automaticAttempts0. No first-admin lookup. An absent metadata row is equivalently manual-only, if root prefers no backfill.
4. Ordinary future enqueue writes real req.user.id and first due in its existing editorial transaction. Historical capture explicitly performs no schedule write. Authenticated manual recovery may create/rebind only this execution metadata for the same existing committed operation.
5. Prove fresh migration replay and genuine pre-coordination upgrade/capture with later new-table absence, using the existing Native historical-capture tests. Do not call custom schema-DDL helpers during ordinary content operations, clone an ORM schema or add raw business SQL.

## Public helper scaffold interfaces

```ts
schedulePublicationRetry(operationId, req, clock): Promise<PersistedPublicationRetry | null>
readPublicationRetry(operationId, req): Promise<PersistedPublicationRetry | null>
claimPublicationRetry(operationId, {mode:'immediate'|'automatic'|'manual'}, req, clock)
  // claimed {attempt:{operationId,version}, retry}
  // | reconcile-stale {operationId} | skip {reason}
recordPublicationRetryOutcome({attempt, receipt}, req)
  // recorded {retry} | skip {reason}
```

Scheduling preserves an externally owned editorial transaction; reading supports that same req to demonstrate intra-TX state. Claim/outcome must independently read committed state and persist the started version outside a promotion transaction, using actual Native CAS on metadata row id/operation/version. No caller-supplied transaction may make a claim merely provisional. Automatic execution requires the recorded real actor; NULL never selects the first admin. Manual requests remain real native users and subject-access checked, and may reset/rebind metadata for the same immutable operation.

The scheduler never compares a private draft editorialRevision with the approved intent. It compares native latestPublicationIntent. A different/missing intent yields existing coordinator stale reconciliation without allocating/promoting the obsolete target. Actual root/head fencing remains the coordinator's responsibility, even after claim wins.

## Nine prepared real-Native cases

1. Actual Native `cases` create inside an externally owned native transaction; its real outbox intent plus actor/due/version metadata are visible inside, invisible independently until COMMIT, then durable. No fake DB row is substituted.
2. Editorial rollback removes both intent and metadata; independent claim cannot see the uncommitted operation.
3. Two Native claimers are held after actual metadata reads at version0, then race CAS. Exactly one is claimed. A test-only adapter boundary barrier returns unmodified Native query results; no fabricated row/result and no test-only production hook.
4. Claim durably starts version1, then actual coordinator reads a real filesystem-invalid current.json directory and remains pending. Started metadata version/due survives; old outbox attempts remains0 because its failed coordinator transaction did not advance.
5. New manual attempt version2 cannot be overwritten by version1 or future version3 outcome; its schedule remains byte-for-byte equal as a record.
6. A purported public receipt while authoritative outbox is pending cannot complete or grant publication. Then the actual existing coordinator promotes/independently ACKs; matching metadata outcome clears due without writing visibility. Started version1 and legacy coordinator attempts1 are separately observed.
7. Native reorder creates a newer latest intention; old claim routes to stale reconciliation without consuming its old execution version.
8. Real published `case-content` intention, then a newer private Native draft: editorialRevision changes while latestPublicationIntent remains. The exact immutable approved intent stays claimable; private body is not selected.
9. Native execution row actor=NULL/due=NULL is automatic-manual-only; explicit manual request rebinds solely to the real fixture editor and starts version1. Outbox stays pending with unchanged legacy attempts.

The tests use `createEditorialPayloadFixture`, actual native transactions, actual approved adapters/coordinator and a small guarded owned temp directory for FS failure. They do not require Next/HTTP or a background worker. Existing policy48-unit evidence is reused rather than repeated here.

## Exact first Native RED command — root allocation required

From `E:\a-design-for-life`, with no other55434 owner:

```powershell
$publicationRetriesNode = Join-Path (Get-Location) '.toolchain\node-v24.22.2-win-x64\node.exe'
& $publicationRetriesNode '.\node_modules\vitest\vitest.mjs' run --project integration src/helpers/payload/publication-retries.integration.test.ts --reporter=verbose -t 'persists retry actor and due time'
```

Existing integration global setup acquires the owned55434 lifecycle and runs native migrations; do not run that CLI before root releases/allocates the lease. The first genuine RED is expected to observe the actual original outbox inside the real editorial TX, then fail because the importable scaffold persisted no retry actor/due metadata. Schema/config is still unchanged. Do not label later assertions as observed until GREEN reaches them.

After that RED and explicit shared-path authorization, the full prepared file command is the same without `-t`. Capture full stdout/stderr, exit receipts and source/schema hashes in C/E evidence. No inline table creation or memory adapter can replace the Native proof.

## Shared paths needed only after observed RED

- New `src/helpers/payload/publication-retries.collection.ts`.
- `src/payload.config.ts` registration and generated `src/payload-types.ts`.
- New additive `src/migrations/<timestamp>_publication_retry_metadata.ts` + snapshot; `src/migrations/index.ts`.
- `src/helpers/payload/publication-updates.ts` for ordinary same-TX scheduling and explicit legacy no-auto skip. If an internal option is chosen instead of existing server-owned dependency tagging, current `src/config/capture-legacy-publications.ts` supplies it. No published historical migration edit.
- New helper/tests may then receive minimal implementation; actual migration/capture regression tests must cover historical absent-new-table paths.

Coordinator attempt accounting, publication writer/roots, HTTP generation proof, worker/startup, job queue, frontend and all full gates remain outside this allocation. No TTL takeover, first-admin identity, second visibility authority or parallel ORM/business SQL is introduced.
