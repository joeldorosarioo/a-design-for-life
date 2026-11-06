# Native persisted retry slice — scoped handoff

Prepared for the root agent on 2026-11-03/04. No E3 checklist credit or percentage is asserted by this report. Root owns the aggregate gates and stage accounting.

## Implemented boundary

The new `publication-retries` Native collection stores execution metadata keyed uniquely by the existing immutable operationId: nullable real editor id, durably started attempt version, automatic-attempt counter, and next due instant. It does not duplicate the outbox target, state, public root, revision authority, or media grants. Existing `publication-updates` schema and the A1 coordinator are unchanged.

Server-only `PUBLICATION_RETRIES_ENABLED` is absent/OFF by default. It gates collection registration; ordinary enqueue schedules only when that Native collection is actually registered. No existing environment file was edited or activated. `testing/setup/test-environment.ts` explicitly enables it solely inside the exact acquired test namespace. The Native migration global setup runs before fixtures.

The activation order is documented in `E:\a-design-for-life\docs\runbooks\publicacao-e-cache.md`: apply the new additive migration in a controlled migration execution first; verify schema; then opt in and restart the same application image. Turn OFF before rolling the schema back. No table probing, automatic DDL, cloned ORM, or ordinary-operation business SQL was introduced.

## Public helper interface

`E:\a-design-for-life\src\helpers\payload\publication-retries.ts` exports:

- `schedulePublicationRetry(operationId, req, clock)` requires a real active Native editorial transaction and a real authorized user. It persists the initial execution metadata with the immutable intent using exactly that request/transaction. Existing metadata is returned idempotently.
- `readPublicationRetry(operationId, req)` returns the technical projection to an editorial request; the Native collection API itself denies create/read/update/delete, including to editors.
- `claimPublicationRetry(operationId, { mode: 'immediate' | 'automatic' | 'manual' }, req, clock)` rejects caller-owned transactions, independently reads the committed outbox and actual Native subject access, projects the reviewed pure policy, and atomically CASes the execution version before returning `claimed`. It returns `reconcile-stale` for a different/missing Native publication head instead of choosing a new target. A newer private `editorialRevision` does not invalidate an unchanged approved `latestPublicationIntent`.
- `recordPublicationRetryOutcome({ attempt: { operationId, version }, receipt }, req)` independently verifies operation/revision/state, checks the matching persisted started version, and CASes only the due instant. It never makes the outbox public. Old/future versions and unconfirmed receipts cannot replace a later schedule.

The clock is injected. The pure policy remains the reviewed closed Zod contract in `publication-retry-policy.ts`. Proposed delays are still 1/5/15 seconds, anchored when the preceding attempt starts, with a bounded automatic budget and explicit manual reset. Neither those delays nor 60-second propagation is an approved SLA; they remain the A3 operational proposal.

The helper is importable but no worker, startup timer, automatic scan, HTTP proof protocol, or wiring of existing manual/post-write coordinator entry points to claims/outcomes is included. Therefore the existing coordinator's historical `attempts` limitation is not falsely claimed fixed for all callers. `startedAttemptsVersion` is proven durable for these new helper calls, without double-incrementing the legacy coordinator counter or inventing historical attempts.

## Migration safety

The new official Native migration and snapshot are:

- `E:\a-design-for-life\src\migrations\20261104_012603_publication_retry_metadata.ts`
- `E:\a-design-for-life\src\migrations\20261104_012603_publication_retry_metadata.json`

The Native migration creates only `publication_retries` and its indexes. Its index registration and Native generated types are included. `lockDocuments:false` is supported by installed Payload 3.92.1 and prevents adding a future retry relation column to the historical `payload_locked_documents_rels` table.

The published `20261030_124550_publication_coordination.ts` migration calls the current capture/enqueue APIs while the later retry table does not yet exist. Current capture therefore passes an explicit internal `{ scheduleRetry: false }` to enqueue. No historical migration was edited; no legacy metadata backfill was added. Missing/null actors do not acquire a fabricated first administrator or retroactive counts. Ordinary enqueue keeps the outbox and new metadata inside the same actual editorial transaction.

Generation used a private C `.mts` file calling installed Native `buildConfig`, `getPayload({ disableDBConnect: true, disableOnInit: true })`, `db.createMigration` and `generateTypes`; no database service was initialized for generation. Auto-generated Native `payload-*` collections were filtered before re-sanitizing to avoid duplicate `payload-kv`. An initial unapplied migration with a lock relation was moved to C evidence before regeneration; it was never part of the applied migration sequence. Final generated types were generated again from the actual final config. The final new snapshot was formatted with the repository's Prettier before hashes.

