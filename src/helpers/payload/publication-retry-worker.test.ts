import { afterEach, expect, it, vi } from 'vitest';
import { createLogger } from '../logger';
import {
  drainPublicationRetryBatch,
  startPublicationRetrySupervisor,
} from './publication-retry-worker';

afterEach(() => vi.useRealTimers());

it('executes only a bounded sequential batch and preserves progress after one execution fails', async () => {
  const events: string[] = [];
  let active = 0;
  let maximumActive = 0;
  const result = await drainPublicationRetryBatch({
    batchSize: 3,
    clock: () => new Date('2026-11-03T20:00:00.000Z'),
    loadDue: async () => [
      { operationId: 'first' },
      { operationId: 'broken' },
      { operationId: 'last' },
      { operationId: 'outside-bound' },
    ],
    process: async ({ operationId }) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      events.push(operationId);
      await Promise.resolve();
      active--;
      if (operationId === 'broken') throw new Error('synthetic executor unavailable');
    },
  });
  expect({ result, events, maximumActive }).toEqual({
    result: { selected: 3, processed: 2, failed: 1 },
    events: ['first', 'broken', 'last'],
    maximumActive: 1,
  });
});

it.each([0, -1, 1.5, NaN, 101])(
  'refuses an unbounded or invalid batch size before loading work: %s',
  async (batchSize) => {
    let loaded = false;
    await expect(
      drainPublicationRetryBatch({
        batchSize,
        clock: () => new Date(),
        loadDue: async () => {
          loaded = true;
          return [];
        },
        process: async () => {},
      }),
    ).rejects.toThrow('Invalid publication retry batch.');
    expect(loaded).toBe(false);
  },
);

it('refuses an invalid injected instant before loading due Native work', async () => {
  let loaded = false;
  await expect(
    drainPublicationRetryBatch({
      batchSize: 2,
      clock: () => new Date(NaN),
      loadDue: async () => {
        loaded = true;
        return [];
      },
      process: async () => {},
    }),
  ).rejects.toThrow('Invalid publication retry clock.');
  expect(loaded).toBe(false);
});

it('detaches the first drain, never overlaps a running drain, and stops future scheduling', async () => {
  vi.useFakeTimers();
  let drains = 0;
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const supervisor = startPublicationRetrySupervisor({
    pollIntervalMs: 20,
    drain: async () => {
      drains++;
      if (drains === 1) await first;
      return { selected: 0, processed: 0, failed: 0 };
    },
  });
  expect(drains).toBe(0);
  await vi.advanceTimersByTimeAsync(0);
  expect(drains).toBe(1);
  await vi.advanceTimersByTimeAsync(200);
  expect(drains).toBe(1);
  releaseFirst();
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(19);
  expect(drains).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(drains).toBe(2);
  await supervisor.stop();
  await vi.advanceTimersByTimeAsync(200);
  expect(drains).toBe(2);
});

it('contains detached drain failures, logs no raw errors, and tries a later bounded drain', async () => {
  vi.useFakeTimers();
  const lines: string[] = [];
  let drains = 0;
  const supervisor = startPublicationRetrySupervisor({
    pollIntervalMs: 20,
    logger: createLogger({
      write: (line) => {
        lines.push(line);
        return true;
      },
    }),
    drain: async () => {
      drains++;
      if (drains === 1)
        throw new Error('postgres://private-user:private-token@private-host/private-db');
      return { selected: 1, processed: 1, failed: 0 };
    },
  });
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(20);
  await supervisor.stop();
  expect(drains).toBe(2);
  expect(lines.map((line) => JSON.parse(line).result)).toEqual(['unavailable', 'success']);
  expect(lines.join('')).not.toMatch(/private-user|private-token|private-host|private-db/);
});

it('can stop before the detached callback without touching the application Payload pool', async () => {
  vi.useFakeTimers();
  let drains = 0;
  const supervisor = startPublicationRetrySupervisor({
    pollIntervalMs: 20,
    drain: async () => {
      drains++;
      return { selected: 0, processed: 0, failed: 0 };
    },
  });
  await supervisor.stop();
  await vi.advanceTimersByTimeAsync(100);
  expect(drains).toBe(0);
});

it('rejects a timer overflow before it can turn an intended long poll into a busy loop', () => {
  expect(() =>
    startPublicationRetrySupervisor({
      pollIntervalMs: 2_147_483_648,
      drain: async () => ({ selected: 0, processed: 0, failed: 0 }),
    }),
  ).toThrow('Invalid publication retry poll interval.');
});

it('lets a started drain settle when stopping and never starts another after settlement', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  let drains = 0;
  const running = new Promise<void>((resolve) => {
    release = resolve;
  });
  const supervisor = startPublicationRetrySupervisor({
    pollIntervalMs: 20,
    drain: async () => {
      drains++;
      await running;
      return { selected: 0, processed: 0, failed: 0 };
    },
  });
  await vi.advanceTimersByTimeAsync(0);
  let settled = false;
  const stopped = supervisor.stop().then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  release();
  await stopped;
  await vi.advanceTimersByTimeAsync(100);
  expect({ drains, settled }).toEqual({ drains: 1, settled: true });
});
