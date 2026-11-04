import { expect, it } from 'vitest';
import { executePublicationRetry } from './publication-retry-execution';
import type { PublicationRetryClaim } from './publication-retries';

const operationId = 'dd9d83e0-5c64-4ac4-99ea-7f71a4c01a9a';
const targetRevision = '8ad9f199-38fc-45e3-84a5-5d04ac5c3c47';
const current = { operationId, targetRevision, state: 'update-pending' as const };
const published = { ...current, state: 'public' as const };
const attempt = { operationId, version: 2 };
const claim: PublicationRetryClaim = {
  kind: 'claimed',
  attempt,
  retry: {
    id: '28f6de34-a124-496c-b6d5-af3bcd220e0d',
    operationId,
    retryUserId: '0282ca23-3c0b-447e-81c7-c66389e677ab',
    startedAttemptsVersion: 2,
    automaticAttempts: 1,
    nextAttemptAt: '2026-11-03T20:00:05.000Z',
  },
};

it('executes once after the durable claim and records only that started token with the core receipt', async () => {
  const events: unknown[] = [];
  const receipt = await executePublicationRetry({
    current,
    claim: async () => {
      events.push('claim');
      return claim;
    },
    execute: async () => {
      events.push('execute');
      return published;
    },
    record: async (token, confirmed) => {
      events.push({ token, confirmed });
    },
  });
  expect({ receipt, events }).toEqual({
    receipt: published,
    events: ['claim', 'execute', { token: attempt, confirmed: published }],
  });
});

it('leaves an ineligible attempt pending without executing a target or recording an outcome', async () => {
  let executions = 0;
  let recordings = 0;
  const receipt = await executePublicationRetry({
    current,
    claim: async () => ({ kind: 'skip', reason: 'not-due' }),
    execute: async () => {
      executions++;
      return published;
    },
    record: async () => {
      recordings++;
    },
  });
  expect({ receipt, executions, recordings }).toEqual({
    receipt: current,
    executions: 0,
    recordings: 0,
  });
});

it('uses existing stale reconciliation without allocating or recording an invented attempt', async () => {
  let recordings = 0;
  const superseded = { ...current, state: 'superseded' as const };
  const receipt = await executePublicationRetry({
    current,
    claim: async () => ({ kind: 'reconcile-stale', operationId }),
    execute: async () => superseded,
    record: async () => {
      recordings++;
    },
  });
  expect({ receipt, recordings }).toEqual({ receipt: superseded, recordings: 0 });
});

it('preserves an actual public receipt if independent execution-metadata recording fails afterward', async () => {
  expect(
    await executePublicationRetry({
      current,
      claim: async () => claim,
      execute: async () => published,
      record: async () => {
        throw new Error('synthetic metadata unavailable');
      },
    }),
  ).toEqual(published);
});
