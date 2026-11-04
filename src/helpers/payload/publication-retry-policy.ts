import { z } from 'zod';
import { publicReceiptSchema } from './publication-receipt.schema';

// Initial operational proposal for A3, not an approved propagation guarantee.
// Each delay is anchored when the preceding attempt is durably started.
export const PUBLICATION_RETRY_PROPOSAL_DELAYS_MS = Object.freeze([1_000, 5_000, 15_000] as const);

const instantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)));
const versionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Project only these technical fields from the native outbox row. */
export const publicationRetryStateSchema = z
  .strictObject({
    operationId: publicReceiptSchema.shape.operationId,
    state: publicReceiptSchema.shape.state,
    attempts: versionSchema,
    automaticAttempts: z.number().int().min(0).max(PUBLICATION_RETRY_PROPOSAL_DELAYS_MS.length),
    nextAttemptAt: instantSchema.nullable(),
  })
  .refine((value) => value.automaticAttempts <= value.attempts)
  .refine(
    (value) =>
      value.nextAttemptAt === null ||
      (value.state === 'update-pending' &&
        value.automaticAttempts < PUBLICATION_RETRY_PROPOSAL_DELAYS_MS.length),
  );
export type PublicationRetryState = z.infer<typeof publicationRetryStateSchema>;

const commandSchema = z.strictObject({
  mode: z.enum(['immediate', 'automatic', 'manual']),
  latestPublicationIntent: publicReceiptSchema.shape.operationId.nullable(),
});
const attemptSchema = z.strictObject({
  operationId: publicReceiptSchema.shape.operationId,
  version: versionSchema.min(1),
});
export type PublicationRetryAttempt = z.infer<typeof attemptSchema>;
export type PublicationRetryClock = () => Date;
export type PublicationRetryInvalid = {
  kind: 'invalid';
  reason: 'invalid-input' | 'invalid-clock' | 'time-overflow' | 'attempt-overflow';
};
export type PublicationRetryInitialization =
  PublicationRetryInvalid | { kind: 'initialized'; state: PublicationRetryState };
export type PublicationRetryAttemptDecision =
  | PublicationRetryInvalid
  | {
      kind: 'skip';
      reason: 'terminal' | 'not-due' | 'unscheduled' | 'exhausted' | 'already-attempted';
    }
  | { kind: 'reconcile-stale'; operationId: string }
  | { kind: 'start'; state: PublicationRetryState; attempt: PublicationRetryAttempt };
export type PublicationRetryOutcomeDecision =
  | PublicationRetryInvalid
  | { kind: 'skip'; reason: 'terminal' | 'different-operation' | 'stale-outcome' }
  | { kind: 'apply'; state: PublicationRetryState };

function readClock(clock: PublicationRetryClock): number | null {
  try {
    const current = z.date().safeParse(clock());
    return current.success && instantSchema.safeParse(current.data.toISOString()).success
      ? current.data.getTime()
      : null;
  } catch {
    return null;
  }
}
function dueAfter(now: number, delay: number): string | null {
  const next = new Date(now + delay);
  if (!Number.isFinite(next.getTime())) return null;
  const iso = next.toISOString();
  return instantSchema.safeParse(iso).success ? iso : null;
}

/** Pure plan: persist this with the immutable intention in its editorial TX. */
export function initializePublicationRetry(
  operationId: unknown,
  clock: PublicationRetryClock,
): PublicationRetryInitialization {
  const parsed = publicReceiptSchema.shape.operationId.safeParse(operationId);
  if (!parsed.success) return { kind: 'invalid', reason: 'invalid-input' };
  const now = readClock(clock);
  if (now === null) return { kind: 'invalid', reason: 'invalid-clock' };
  const nextAttemptAt = dueAfter(now, PUBLICATION_RETRY_PROPOSAL_DELAYS_MS[0]);
  if (!nextAttemptAt) return { kind: 'invalid', reason: 'time-overflow' };
  return {
    kind: 'initialized',
    state: {
      operationId: parsed.data,
      state: 'update-pending',
      attempts: 0,
      automaticAttempts: 0,
      nextAttemptAt,
    },
  };
}

