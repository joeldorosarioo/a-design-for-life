import { expect, it } from 'vitest';
import {
  applyPublicationRetryOutcome,
  initializePublicationRetry,
  planPublicationRetryAttempt,
  type PublicationRetryState,
} from './publication-retry-policy';

const operationId = '13a927bc-de52-42a2-b732-544b4919bf07';
const newerOperationId = '38981cc4-1b50-4159-813c-4ad7f7168e6d';
const now = () => new Date('2026-11-03T12:00:00.000Z');
function state(overrides: Partial<PublicationRetryState> = {}): PublicationRetryState {
  return {
    operationId,
    state: 'update-pending',
    attempts: 0,
    automaticAttempts: 0,
    nextAttemptAt: '2026-11-03T12:00:01.000Z',
    ...overrides,
  };
}

it('arms a committed intention for recovery even when its immediate caller never starts an attempt', () => {
  expect(initializePublicationRetry(operationId, now)).toEqual({
    kind: 'initialized',
    state: {
      operationId,
      state: 'update-pending',
      attempts: 0,
      automaticAttempts: 0,
      nextAttemptAt: '2026-11-03T12:00:01.000Z',
    },
  });
});

it('starts the immediate attempt with a durable version and pre-arms the first proposed retry', () => {
  const input = Object.freeze(state());
  expect(
    planPublicationRetryAttempt(
      input,
      { mode: 'immediate', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({
    kind: 'start',
    attempt: { operationId, version: 1 },
    state: {
      operationId,
      state: 'update-pending',
      attempts: 1,
      automaticAttempts: 0,
      nextAttemptAt: '2026-11-03T12:00:01.000Z',
    },
  });
  expect(input.attempts).toBe(0);
});

it('does not spend a retry before its persisted due time', () => {
  expect(
    planPublicationRetryAttempt(
      state({ attempts: 1 }),
      { mode: 'automatic', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({ kind: 'skip', reason: 'not-due' });
});

it('pre-arms the proposed 1/5/15-second stages and leaves a fourth failure pending for manual recovery', () => {
  let current = state({ attempts: 1 });
  for (const entry of [
    {
      time: '2026-11-03T12:00:01.000Z',
      version: 2,
      automaticAttempts: 1,
      due: '2026-11-03T12:00:06.000Z',
    },
    {
      time: '2026-11-03T12:00:06.000Z',
      version: 3,
      automaticAttempts: 2,
      due: '2026-11-03T12:00:21.000Z',
    },
    {
      time: '2026-11-03T12:00:21.000Z',
      version: 4,
      automaticAttempts: 3,
      due: null,
    },
  ]) {
    const planned = planPublicationRetryAttempt(
      current,
      { mode: 'automatic', latestPublicationIntent: operationId },
      () => new Date(entry.time),
    );
    expect(planned.kind).toBe('start');
    if (planned.kind !== 'start') throw new Error('Expected a proposed automatic stage.');
    expect(planned.attempt).toEqual({ operationId, version: entry.version });
    expect(planned.state).toEqual({
      operationId,
      state: 'update-pending',
      attempts: entry.version,
      automaticAttempts: entry.automaticAttempts,
      nextAttemptAt: entry.due,
    });
    // Failed work cannot postpone/reset the already persisted stage.
    const outcome = applyPublicationRetryOutcome(planned.state, planned.attempt, 'update-pending');
    expect(outcome).toEqual({ kind: 'apply', state: planned.state });
    if (outcome.kind !== 'apply') throw new Error('Expected the matching failure outcome.');
    current = outcome.state;
  }
  expect(
    planPublicationRetryAttempt(
      current,
      { mode: 'automatic', latestPublicationIntent: operationId },
      () => new Date('2026-11-03T13:00:00.000Z'),
    ),
  ).toEqual({ kind: 'skip', reason: 'exhausted' });
});

it('can recover a due intention whose process died before the immediate post-write attempt', () => {
  const planned = planPublicationRetryAttempt(
    state(),
    { mode: 'automatic', latestPublicationIntent: operationId },
    () => new Date('2026-11-03T12:00:01.000Z'),
  );
  expect(planned).toEqual({
    kind: 'start',
    attempt: { operationId, version: 1 },
    state: {
      operationId,
      state: 'update-pending',
      attempts: 1,
      automaticAttempts: 1,
      nextAttemptAt: '2026-11-03T12:00:06.000Z',
    },
  });
});

it('manual recovery resets the proposed budget while preserving the same immutable operation', () => {
  const planned = planPublicationRetryAttempt(
    state({ attempts: 4, automaticAttempts: 3, nextAttemptAt: null }),
    { mode: 'manual', latestPublicationIntent: operationId },
    () => new Date('2026-11-03T12:05:00.000Z'),
  );
  expect(planned).toEqual({
    kind: 'start',
    attempt: { operationId, version: 5 },
    state: {
      operationId,
      state: 'update-pending',
      attempts: 5,
      automaticAttempts: 0,
      nextAttemptAt: '2026-11-03T12:05:01.000Z',
    },
  });
});

it.each(['automatic', 'manual', 'immediate'])(
  '%s identifies a different native latest intent for reconciliation without spending or promoting the old target',
  (mode) => {
    const input = Object.freeze(state());
    expect(
      planPublicationRetryAttempt(input, { mode, latestPublicationIntent: newerOperationId }, now),
    ).toEqual({ kind: 'reconcile-stale', operationId });
    expect(input.attempts).toBe(0);
  },
);

it('routes a missing native publication head to reconciliation instead of choosing another target', () => {
  expect(
    planPublicationRetryAttempt(state(), { mode: 'manual', latestPublicationIntent: null }, now),
  ).toEqual({ kind: 'reconcile-stale', operationId });
});

it('does not reuse an older public receipt when a manual retry names an operation superseded by a newer native intent', () => {
  expect(
    planPublicationRetryAttempt(
      state({ state: 'public', attempts: 2, automaticAttempts: 1, nextAttemptAt: null }),
      { mode: 'manual', latestPublicationIntent: newerOperationId },
      now,
    ),
  ).toEqual({ kind: 'reconcile-stale', operationId });
});

it('keeps the approved intent eligible after a newer private draft changes only the editorial revision', () => {
  const nativeHead = {
    latestPublicationIntent: operationId,
    editorialRevision: 'f48ea205-8e76-47d8-a575-e1ed0eb9719b',
  };
  const planned = planPublicationRetryAttempt(
    state({ attempts: 1 }),
    { mode: 'automatic', latestPublicationIntent: nativeHead.latestPublicationIntent },
    () => new Date('2026-11-03T12:00:01.000Z'),
  );
  expect(planned.kind).toBe('start');
  if (planned.kind !== 'start')
    throw new Error('Private draft must not cancel the approved intent.');
  expect(planned.attempt.operationId).toBe(operationId);
});

it.each(['public', 'superseded', 'update-pending'])(
  'ignores a late %s outcome after a newer started attempt or manual reset',
  (outcome) => {
    const input = Object.freeze(
      state({ attempts: 5, automaticAttempts: 0, nextAttemptAt: '2026-11-03T12:05:01.000Z' }),
    );
    expect(applyPublicationRetryOutcome(input, { operationId, version: 4 }, outcome)).toEqual({
      kind: 'skip',
      reason: 'stale-outcome',
    });
    expect(input.nextAttemptAt).toBe('2026-11-03T12:05:01.000Z');
  },
);

it('never applies another operation outcome even when its version matches', () => {
  expect(
    applyPublicationRetryOutcome(
      state({ attempts: 2, automaticAttempts: 1 }),
      { operationId: newerOperationId, version: 2 },
      'public',
    ),
  ).toEqual({ kind: 'skip', reason: 'different-operation' });
});

it.each(['public', 'superseded'] as const)(
  '%s outcome ends automatic scheduling only for the matching started attempt',
  (outcome) => {
    expect(
      applyPublicationRetryOutcome(
        state({ attempts: 2, automaticAttempts: 1 }),
        { operationId, version: 2 },
        outcome,
      ),
    ).toEqual({
      kind: 'apply',
      state: {
        operationId,
        state: outcome,
        attempts: 2,
        automaticAttempts: 1,
        nextAttemptAt: null,
      },
    });
  },
);

it.each(['public', 'superseded'] as const)(
  'does not reopen terminal %s state for a retry or late failure',
  (terminal) => {
    const input = state({
      state: terminal,
      attempts: 2,
      automaticAttempts: 1,
      nextAttemptAt: null,
    });
    expect(
      planPublicationRetryAttempt(
        input,
        { mode: 'manual', latestPublicationIntent: operationId },
        now,
      ),
    ).toEqual({ kind: 'skip', reason: 'terminal' });
    expect(
      applyPublicationRetryOutcome(input, { operationId, version: 2 }, 'update-pending'),
    ).toEqual({ kind: 'skip', reason: 'terminal' });
  },
);

it('leaves unscheduled legacy work manual-only while permitting an explicit manual reset', () => {
  const input = state({ nextAttemptAt: null });
  expect(
    planPublicationRetryAttempt(
      input,
      { mode: 'automatic', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({ kind: 'skip', reason: 'unscheduled' });
  expect(
    planPublicationRetryAttempt(
      input,
      { mode: 'manual', latestPublicationIntent: operationId },
      now,
    ).kind,
  ).toBe('start');
});

it('cannot repeatedly allocate immediate attempts outside the automatic budget', () => {
  expect(
    planPublicationRetryAttempt(
      state({ attempts: 1 }),
      { mode: 'immediate', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({ kind: 'skip', reason: 'already-attempted' });
});

it('compares an offset-bearing persisted instant in UTC and emits a canonical next due time', () => {
  const planned = planPublicationRetryAttempt(
    state({ attempts: 1, nextAttemptAt: '2026-11-03T09:00:00-03:00' }),
    { mode: 'automatic', latestPublicationIntent: operationId },
    now,
  );
  expect(planned.kind).toBe('start');
  if (planned.kind !== 'start') throw new Error('Equal instants must be due.');
  expect(planned.state.nextAttemptAt).toBe('2026-11-03T12:00:05.000Z');
});

it.each([
  null,
  { ...state(), target: 'A private body must never enter this policy' },
  state({ attempts: -1 }),
  state({ attempts: 1.5 }),
  state({ attempts: Number.MAX_SAFE_INTEGER + 1 }),
  state({ automaticAttempts: 1 }),
  state({ attempts: 4, automaticAttempts: 4 }),
  state({ attempts: 3, automaticAttempts: 3, nextAttemptAt: '2026-11-03T13:00:00.000Z' }),
  state({ state: 'public', nextAttemptAt: '2026-11-03T13:00:00.000Z' }),
  state({ nextAttemptAt: 'not-a-date' }),
  state({ nextAttemptAt: '2026-02-30T12:00:00.000Z' }),
  state({ nextAttemptAt: '2026-11-03T12:00:00' }),
])('fails closed on an invalid or inconsistent persisted policy state: %#', (input) => {
  expect(
    planPublicationRetryAttempt(
      input,
      { mode: 'manual', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({ kind: 'invalid', reason: 'invalid-input' });
});

it.each([
  { mode: 'silently-publish', latestPublicationIntent: operationId },
  { mode: 'automatic', latestPublicationIntent: 'not-an-intent' },
  { mode: 'automatic' },
  { mode: 'manual', latestPublicationIntent: operationId, editorialRevision: 'private' },
])('rejects incomplete or wider retry commands rather than inferring a target: %#', (command) => {
  expect(planPublicationRetryAttempt(state(), command, now)).toEqual({
    kind: 'invalid',
    reason: 'invalid-input',
  });
});

it.each([undefined, { operationId, version: 0 }, { operationId, version: 1, target: 'private' }])(
  'rejects invalid outcome tokens without changing policy state: %#',
  (attempt) => {
    expect(applyPublicationRetryOutcome(state({ attempts: 1 }), attempt, 'public')).toEqual({
      kind: 'invalid',
      reason: 'invalid-input',
    });
  },
);

it('rejects an outcome outside the native receipt states', () => {
  expect(
    applyPublicationRetryOutcome(state({ attempts: 1 }), { operationId, version: 1 }, 'saved'),
  ).toEqual({ kind: 'invalid', reason: 'invalid-input' });
});

it.each([
  () => new Date(Number.NaN),
  () => {
    throw new Error('Clock unavailable; private diagnostic must not be returned.');
  },
])('cannot schedule an attempt from an invalid or failing injected clock: %#', (clock) => {
  expect(initializePublicationRetry(operationId, clock)).toEqual({
    kind: 'invalid',
    reason: 'invalid-clock',
  });
  expect(
    planPublicationRetryAttempt(
      state(),
      { mode: 'manual', latestPublicationIntent: operationId },
      clock,
    ),
  ).toEqual({ kind: 'invalid', reason: 'invalid-clock' });
});

it('refuses a due-time overflow instead of persisting an invalid timestamp', () => {
  const clock = () => new Date('9999-12-31T23:59:59.500Z');
  expect(initializePublicationRetry(operationId, clock)).toEqual({
    kind: 'invalid',
    reason: 'time-overflow',
  });
  expect(
    planPublicationRetryAttempt(
      state(),
      { mode: 'manual', latestPublicationIntent: operationId },
      clock,
    ),
  ).toEqual({ kind: 'invalid', reason: 'time-overflow' });
});

it('refuses attempt-version overflow so old outcomes can never alias a newer attempt', () => {
  expect(
    planPublicationRetryAttempt(
      state({ attempts: Number.MAX_SAFE_INTEGER }),
      { mode: 'manual', latestPublicationIntent: operationId },
      now,
    ),
  ).toEqual({ kind: 'invalid', reason: 'attempt-overflow' });
});

it('rejects an invalid new operation id instead of arming unrelated work', () => {
  expect(initializePublicationRetry('not-an-operation', now)).toEqual({
    kind: 'invalid',
    reason: 'invalid-input',
  });
});
