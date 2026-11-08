# Next authorized E3.2 slice — persisted retry process

Read own final persisted report and current helpers. Preserve A1 authority, separate hidden scheduling metadata and default-OFF activation. Root accepted final actorless guard fix; all Native resources released. Do not count this preparatory slice complete until corresponding real process/Next proofs exist.

## Scope and sequence

First propose exact interfaces/paths from current source, then TDD generic bounded drain + supervisor/Native composition, followed by existing post-write/manual entry-point claim/outcome wiring and optional Next startup. New helpers/payload worker modules/tests and config worker modules/tests/optional --once test child are owned. Existing publication-updates/confirm-publication-write/publication-transport can receive only the minimal explicit attempt-mode integration; coordinator/root/media authority unchanged in this slice. Server-env/test-environment/instrumentation may receive one explicit worker opt-in, defaultOFF, only after tests. No schema/migrations/package/lock/Docker/backup/analytics changes. No source outside scope. No new public worker API.

Read actual old migration/capture call paths again before wiring: no HTTP/server is available during migrations and no new-table access is allowed there. Keep the published migration unchanged. Explicit existing internal legacy skip remains. Current collection lockDocuments:false and metadata registration flag remain.

## Behavior

- Worker runs in SAME Next process/container/network namespace as the existing abstract-socket publication fence, with a separate worker-drain identity. No duplicate authority/target/state or TTL takeover. One bounded sequential batch, idempotent CAS, existing coordinator remains publication/head/root authority.
- Load due technical rows through Native Payload only. NULL actors are manual-only; hydrate a real recorded user via Native users lookup before createLocalReq and existing subject access. Missing account stays visibly pending/manual; never pick an admin or forge an account. A newer private draft must not cancel its immutable approved intent.
- Claim started version + pre-armed next due durably before execute; outcomes only match current actual outbox receipt and version. Different/missing latest intent goes through existing stale reconciliation/media-pin protection, never chooses a newer target automatically.
- Clear terminal/stale scheduling due time by conditional Native maintenance based on independently observed authoritative outbox, including started version0; otherwise old public rows at the front can starve future pending work. Do not persist visibility again. Missing actor rows cannot occupy all due batches forever. Test batch progress through failures/terminal/stale entries.
- Wire immediate post-write and explicit manual retries to the new claims/outcomes when the feature is registered; defaultOFF keeps old behavior. Do not double-count legacy attempts or reset automatic budget on every automatic call. Inspect shared-case prerequisite recursion: preserve its approved immutable intent and actor/access behavior. Caller-owned/uncommitted transaction still returns pending with no promotion/claim.
- Background supervisor must NOT await or initialize DB during instrumentation registration or positive public-cache cold start. Start only on explicit operational worker flag and enabled metadata. Detached errors are caught, bounded retry loop/timer is unrefed; PG failures cannot crash Next or block health/public cache. Do not Promise.race an uncancelled write and spawn unlimited work. Stop scheduling safely; shared application Payload pool is not worker-owned, never destroy/end it just because a drain stopped.
- Ordinary unit/Native tests keep worker OFF; dedicated owned process proof opts in explicitly. No environment/.env activation, real providers or production. Flag mismatch fails clearly before work.
- Logs use existing safe structured logger; no raw errors/SQL/body/email/token/URI. Inject clock/poll/batch for behavioral tests; 1/5/15 and60s remain measured A3 proposals, not SLA.

## Proof / coordination

TDD behavior RED→minimumGREEN; actual Native access/transaction/concurrency/process restart must use real owned Payload/PostgreSQL. Pure service tests can control execution/clock boundaries, not fake transaction guarantees. Real child process restart must retain pre-armed attempt and retry same target after root→SQL ACK interruption without draft fallback/TTL stealing.

Backup parent is preparing an encrypted Native roundtrip and gets NEXT55434 allocation when ready. You may do units/preparation now, but DO NOT start Native/Next/PG/Docker tests until root explicitly allocates. Send exact command when ready; root owns full gates and source freeze coordination. No new DB starts after a release without allocation.

## HTTP acknowledgement next boundary (design only here)

E3.2 still needs real HTTP revision confirmation before existing public ACK. Do not add a whole new HMAC challenge/auth API silently. Root favors a public opaque generation header derived from the SAME already verified/pinned root used by normal public SSR, plus status/completed body/projection checks. Feature Native published DTO endpoints must capture/pass one root if used for initial profile/navigation/shared-order bootstrap, preserving their existing empty/error behavior. An extra root reread only to stamp a header would not prove body generation.

Before changing coordinator/Proxy/features, produce a bounded concrete read-only proposal: optional generic verify(root,operation) callback BEFORE current public-state write (holding existing writer/nativeTX during strictly bounded READ-ONLY probes), safe loopback origin/path allowlist, dependency/bootstrap ordering, verification failures stay pending, no false-success status window. Old root→SQL ACK and latest-intent fences remain. No cookies forwarded, no visitor-selectable generation, no private draft. HTTP500/stream failure/mismatched body is not a success even with a generation marker; cached media denial is checked separately. This next proposal is routine internal design, not a new user interview.

## Delivery

Freeze/report paths, actual RED/GREEN/commands/runtime/source hashes, failed/not-run checks and leftover risks. Preserve current Native54 stdout-only exit limit plus later explicit one-case receipts; don't replace historical results. Root owns progress/commits/full gates/A3. Stage3 only, NVDA off, no purchases/cloud sends/production/E4.
