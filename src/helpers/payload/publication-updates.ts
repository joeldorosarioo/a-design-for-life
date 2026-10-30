import type { PublicRoot } from './public-root';
import type { PublicationUpdate, Case } from '@/payload-types';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { APIError, Forbidden, type PayloadRequest, type Where } from 'payload';
import { z } from 'zod';
export const publicationSubjectSchema = z.object({
  collection: z.enum(['cases', 'case-content', 'site-navigation', 'professional-profiles']),
  id: z.uuid(),
});
export type PublicationSubject = z.infer<typeof publicationSubjectSchema>;
export type PublicationTarget = {
  value: z.infer<ReturnType<typeof z.json>>;
  dependencies: string[];
};
export type PublicationAdapter = {
  shared?: boolean;
  legacyWhere?: (req: PayloadRequest) => Promise<Where>;
  prepareLegacy?: (
    document: Record<string, unknown>,
    req: PayloadRequest,
  ) => Promise<PublicationTarget>;
  shouldPublish?: (
    document: Record<string, unknown>,
    previous: Record<string, unknown> | undefined,
  ) => boolean;
  reconcile?: (
    root: PublicRoot,
    operation: PublicationUpdate,
    req: PayloadRequest,
    options: { retirePending: boolean },
  ) => Promise<void>;
  apply?: (
    root: PublicRoot | null,
    operation: PublicationUpdate,
  ) => z.infer<ReturnType<typeof z.json>>;
  prepare: (
    document: Record<string, unknown>,
    published: boolean,
    req: PayloadRequest,
  ) => Promise<PublicationTarget>;
};
export async function enqueuePublicationUpdate(
  input: {
    subject: PublicationSubject;
    targetRevision: string;
    dependencies: string[];
    target: z.infer<ReturnType<typeof z.json>>;
  },
  req: PayloadRequest,
): Promise<{ operationId: string }> {
  if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
  if (!req.transactionID)
    throw new APIError('Publication requires the editorial transaction.', 400);
  const subject = publicationSubjectSchema.parse(input.subject);
  const operationId = randomUUID();
  await req.payload.db.create({
    collection: 'publication-updates',
    req,
    data: {
      operationId,
      subjectCollection: subject.collection,
      subjectId: subject.id,
      targetRevision: z.uuid().parse(input.targetRevision),
      target: z.json().parse(input.target),
      dependencies: z.string().array().parse(input.dependencies),
      state: 'update-pending',
      attempts: 0,
    },
  });
  await req.payload.db.updateOne({
    collection: subject.collection,
    req,
    options: { atomic: true },
    where: { id: { equals: subject.id } },
    data: { latestPublicationIntent: operationId, publicConfirmed: false },
  });
  return { operationId };
}

import { createLocalReq } from 'payload';
import { runtimePublication } from './publication-runtime';
import type { PublicReceipt } from './publication-coordinator';
import type { Result } from './editorial-result.schema';
import { readPublicRoot } from './public-root';
export async function retryPublicationUpdate(
  operationId: string,
  req: PayloadRequest,
): Promise<Result<PublicReceipt>> {
  if (!req.user || req.user.collection !== 'users')
    return {
      ok: false,
      error: { code: 'forbidden', message: 'Editorial authentication required.' },
    };
  let pending: PublicReceipt | undefined;
  const unavailable = (): Result<PublicReceipt> => ({
    ok: false,
    error: { code: 'unavailable', message: 'Committed publication operation unavailable.' },
  });
  try {
    const fresh = await createLocalReq({ user: req.user }, req.payload);
    const operation = (await req.payload.db.findOne({
      collection: 'publication-updates',
      where: { operationId: { equals: operationId } },
      req: fresh,
    })) as PublicationUpdate | null;
    if (!operation) return unavailable();
    // Only this independent read proves that an immutable intent committed.
    // Later dependency/root/second-read failures retain its recoverable receipt.
    pending = { operationId, targetRevision: operation.targetRevision, state: 'update-pending' };
    const coordinator = runtimePublication();
    // Initial ordering is a distinct approved shared-case intent. Confirming it
    // never publishes any translation or reads an unpublished content body.
    if (operation.subjectCollection === 'case-content') {
      const target = operation.target as { caseId?: string };
      const root = await readPublicRoot(coordinator.directory);
      if (target.caseId && !root?.subjects[`cases/${target.caseId}`]) {
        const shared = (await req.payload.db.findOne({
          collection: 'cases',
          where: { id: { equals: target.caseId } },
          req: fresh,
        })) as Case | null;
        if (shared?.latestPublicationIntent)
          await coordinator.retry(String(shared.latestPublicationIntent), fresh);
      }
    }
    const receipt = await coordinator.retry(operationId, fresh);
    return { ok: true, value: receipt ?? pending };
  } catch {
    return pending ? { ok: true, value: pending } : unavailable();
  }
}
