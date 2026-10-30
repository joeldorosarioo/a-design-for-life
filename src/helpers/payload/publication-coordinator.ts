import 'server-only';
import { createLocalReq, Forbidden, type PayloadRequest } from 'payload';
import { withPublicRootWriter, type PublicRoot } from './public-root';
import type { PublicationUpdate } from '@/payload-types';
import type { PublicReceipt } from './publication-receipt.schema';
export type { PublicReceipt } from './publication-receipt.schema';
export type PublicationCoordinatorOptions = {
  directory: string;
  compose: (root: PublicRoot | null, operation: PublicationUpdate) => Promise<PublicRoot>;
  reconcile?: (
    root: PublicRoot,
    operation: PublicationUpdate,
    req: PayloadRequest,
    options: { retirePending: boolean },
  ) => Promise<void>;
  beforePromote?: (operation: PublicationUpdate) => Promise<void>;
};
export async function requirePublicationTransaction(req: PayloadRequest) {
  const transactionID = await req.transactionID;
  const adapter = req.payload.db as unknown as { sessions?: Record<string, { db?: unknown }> };
  if (!transactionID || !adapter.sessions?.[String(transactionID)]?.db)
    throw new Error('An active native publication transaction is required.');
}
export function createPublicationCoordinator(options: PublicationCoordinatorOptions) {
  return {
    directory: options.directory,
    async retry(operationId: string, req: PayloadRequest): Promise<PublicReceipt | null> {
      if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
      // Never inherit the caller's transaction. Only independently visible,
      // committed outbox rows can reach the filesystem writer.
      const fresh = await createLocalReq({ user: req.user }, req.payload);
      const operation = (await req.payload.db.findOne({
        collection: 'publication-updates',
        where: { operationId: { equals: operationId } },
        req: fresh,
      })) as PublicationUpdate | null;
      if (!operation) return null;
      const pending: PublicReceipt = {
        operationId,
        targetRevision: operation.targetRevision,
        state: 'update-pending',
      };
      try {
        await options.beforePromote?.(operation);
        await withPublicRootWriter(options.directory, async (root, commit) => {
          const transactionID = await req.payload.db.beginTransaction();
          if (!transactionID) throw new Error('Publication transaction unavailable.');
          fresh.transactionID = transactionID;
          try {
            await requirePublicationTransaction(fresh);
            const head = await req.payload.db.updateOne({
              collection: operation.subjectCollection,
              req: fresh,
              options: { atomic: true },
              where: {
                and: [
                  { id: { equals: operation.subjectId } },
                  { latestPublicationIntent: { equals: operationId } },
                ],
              },
              data: { latestPublicationIntent: operationId },
            });
            const subjectKey = `${operation.subjectCollection}/${operation.subjectId}`;
            if (!head) {
              // Failed old-intent CAS does not lock a newer head. Lock that head
              // before reconciling ownership, using a same-value CAS that changes
              // neither body revision nor editorial lease.
              const current = (await req.payload.db.findOne({
                collection: operation.subjectCollection,
                req: fresh,
                where: { id: { equals: operation.subjectId } },
              })) as { latestPublicationIntent?: string | null } | null;
              if (current) {
                const locked = await req.payload.db.updateOne({
                  collection: operation.subjectCollection,
                  req: fresh,
                  options: { atomic: true },
                  where: {
                    and: [
                      { id: { equals: operation.subjectId } },
                      {
                        latestPublicationIntent: {
                          equals: current.latestPublicationIntent ?? null,
                        },
                      },
                    ],
                  },
                  data: { latestPublicationIntent: current.latestPublicationIntent ?? null },
                });
                if (!locked) throw new Error('Publication head moved during reconciliation.');
              }
              const confirmedEntry = root?.subjects[subjectKey];
              if (root && confirmedEntry) {
                const confirmedOperation = (await req.payload.db.findOne({
                  collection: 'publication-updates',
                  req: fresh,
                  where: { operationId: { equals: confirmedEntry.operationId } },
                })) as PublicationUpdate | null;
                if (!confirmedOperation) throw new Error('Confirmed operation unavailable.');
                // The filesystem may have committed while SQL acknowledgement failed.
                // Persist its ownership before retiring any obsolete intent, retaining
                // every newer pending revision's media pins.
                await options.reconcile?.(root, confirmedOperation, fresh, {
                  retirePending: false,
                });
              }
              await req.payload.db.updateOne({
                collection: 'publication-updates',
                req: fresh,
                options: { atomic: true },
                where: { id: { equals: operation.id } },
                data: { state: 'superseded', attempts: operation.attempts + 1, diagnostic: null },
              });
            } else {
              let confirmed = root;
              if (root?.subjects[subjectKey]?.operationId !== operationId) {
                confirmed = await options.compose(root, operation);
                await requirePublicationTransaction(fresh);
                await commit(confirmed);
              }
              if (!confirmed) throw new Error('Public root unavailable.');
              await requirePublicationTransaction(fresh);
              const older = await req.payload.db.find({
                collection: 'publication-updates',
                req: fresh,
                where: {
                  and: [
                    { subjectCollection: { equals: operation.subjectCollection } },
                    { subjectId: { equals: operation.subjectId } },
                    { operationId: { not_equals: operationId } },
                    { state: { equals: 'update-pending' } },
                  ],
                },
                pagination: false,
                limit: 0,
              });
              for (const prior of older.docs)
                await req.payload.db.updateOne({
                  collection: 'publication-updates',
                  req: fresh,
                  options: { atomic: true },
                  where: { id: { equals: prior.id } },
                  data: { state: 'superseded' },
                });
              await options.reconcile?.(confirmed, operation, fresh, { retirePending: true });
              await req.payload.db.updateOne({
                collection: operation.subjectCollection,
                req: fresh,
                options: { atomic: true },
                where: {
                  and: [
                    { id: { equals: operation.subjectId } },
                    { latestPublicationIntent: { equals: operationId } },
                  ],
                },
                data: {
                  publicConfirmed:
                    head._status === 'published' &&
                    head.contentRevision === operation.targetRevision,
                },
              });
              await req.payload.db.updateOne({
                collection: 'publication-updates',
                req: fresh,
                options: { atomic: true },
                where: { id: { equals: operation.id } },
                data: { state: 'public', attempts: operation.attempts + 1, diagnostic: null },
              });
            }
            await req.payload.db.commitTransaction(transactionID);
          } catch (error) {
            await req.payload.db.rollbackTransaction(transactionID);
            throw error;
          } finally {
            delete fresh.transactionID;
          }
        });
        // Native commit may swallow adapter errors. Receipt requires independent
        // read-back, never merely resolution of commitTransaction().
        const stored = (await req.payload.db.findOne({
          collection: 'publication-updates',
          where: { operationId: { equals: operationId } },
          req: fresh,
        })) as PublicationUpdate | null;
        return stored ? { ...pending, state: stored.state } : pending;
      } catch {
        try {
          await req.payload.db.updateOne({
            collection: 'publication-updates',
            req: fresh,
            options: { atomic: true },
            where: {
              and: [{ id: { equals: operation.id } }, { state: { equals: 'update-pending' } }],
            },
            data: { diagnostic: 'Public update pending. Retry safely.' },
          });
        } catch {
          /* Persisted pending state already survives an origin outage. */
        }
        return pending;
      }
    },
  };
}
