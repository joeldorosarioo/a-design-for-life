# Pure publication retry policy — frozen handoff

2026-11-03. Only two new source files were added: `src/helpers/payload/publication-retry-policy.ts` and adjacent `.test.ts`. Source is frozen for root review/persisted integration. No coordinator, collection, generated types, migration, configuration, worker/startup or other shared source was changed. No DB/container/service, Next/E2E, full gate, commit or push was run.

Fresh final checks: **48/48 focused unit tests passed**, scoped ESLint exit0, Prettier exit0, focused non-incremental TypeScript exit0. Node v24.22.2, Vitest v5.0.5. These are scoped results, not an E3 completion claim or full-suite result.

## Concrete public interface

```ts
type PublicationRetryClock = () => Date;
type PublicationRetryState = {
  operationId: string;
  state: 'update-pending' | 'public' | 'superseded';
  attempts: number;
  automaticAttempts: number;
  nextAttemptAt: string | null;
};

initializePublicationRetry(operationId: unknown, clock: PublicationRetryClock)
// initialized {state} | invalid {reason}

planPublicationRetryAttempt(state: unknown, command: unknown, clock: PublicationRetryClock)
// Closed command:
// {mode:'immediate'|'automatic'|'manual', latestPublicationIntent:string|null}
// start {state, attempt:{operationId,version}} | reconcile-stale {operationId}
// | skip {reason} | invalid {reason}

applyPublicationRetryOutcome(current: unknown, attempt: unknown, outcome: unknown)
// Outcome must be one of the existing receipt states from the fenced coordinator.
// apply {state} | skip {reason} | invalid {reason}
```

`publicationRetryStateSchema` is an exported closed Zod schema. State/attempt/decision types are exported. Native operation id and receipt-state validation reuse the existing publicReceiptSchema. Commands and attempt tokens are strict too. Project native outbox rows to the six listed fields: target data, editorialRevision and unknown keys are rejected.

`PUBLICATION_RETRY_PROPOSAL_DELAYS_MS` explicitly names the frozen 1/5/15-second proposal. It neither establishes an approved SLA nor implements a 60-second propagation guarantee.

## Semantics for the persisted slice

Initialization arms now+1 second, so a process that dies after editorial COMMIT but before immediate confirmation still has a due plan to persist. Immediate execution is allowed only at attempts0; it allocates version1 and pre-arms now+1 second. Repeated immediate calls cannot bypass the automatic budget.

Automatic work starts only at/after a non-null due time. First/second/third automatic starts increment automaticAttempts to1/2/3, pre-arming now+5 seconds, now+15 seconds and null. Final failure remains pending/manual. If the immediate caller never ran, the due automatic attempt works with attempts1/automaticAttempts1. Delays are anchored at each durably started stage, as proposed in the design.

Manual retry resets automaticAttempts to0 and pre-arms now+1 second, preserves operationId and increments the safe monotonic attempts/version. It does not create or select another target. Pending outcome preserves the pre-armed due time; public/superseded clears it only for a matching operation/version. Different-operation or stale/future-version outcomes skip. Terminal state is not reopened by a late failure.

Malformed UUIDs, inconsistent/non-safe/fractional counts, terminal/exhausted states with due dates, invalid/impossible/ambiguous-local dates, invalid/failing clocks and timestamp/version overflow fail closed with stable reason codes. Offset-bearing ISO instants compare in UTC; newly scheduled times use canonical UTC. Clock exception messages/private input are not returned. Inputs are not mutated.

**Native distinction:** latestPublicationIntent alone decides stale intent. Different/missing native intent returns reconcile-stale with the old operation id; it does not silently discard root→SQL ACK ownership. An older already-public operation named by manual retry must also reconcile if Native now names a newer intent, rather than reusing its prior public receipt. Already superseded is terminal. A newer private draft's editorialRevision is outside the policy input; unchanged latestPublicationIntent keeps the approved immutable intention eligible.

These are pure plans, not acquired attempts or publication receipts. The next slice must use independently read native state and atomically persist a start's version/counters/due date before execution. Only the CAS winner executes. Matching pending-state/version CAS is also required when applying an outcome from the existing fenced coordinator and eventual HTTP verification. The attempt token is not an authorization credential; this policy neither verifies HTTP delivery nor grants media/users access or replaces writer/head fencing. Never accept a client-supplied public outcome.

## TDD evidence

| Phase | Exit | Result |
| --- | --- | --- |
| Missing-policy stub RED |1 |26 failed /21 passed /47 total. Valid lifecycle expectations failed; fail-closed cases already passed the stub. |
| Minimal implementation GREEN |0 |47/47 passed. |
| Stale prior-public receipt RED |1 |1 failed /47 passed /48 total: terminal-skip incorrectly reused older public state. |
| Minimal stale-branch fix GREEN |0 |48/48 passed. |
| Final after refactor/format |0 |48/48 passed. |
| Final scoped lint/format/typecheck |0 |All clean for both new files and their actual imported receipt contract. |

Full commands/exit receipts and source hashes: `retry-policy-check-receipts.json`. Complete logs are duplicated in Cwork `work/E3-execution/` and repository `docs/verification/artifacts/E3-cache/`:

- `retry-policy-red.txt`, `retry-policy-green.txt`
- `retry-policy-stale-receipt-red.txt`, `retry-policy-stale-receipt-green.txt`
- `retry-policy-unit-final.txt`, `retry-policy-lint-final.txt`, `retry-policy-format-final.txt`, `retry-policy-typecheck-final.txt`

One static-check invocation used unsupported `--pretty=false` and exited1 before checking code. Preserved diagnostic: `retry-policy-typecheck-invocation-error.txt`. Corrected command `--pretty false` produced fresh scoped TypeScript exit0. No automatic approval rejection occurred.

Frozen SHA256:

- Policy: `9C82ECCBC531BB674A44B38C9782F316E27431CCBEBE1DC355D40DB6BDB58C1D`
- Test: `73DB4548A30103B6F502F85C0A94EB3915FFA93FDA716B94CB2D71354E31A273`

## Ready focused commands

From `E:\a-design-for-life`:

```powershell
$retryPolicyNode = Join-Path (Get-Location) '.toolchain\node-v24.22.2-win-x64\node.exe'
& $retryPolicyNode '.\node_modules\vitest\vitest.mjs' run --project unit src/helpers/payload/publication-retry-policy.test.ts --reporter=verbose
& $retryPolicyNode '.\node_modules\eslint\bin\eslint.js' src/helpers/payload/publication-retry-policy.ts src/helpers/payload/publication-retry-policy.test.ts
& $retryPolicyNode '.\node_modules\prettier\bin\prettier.cjs' --check src/helpers/payload/publication-retry-policy.ts src/helpers/payload/publication-retry-policy.test.ts
& $retryPolicyNode '.\node_modules\typescript\bin\tsc' --project 'C:\Users\joeld\Documents\Codex\2026-11-03\quero-retomar-e-concluir-a-etapa\work\E3-execution\retry-policy.tsconfig.json' --noEmit --pretty false
```

The focused TypeScript config lives only in Cwork and disables incremental output. Root owns subsequent persisted integration and full gates after lease coordination. No further source work starts automatically from this handoff.
