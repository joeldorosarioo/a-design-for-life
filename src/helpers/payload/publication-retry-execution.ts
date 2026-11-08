import 'server-only';
import { logger } from '../logger';
import type { PublicReceipt } from './publication-receipt.schema';
import type { PublicationRetryClaim } from './publication-retries';
import type { PublicationRetryAttempt } from './publication-retry-policy';

export async function executePublicationRetry(options: {
  current: PublicReceipt;
  claim: () => Promise<PublicationRetryClaim>;
  execute: () => Promise<PublicReceipt | null>;
  record: (attempt: PublicationRetryAttempt, receipt: PublicReceipt) => Promise<unknown>;
}): Promise<PublicReceipt> {
  const claim = await options.claim();
  const pending = { ...options.current, state: 'update-pending' as const };
  if (claim.kind === 'skip') {
    if (claim.reason !== 'terminal') return pending;
    if (options.current.state === 'superseded') return options.current;
    if (options.current.state !== 'public') return pending;
    // A terminal SQL receipt still needs the existing fenced root reproof.
    // It has no scheduled attempt token and cannot reopen the retry budget.
    return (await options.execute()) ?? pending;
  }
  const receipt = (await options.execute()) ?? pending;
  if (claim.kind === 'claimed') {
    try {
      await options.record(claim.attempt, receipt);
    } catch {
      // A confirmed core receipt stays truthful when execution metadata is down.
      logger.error({ operation: 'publication.retry.record', result: 'unavailable' });
    }
  }
  return receipt;
}
