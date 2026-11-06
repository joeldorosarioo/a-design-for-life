import 'server-only';
import { logger as defaultLogger } from '../logger';

export type PublicationRetryCandidate = { operationId: string };
export type PublicationRetryBatch = { selected: number; processed: number; failed: number };
export type PublicationRetryBatchOptions<T extends PublicationRetryCandidate> = {
  batchSize: number;
  clock: () => Date;
  loadDue: (limit: number, now: Date) => Promise<T[]>;
  process: (candidate: T) => Promise<void>;
};
export function startPublicationRetrySupervisor(options: {
  pollIntervalMs: number;
  drain: () => Promise<PublicationRetryBatch>;
  logger?: Pick<typeof import('../logger').logger, 'info' | 'error'>;
}) {
  if (
    !Number.isSafeInteger(options.pollIntervalMs) ||
    options.pollIntervalMs < 1 ||
    options.pollIntervalMs > 2_147_483_647
  )
    throw new Error('Invalid publication retry poll interval.');
  const logger = options.logger ?? defaultLogger;
  let stopped = false;
  let active: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule(delay: number) {
    timer = setTimeout(() => {
      timer = undefined;
      active = Promise.resolve()
        .then(options.drain)
        .then((batch) => {
          if (batch.selected)
            logger.info({
              operation: 'publication.retry.worker',
              result: batch.failed ? 'unavailable' : 'success',
              context: batch,
            });
        })
        .catch(() => {
          logger.error({ operation: 'publication.retry.worker', result: 'unavailable' });
        })
        .finally(() => {
          active = undefined;
          if (!stopped) schedule(options.pollIntervalMs);
        });
    }, delay);
    timer.unref();
  }
  // Registration only schedules a callback: no application/DB initialization here.
  schedule(0);
  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await active;
    },
  };
}

export async function drainPublicationRetryBatch<T extends PublicationRetryCandidate>(
  options: PublicationRetryBatchOptions<T>,
): Promise<PublicationRetryBatch> {
  if (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 100)
    throw new Error('Invalid publication retry batch.');
  const now = options.clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error('Invalid publication retry clock.');
  const candidates = (await options.loadDue(options.batchSize, now)).slice(0, options.batchSize);
  const result = { selected: candidates.length, processed: 0, failed: 0 };
  for (const candidate of candidates) {
    try {
      await options.process(candidate);
      result.processed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