## TDD and actual Native evidence

All commands use `E:\a-design-for-life\.toolchain\node-v24.22.2-win-x64\node.exe` from repository root, and installed Vitest 5.0.5. Actual owned PostgreSQL is 17.11, port 55434, from the pinned `postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b` image. Payload is 3.92.1.

| Evidence | Observed result |
| --- | --- |
| `publication-retries-native-red.txt` | Genuine first Native assertion RED: real outbox existed inside its editorial transaction, but retry metadata was null; 1 failed, 8 skipped, exit 1. No import/schema/cleanup failure. |
| `publication-retries-flag-red.txt` | Default-OFF/explicit opt-in contract RED before the server schema change. |
| `publication-retries-test-optin-red.txt` | Exact isolated test opt-in RED before test setup plumbing. |
| `publication-retries-native-green.txt` | Original 9 actual Native behavior cases passed, exit 0. |
| `publication-retries-missing-head-red.txt` | Actual deleted subject caused Native 404 before the helper could return stale reconciliation; 1 failed, 12 skipped, exit 1. |
| `publication-retries-native-expanded-green.txt` | All 13 then-current cases passed after raw existence read followed by Native access for existing heads, exit 0. |
| `publication-retries-focused-native-final.txt` | 8 files, 54 tests passed: retry 14 + affected A1/capture/migration regressions. This run preceded the final test-only architecture correction. |
| `publication-retries-withdrawal-final.txt` + `.json` | Corrected withdrawal/trash/outcome case passed, 1 passed/13 skipped, explicit captured exit 0. |
| `publication-retries-legacy-immediate-red.txt` + `.json` | Final contract audit produced genuine Native RED: immediate mode claimed version 1 on a NULL-actor legacy row instead of skipping manual-only; 1 failed/13 skipped, explicit captured exit 1. |
| `publication-retries-legacy-immediate-green.txt` + `.json` | Minimal guard correction passed the same single legacy case, 1 passed/13 skipped, explicit captured exit 0. |
| `publication-retries-unit-final.txt` + `.json` | 84 unit tests passed (48 policy + 26 environment + 10 isolated environment), explicit captured exit 0. |
| `publication-retries-typecheck-corrected.txt` + `.json` | Scoped TypeScript, exit 0. |
| `publication-retries-lint-corrected.txt` + `.json` | Scoped ESLint including architecture boundaries, exit 0. |
| `publication-retries-format-corrected.txt` + `.json` | Scoped Prettier including Native snapshot and runbook, exit 0. |
| `publication-retries-legacy-unit-final.txt` + `.json` | Fresh final 84/84 unit pass after the actorless guard correction, explicit captured exit 0. |
| `publication-retries-legacy-typecheck-final.txt` + `.json` | Fresh final scoped TypeScript after the actorless guard correction, exit 0. |
| `publication-retries-legacy-lint-final.txt` + `.json` | Fresh final scoped ESLint after the actorless guard correction, exit 0. |
| `publication-retries-legacy-format-final.txt` + `.json` | Fresh final scoped Prettier after the actorless guard correction, exit 0. |

The 14 Native behavior cases cover same-TX actor/due and uncommitted invisibility; rollback; two atomic CAS claimers with one winner; durable version on a real filesystem failure with unchanged legacy attempts; stale/future outcome exclusion; actual independently confirmed outcome matching; old Native intent reconciliation; newer private-draft distinction; NULL legacy automatic/immediate skip and manual rebind; anonymous/helper and Native technical ACL denial; caller-owned claim transaction rejection; genuinely missing head; actual withdrawal/media trash; and replay of the original capture while the later retry table is absent. That last replay drops/reapplies only through the actual old/new Native migrations inside one rollback transaction and checks catalog existence diagnostically. The original 54-test run, corrected withdrawal single case, and final legacy single case remain separate evidence scopes; a new 54-test pass after the last guard correction is not asserted.

Exact focused Native command for the original RED is the common invocation below followed by `-t 'persists retry actor and due time'`. The current suite command is:

```powershell
& 'E:\a-design-for-life\.toolchain\node-v24.22.2-win-x64\node.exe' '.\node_modules\vitest\vitest.mjs' run --project integration src/helpers/payload/publication-retries.integration.test.ts --reporter=verbose
```

