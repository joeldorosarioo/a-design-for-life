import 'server-only';
import { APIError, createLocalReq, Forbidden, type PayloadRequest } from 'payload';
import { z } from 'zod';
import type { PublicationRetry, PublicationUpdate } from '@/payload-types';
import { publicReceiptSchema, type PublicReceipt } from './publication-receipt.schema';
import {
  applyPublicationRetryOutcome,
  initializePublicationRetry,
  planPublicationRetryAttempt,
  type PublicationRetryAttempt,
  type PublicationRetryClock,
} from './publication-retry-policy';
import { requirePublicationTransaction } from './publication-coordinator';

/** Execution metadata only. Outbox state/target remain the publication authority. */
export type PersistedPublicationRetry = Required<
  Pick<
    PublicationRetry,
    | 'id'
    | 'operationId'
    | 'retryUserId'
    | 'startedAttemptsVersion'
    | 'automaticAttempts'
    | 'nextAttemptAt'
  >
>;
type SkipReason =
  | 'manual-only'
  | 'not-due'
  | 'unscheduled'
  | 'exhausted'
  | 'terminal'
  | 'already-attempted'
  | 'contended'
  | 'missing-operation'
  | 'missing-schedule'
  | 'stale-outcome'
  | 'different-operation'
  | 'not-confirmed';
export type PublicationRetryClaim =
  | { kind: 'claimed'; attempt: PublicationRetryAttempt; retry: PersistedPublicationRetry }
  | { kind: 'reconcile-stale'; operationId: string }
  | { kind: 'skip'; reason: SkipReason };
export type PublicationRetryRecorded =
  { kind: 'recorded'; retry: PersistedPublicationRetry } | { kind: 'skip'; reason: SkipReason };

type Operation = Pick<
  PublicationUpdate,
  'id' | 'operationId' | 'subjectCollection' | 'subjectId' | 'targetRevision' | 'state'