/**
 * Returns a proposed CAS write, not an acquired attempt or publication receipt.
 * latestPublicationIntent is the native head projection; a private draft's newer
 * editorialRevision is deliberately outside this closed input contract.
 */
export function planPublicationRetryAttempt(
  input: unknown,
  command: unknown,
  clock: PublicationRetryClock,
): PublicationRetryAttemptDecision {
  const parsed = publicationRetryStateSchema.safeParse(input);
  const options = commandSchema.safeParse(command);
  if (!parsed.success || !options.success) return { kind: 'invalid', reason: 'invalid-input' };
  const current = parsed.data;
  const { mode, latestPublicationIntent } = options.data;
  if (current.state === 'superseded') return { kind: 'skip', reason: 'terminal' };
  // Reconcile through the existing fenced coordinator. Merely dropping an old
  // intention could strand ownership from a root promotion whose SQL ACK failed.
  if (latestPublicationIntent !== current.operationId)
    return { kind: 'reconcile-stale', operationId: current.operationId };
  if (current.state === 'public') return { kind: 'skip', reason: 'terminal' };
  if (mode === 'immediate' && current.attempts !== 0)
    return { kind: 'skip', reason: 'already-attempted' };
  if (mode === 'automatic') {
    if (current.automaticAttempts === PUBLICATION_RETRY_PROPOSAL_DELAYS_MS.length)
      return { kind: 'skip', reason: 'exhausted' };
    if (current.nextAttemptAt === null) return { kind: 'skip', reason: 'unscheduled' };
  }
  const now = readClock(clock);
  if (now === null) return { kind: 'invalid', reason: 'invalid-clock' };
  if (
    mode === 'automatic' &&
    current.nextAttemptAt !== null &&
    Date.parse(current.nextAttemptAt) > now
  )
    return { kind: 'skip', reason: 'not-due' };
  if (current.attempts === Number.MAX_SAFE_INTEGER)
    return { kind: 'invalid', reason: 'attempt-overflow' };
  const automaticAttempts = mode === 'automatic' ? current.automaticAttempts + 1 : 0;
  const delay = PUBLICATION_RETRY_PROPOSAL_DELAYS_MS[automaticAttempts];
  const nextAttemptAt = delay === undefined ? null : dueAfter(now, delay);
  if (delay !== undefined && nextAttemptAt === null)
    return { kind: 'invalid', reason: 'time-overflow' };
  const version = current.attempts + 1;
  return {
    kind: 'start',
    attempt: { operationId: current.operationId, version },
    state: { ...current, attempts: version, automaticAttempts, nextAttemptAt },
  };
}

/**
 * Pure plan: outcome must come from the existing fenced coordinator. This does
 * not authorize publication or prove HTTP delivery. Caller still needs the
 * matching native pending-state/version CAS against independently read state.
 */
export function applyPublicationRetryOutcome(
  input: unknown,
  attempt: unknown,
  outcome: unknown,
): PublicationRetryOutcomeDecision {
  const current = publicationRetryStateSchema.safeParse(input);
  const started = attemptSchema.safeParse(attempt);
  const result = publicReceiptSchema.shape.state.safeParse(outcome);
  if (!current.success || !started.success || !result.success)
    return { kind: 'invalid', reason: 'invalid-input' };
  if (started.data.operationId !== current.data.operationId)
    return { kind: 'skip', reason: 'different-operation' };
  if (started.data.version !== current.data.attempts)
    return { kind: 'skip', reason: 'stale-outcome' };
  if (current.data.state !== 'update-pending') return { kind: 'skip', reason: 'terminal' };
  return {
    kind: 'apply',
    state: {
      ...current.data,
      state: result.data,
      nextAttemptAt: result.data === 'update-pending' ? current.data.nextAttemptAt : null,
    },
  };
}