The original 54-test command adds these seven files before `--reporter=verbose`: `src/config/capture-legacy-publications.integration.test.ts`, `src/config/publication-migration.integration.test.ts`, `src/helpers/payload/publication-enqueue.integration.test.ts`, `src/config/publication-updates.integration.test.ts`, `src/config/publication-command-receipts.integration.test.ts`, `src/config/publication-native-boundaries.integration.test.ts`, `src/config/publication-failure-boundaries.integration.test.ts`. The corrected withdrawal command appends `-t 'keeps real withdrawal execution safe through approved media trash'`; final legacy RED/GREEN append `-t 'keeps a legacy NULL actor manual-only'`. The explicit JSON receipts retain full actual commands, timestamps, original exit codes, and log names for those later runs and final static checks.

The full 54-test stdout log is preserved and reports 54 passed. Its terminal process handle was unavailable after context compaction, so no separate recovered process-exit JSON is claimed for that historical run. The final focused cases and unit/static passes have explicit captured process-exit receipts. Root still owns the later cohesive whole gate.

The four publication subject collections currently do not enable Native trash. Only media enables it. No synthetic deletedAt field or new subject-trash product behavior was introduced. The actual withdrawal test proves that trash is refused while a media grant remains, succeeds after withdrawal confirmation, default Native read then returns 404, `trash:true` can access the real trashed media, and retry/outcome recording leaves the root's matching withdrawal envelope with null detail/slug and empty media. Existing HTTP/route 410 proof is outside this generic helper assertion and was not substituted by it. Existing heads in the helper still pass `overrideAccess:false` Native access; there is no access-error catch-all.

## Resource lifecycle and source boundary

The focused 54-test run used runId `d326c336-64a6-4d33-bdd4-ebb67209b141`, container `d6bd4e3a4a3ea02aed87c7bf22b106a21e96d2138f0e79ed0d5b07eda21755fd`, network `9729f8f74f572fa551f7ae0c6f8e3147c9263c3c1c5fef576937495d25dac49b`.

The final corrected single-case run used runId `5c30db1f-f0dc-4bbc-bea3-daa60ff22980`, container `e05f8c42d27ab819576ed233ed739c819754aa30141c2a6726564f8b878259d0`, network `7b7be1b6208b2b76505d386f1458d0ac0de37cdc1887162d6fa55539039301c3`. Cleanup after each run lists zero disposable containers, zero disposable networks, and no lifecycle lock (`publication-retries-cleanup.json`, `publication-retries-withdrawal-cleanup.json`). Port 55434 was explicitly released back to root. No preview/visual service was restarted, adopted, or deleted. No full verify, build, HTTP/E2E, background worker, or startup integration was run in this slice.

Final legacy RED runId was `ae9be21a-d9fb-4af4-955d-c05ee564fe7f`; GREEN runId was `68598c5a-5dcf-4c00-a5c2-9043b4dc9ab4`, container `470e1665e227fccdfb332878eb5c24f89b5ff4756e74f3bb17ab3ebe9daf0d1b`, network `e5b17ca4765927d8140dba76b6400cdfc18bb2d8464cfa7b46887bdf1574f550`. `publication-retries-legacy-cleanup.json` records the complete RED/GREEN IDs and empty owned resource/lock lists after teardown. Root was explicitly told 55434 is released and source is frozen. Subsequent work is limited to this evidence/report mirror.

The first final lint found a test-only helper→feature import and an ignored generated-types warning; it was corrected without suppressing architecture rules. The route assertion was replaced by the generic root withdrawal envelope assertion and the actual changed case was rerun. The first final format check required formatting the new official Native JSON snapshot; the corrected check passes. Earlier failed logs are retained.

## Approval review audit

Automatic approval review rejected the earlier unguarded config/enqueue wiring because an existing environment might not yet contain the new retry table. A later attempt with the generated migration present still lacked runtime migration-order protection and was also rejected. Neither rejected wiring patch was applied. Root selected the safer migration-backed default-OFF gate for both registration and scheduling; that alternative was accepted and is the implemented form. Existing environments remain OFF. There is no unresolved permission request from those rejected actions.

## Final review finding resolved with focused TDD

The final read-through found that actorless legacy claims were initially blocked only in `automatic` mode. Root reallocated 55434 for an added assertion in the existing NULL-actor case. The actual expected RED showed `immediate` claiming version 1 and binding an editor. The minimal guard was broadened to `mode !== 'manual'`; the fresh focused GREEN proves both non-manual modes skip without allocating, and a real authorized manual editor alone can rebind. Fresh 84-unit and scoped types/lint/format checks passed afterward. This bounded issue is resolved; no new case, worker, authority, or historical mutation was introduced.

Final source hashes and read-only protected-file audit are in `publication-retries-source-freeze.json`. This report and evidence are mirrored under `E:\a-design-for-life\docs\verification\artifacts\E3-cache`. No commit or push was made.
