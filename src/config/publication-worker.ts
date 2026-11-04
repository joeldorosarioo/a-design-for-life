import 'server-only';
import { createLocalReq, NotFound, type Payload, type Where } from 'payload';
import path from 'node:path';
import type { PublicationRetry, PublicationUpdate } from '../payload-types';
import {
  drainPublicationRetryBatch,
  startPublicationRetrySupervisor,
  type PublicationRetryBatch,
} from '../helpers/payload/publication-retry-worker';
import { withPublicationWriter } from '../helpers/payload/publication-writer';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { publicRootDirectory } from '../helpers/payload/public-root-directory';
import { runtimePayload } from '../helpers/payload/runtime';
import { readServerEnv } from './server-env';

export function startPublicationRetryWorker(options: {
  enabled: boolean;
  metadataEnabled: boolean;
  drain: () => Promise<PublicationRetryBatch>;
  pollIntervalMs?: number;
}) {
  if (!options.enabled) return null;
  if (!options.metadataEnabled)
    throw new Error('Publication retry worker requires enabled retry metadata.');
  return startPublicationRetrySupervisor({
    drain: options.drain,
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
  });
}

const workerKey = Symbol.for('a-design-for-life.publication-retry-worker');
const processWorker = globalThis as typeof globalThis & {
  [workerKey]?: ReturnType<typeof startPublicationRetryWorker>;
};

/** Registers one detached worker in the process that owns the publication fence. */
export function registerRuntimePublicationRetryWorker() {
  const env = readServerEnv(process.env);
  if (env.PUBLICATION_RETRY_WORKER_ENABLED !== 'true') return;
  processWorker[workerKey] ??= startPublicationRetryWorker({
    enabled: true,
    metadataEnabled: env.PUBLICATION_RETRIES_ENABLED === 'true',
    drain: createPublicationRetryDrain({
      payload: runtimePayload,
      directory: publicRootDirectory(env),
    }),
  });
}

export type NativePublicationRetryDrainOptions = {
  payload: () => Promise<Payload>;
  directory: string;
  clock?: () => Date;
  batchSize?: number;
};

export function createPublicationRetryDrain(options: NativePublicationRetryDrainOptions) {
  const clock = options.clock ?? (() => new Date());
  const directory = path.resolve(options.directory);
  const identity = `publication-retry-drain:${process.platform === 'win32' ? directory.toLowerCase() : directory}`;
  let cursor: { at: string; id: string } | undefined;
  return async (): Promise<PublicationRetryBatch> =>
    withPublicationWriter(identity, async () => {
      const payload = await options.payload();
      if (!Object.hasOwn(payload.collections, 'publication-retries'))
        throw new Error('Publication retry metadata is not registered.');
      async function maintain(retry: PublicationRetry, manualOnly = false) {
        const operation = await payload.db.findOne<Pick<PublicationUpdate, 'id' | 'state'>>({
          collection: 'publication-updates',
          where: { operationId: { equals: retry.operationId } },
          select: { id: true, state: true },
        });
        if (operation?.state === 'update-pending' && !manualOnly) return false;
        await payload.db.updateOne({
          collection: 'publication-retries',
          options: { atomic: true },
          where: {
            and: [
              { id: { equals: retry.id } },
              { operationId: { equals: retry.operationId } },
              { startedAttemptsVersion: { equals: retry.startedAttemptsVersion } },
              { nextAttemptAt: { equals: retry.nextAttemptAt ?? null } },
            ],
          },
          // Never write visibility or invent an attempt for terminal version0 rows.
          data: { nextAttemptAt: null },
        });
        return true;
      }
      return drainPublicationRetryBatch({
        batchSize: options.batchSize ?? 20,
        clock,
        loadDue: async (limit, now) => {
          const due: Where = { nextAttemptAt: { less_than_equal: now.toISOString() } };
          async function read(after?: { at: string; id: string }) {
            const found = await payload.db.find<PublicationRetry>({
              collection: 'publication-retries',
              where: after
                ? {
                    and: [
                      due,
                      {
                        or: [
                          { nextAttemptAt: { greater_than: after.at } },
                          {
                            and: [
                              { nextAttemptAt: { equals: after.at } },
                              { id: { greater_than: after.id } },
                            ],
                          },
                        ],
                      },
                    ],
                  }
                : due,
              sort: ['nextAttemptAt', 'id'],
              pagination: false,
              limit,
            });
            return found.docs.slice(0, limit);
          }
          let rows = await read(cursor);
          if (!rows.length && cursor) {
            cursor = undefined;
            rows = await read();
          }
          const last = rows.at(-1);
          if (last?.nextAttemptAt) cursor = { at: last.nextAttemptAt, id: last.id };
          return rows;
        },
        process: async (retry) => {
          if (await maintain(retry, !retry.retryUserId)) return;
          // This is a real stored account, never a fabricated worker/admin user.
          const user = await payload
            .findByID({
              collection: 'users',
              id: retry.retryUserId!,
              depth: 0,
              overrideAccess: true,
            })
            .catch(async (error: unknown) => {
              if (!(error instanceof NotFound)) throw error;
              await maintain(retry, true);
              return null;
            });
          if (!user) return;
          const req = await createLocalReq({ user: { ...user, collection: 'users' } }, payload);
          // The orchestrator alone claims; preclaiming here would spend twice.
          const result = await retryPublicationUpdate(retry.operationId, req, {
            mode: 'automatic',
            clock,
          });
          if (!result.ok) throw new Error('Publication retry execution unavailable.');
          // Stale reconciliation may settle version0 without a claim token.
          await maintain(retry);
        },
      });
    });
}