>;
const attemptSchema = z.strictObject({
  operationId: publicReceiptSchema.shape.operationId,
  version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
function requireEditor(req: PayloadRequest) {
  if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
  return req.user;
}
function unavailable(): never {
  throw new APIError('Publication retry metadata unavailable.', 503, undefined, true);
}
async function readOperation(operationId: string, req: PayloadRequest) {
  return req.payload.db.findOne<Operation>({
    collection: 'publication-updates',
    where: { operationId: { equals: publicReceiptSchema.shape.operationId.parse(operationId) } },
    select: {
      id: true,
      operationId: true,
      subjectCollection: true,
      subjectId: true,
      targetRevision: true,
      state: true,
    },
    req,
  });
}
function project(row: PublicationRetry): PersistedPublicationRetry {
  return {
    id: row.id,
    operationId: row.operationId,
    retryUserId: row.retryUserId ?? null,
    startedAttemptsVersion: row.startedAttemptsVersion,
    automaticAttempts: row.automaticAttempts,
    nextAttemptAt: row.nextAttemptAt ?? null,
  };
}
async function metadata(operationId: string, req: PayloadRequest) {
  const row = await req.payload.db.findOne<PublicationRetry>({
    collection: 'publication-retries',
    where: { operationId: { equals: operationId } },
    req,
  });
  return row ? project(row) : null;
}
function policyState(operation: Operation, retry: PersistedPublicationRetry | null) {
  return {
    operationId: operation.operationId,
    state: operation.state,
    attempts: retry?.startedAttemptsVersion ?? 0,
    automaticAttempts: retry?.automaticAttempts ?? 0,
    nextAttemptAt: operation.state === 'update-pending' ? (retry?.nextAttemptAt ?? null) : null,
  };
}
async function actualEditor(req: PayloadRequest) {
  const user = requireEditor(req);
  await req.payload.findByID({
    collection: 'users',
    id: user.id,
    select: { email: true },
    depth: 0,
    overrideAccess: false,
    req,
  });
  return user;
}
async function independentEditor(req: PayloadRequest) {
  const user = requireEditor(req);
  if (await req.transactionID)
    throw new APIError('Retry execution requires an independent committed request.', 400);
  const fresh = await createLocalReq({ user }, req.payload);
  await actualEditor(fresh);
  return fresh;
}
async function subjectHead(operation: Operation, req: PayloadRequest) {
  const head = await req.payload.db.findOne<{
    id: string;
    latestPublicationIntent?: string | null;
  }>({
    collection: operation.subjectCollection,
    where: { id: { equals: operation.subjectId } },
    select: { id: true, latestPublicationIntent: true },
    req,
  });
  // Absence cannot grant a target: the existing coordinator only reconciles it.
  // An existing head still passes actual Native access; do not catch a denied404.
  if (!head) return null;
  await req.payload.findByID({
    collection: operation.subjectCollection,
    id: operation.subjectId,
    select: { updatedAt: true },
    depth: 0,
    overrideAccess: false,
    trash: true,
    req,
  });
  return head;
}

/** Execution metadata is created with its intention in the caller's native TX. */
export async function schedulePublicationRetry(
  operationId: string,
  req: PayloadRequest,
  clock: PublicationRetryClock,
): Promise<PersistedPublicationRetry | null> {
  await requirePublicationTransaction(req);
  const user = await actualEditor(req);
  const operation = await readOperation(operationId, req);
  if (!operation) return unavailable();
  const existing = await metadata(operationId, req);
  if (existing) return existing;
  const initialized = initializePublicationRetry(operationId, clock);
  if (initialized.kind !== 'initialized') return unavailable();
  const row = (await req.payload.db.create({
    collection: 'publication-retries',
    data: {
      operationId,
      retryUserId: String(user.id),
      startedAttemptsVersion: 0,
      automaticAttempts: 0,
      nextAttemptAt: initialized.state.nextAttemptAt,
    },
    req,
  })) as PublicationRetry;
  return project(row);
}
export async function readPublicationRetry(
  operationId: string,
  req: PayloadRequest,
): Promise<PersistedPublicationRetry | null> {
  requireEditor(req);
  return metadata(publicReceiptSchema.shape.operationId.parse(operationId), req);
}
export async function claimPublicationRetry(
  operationId: string,
  command: { mode: 'immediate' | 'automatic' | 'manual' },
  req: PayloadRequest,
  clock: PublicationRetryClock,
): Promise<PublicationRetryClaim> {
  const fresh = await independentEditor(req);
  const user = requireEditor(fresh);
  const operation = await readOperation(operationId, fresh);
  if (!operation) return { kind: 'skip', reason: 'missing-operation' };
  const head = await subjectHead(operation, fresh);
  let retry = await metadata(operationId, fresh);
  if (command.mode !== 'manual' && !retry?.retryUserId)
    return { kind: 'skip', reason: 'manual-only' };
  if (command.mode === 'automatic' && retry?.retryUserId !== String(user.id))
    throw new Forbidden(req.t);
  const planned = planPublicationRetryAttempt(
    policyState(operation, retry),
    { mode: command.mode, latestPublicationIntent: head?.latestPublicationIntent ?? null },
    clock,
  );
  if (planned.kind === 'invalid') return unavailable();
  if (planned.kind !== 'start') return planned;
  if (!retry) {
    // Legacy absence never binds an actor until an actual editor manually retries.
    try {
      retry = project(
        (await req.payload.db.create({
          collection: 'publication-retries',
          data: {
            operationId,
            retryUserId: null,
            startedAttemptsVersion: 0,
            automaticAttempts: 0,
            nextAttemptAt: null,
          },
          req: fresh,
        })) as PublicationRetry,
      );
    } catch {
      retry = await metadata(operationId, fresh);
      if (!retry) return unavailable();
    }
  }
  const claimed = (await req.payload.db.updateOne({
    collection: 'publication-retries',
    options: { atomic: true },
    where: {
      and: [
        { id: { equals: retry.id } },
        { operationId: { equals: operationId } },
        { startedAttemptsVersion: { equals: planned.attempt.version - 1 } },
      ],
    },
    data: {
      retryUserId: command.mode === 'automatic' ? retry.retryUserId : String(user.id),
      startedAttemptsVersion: planned.attempt.version,
      automaticAttempts: planned.state.automaticAttempts,
      nextAttemptAt: planned.state.nextAttemptAt,
    },
    req: fresh,
  })) as PublicationRetry | null;
  return claimed
    ? { kind: 'claimed', attempt: planned.attempt, retry: project(claimed) }
    : { kind: 'skip', reason: 'contended' };
}
export async function recordPublicationRetryOutcome(
  input: { attempt: PublicationRetryAttempt; receipt: PublicReceipt },
  req: PayloadRequest,
): Promise<PublicationRetryRecorded> {
  const fresh = await independentEditor(req);
  const attempt = attemptSchema.parse(input.attempt);
  const receipt = publicReceiptSchema.parse(input.receipt);
  if (attempt.operationId !== receipt.operationId)
    return { kind: 'skip', reason: 'different-operation' };
  const operation = await readOperation(attempt.operationId, fresh);
  if (!operation) return { kind: 'skip', reason: 'missing-operation' };
  await subjectHead(operation, fresh);
  const retry = await metadata(attempt.operationId, fresh);
  if (!retry) return { kind: 'skip', reason: 'missing-schedule' };
  if (retry.startedAttemptsVersion !== attempt.version)
    return { kind: 'skip', reason: 'stale-outcome' };
  if (receipt.targetRevision !== operation.targetRevision || receipt.state !== operation.state)
    return { kind: 'skip', reason: 'not-confirmed' };
  const planned = applyPublicationRetryOutcome(
    policyState(operation, retry),
    attempt,
    receipt.state,
  );
  if (planned.kind === 'invalid') return unavailable();
  if (planned.kind === 'skip' && planned.reason !== 'terminal') return planned;
  const saved = (await req.payload.db.updateOne({
    collection: 'publication-retries',
    options: { atomic: true },
    where: {
      and: [
        { id: { equals: retry.id } },
        { operationId: { equals: attempt.operationId } },
        { startedAttemptsVersion: { equals: attempt.version } },
      ],
    },
    // Outbox owns the state. This write can only maintain or clear execution due.
    data: { nextAttemptAt: operation.state === 'update-pending' ? retry.nextAttemptAt : null },
    req: fresh,
  })) as PublicationRetry | null;
  return saved
    ? { kind: 'recorded', retry: project(saved) }
    : { kind: 'skip', reason: 'stale-outcome' };
}
