import { afterEach, expect, it, vi } from 'vitest';
import { startPublicationRetryWorker } from './publication-worker';

afterEach(() => vi.useRealTimers());

it('does no application initialization when the operational worker flag is off', async () => {
  vi.useFakeTimers();
  let initialized = 0;
  const worker = startPublicationRetryWorker({
    enabled: false,
    metadataEnabled: true,
    drain: async () => {
      initialized++;
      return { selected: 0, processed: 0, failed: 0 };
    },
  });
  await vi.advanceTimersByTimeAsync(100);
  expect({ worker, initialized }).toEqual({ worker: null, initialized: 0 });
});

it('refuses worker registration without migrated metadata before initializing the application', () => {
  let initialized = 0;
  expect(() =>
    startPublicationRetryWorker({
      enabled: true,
      metadataEnabled: false,
      drain: async () => {
        initialized++;
        return { selected: 0, processed: 0, failed: 0 };
      },
    }),
  ).toThrow('Publication retry worker requires enabled retry metadata.');
  expect(initialized).toBe(0);
});

it('returns from opt-in registration before any detached application initialization', async () => {
  vi.useFakeTimers();
  let initialized = 0;
  const worker = startPublicationRetryWorker({
    enabled: true,
    metadataEnabled: true,
    pollIntervalMs: 20,
    drain: async () => {
      initialized++;
      return { selected: 0, processed: 0, failed: 0 };
    },
  });
  expect(initialized).toBe(0);
  await vi.advanceTimersByTimeAsync(0);
  expect(initialized).toBe(1);
  await worker?.stop();
});
