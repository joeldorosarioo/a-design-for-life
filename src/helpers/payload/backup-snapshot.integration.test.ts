import path from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import { inspectOwnedTestDatabase } from '../../../testing/setup/owned-test-database';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Payload } from 'payload';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import { runtimePublication } from './publication-runtime';
import { withNativeBackupSnapshot } from './backup-snapshot';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('default');
  registerOwnedPayload(fixture.payload);
});
function nativeSessionIds() {
  const sessions = fixture.payload.db.sessions;
  if (!sessions) throw new Error('Native PostgreSQL sessions unavailable');
  return Object.keys(sessions).sort();
}
function persistProofMetadata(value: unknown) {
  const directory = path.resolve('docs/verification/artifacts/E3-backup');
  mkdirSync(directory, { recursive: true });
  const runId = process.env.ADFL_TEST_RUN_ID;
  if (!/^[a-f0-9-]{36}$/.test(runId ?? '')) throw new Error('Owned proof run identity unavailable');
  appendFileSync(
    path.join(directory, `native-foundations-proof-${runId}.jsonl`),
    JSON.stringify(value) + '\n',
    { mode: 0o600 },
  );
}
type OwnedClient = { release: () => void };
type OwnedPool = PostgresAdapter['pool'] & {
  _clients: OwnedClient[];
  _idle: { client: OwnedClient }[];
  _pendingQueue: unknown[];
};
const ownedPools = new Map<
  Payload,
  { pool: OwnedPool; bootstrap: OwnedClient; containerId: string }
>();
function registerOwnedPayload(payload: Payload) {
  const owned = inspectOwnedTestDatabase();
  persistProofMetadata({
    event: 'backup-proof-owned-resource',
    containerId: owned.containerId,
    networkId: owned.networkId,
    runId: process.env.ADFL_TEST_RUN_ID,
  });
  const pool = payload.db.pool as OwnedPool;
  if (!pool._clients?.[0] || pool._pendingQueue?.length !== 0)
    throw new Error('Unexpected owned native fixture pool initialization');
  ownedPools.set(payload, { pool, bootstrap: pool._clients[0], containerId: owned.containerId });
}
async function closeOwnedPayload(payload: Payload) {
  const owned = ownedPools.get(payload);
  if (
    !owned ||
    payload.db.pool !== owned.pool ||
    inspectOwnedTestDatabase().containerId !== owned.containerId ||
    Object.keys(payload.db.sessions ?? {}).length !== 0 ||
    owned.pool.waitingCount !== 0 ||
    owned.pool._pendingQueue.length !== 0
  )
    throw new Error('Refusing cleanup of an unowned or active native fixture pool');
  const borrowed = owned.pool._clients.filter(
    (client) => !owned.pool._idle.some((item) => item.client === client),
  );
  if (
    borrowed.length !== 1 ||
    borrowed[0] !== owned.bootstrap ||
    typeof owned.bootstrap.release !== 'function'
  )
    throw new Error('Expected only the owned adapter3.92.1 bootstrap checkout');
  await payload.destroy();
  // No outstanding SQL/session remains. Recheck exact owned identity synchronously
  // before returning the adapter connect.js bootstrap client and ending its pool.
  if (
    payload.db.pool !== owned.pool ||
    Object.keys(payload.db.sessions ?? {}).length !== 0 ||
    owned.pool.waitingCount !== 0 ||
    owned.pool._pendingQueue.length !== 0 ||
    owned.pool._clients.filter((client) => !owned.pool._idle.some((item) => item.client === client))
      .length !== 1 ||
    !owned.pool._clients.includes(owned.bootstrap) ||
    owned.pool._idle.some((item) => item.client === owned.bootstrap)
  )
    throw new Error('Owned native fixture pool changed before release');
  owned.bootstrap.release();
  await owned.pool.end();
  ownedPools.delete(payload);
  persistProofMetadata({
    event: 'backup-proof-owned-pool-closed',
    containerId: owned.containerId,
    sessions: 0,
    poolEnded: owned.pool.ended,
  });
}
afterAll(async () => {
  if (fixture) await closeOwnedPayload(fixture.payload);
});
it('enforces native read-only access and rolls back after a rejected write', async () => {
  const identity = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic read-only A' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const sessions = nativeSessionIds();
  await expect(
    withNativeBackupSnapshot(
      {
        payload: fixture.payload,
        directory: runtimePublication().directory,
        capture: async ({ req }) =>
          fixture.payload.db.updateOne({
            collection: 'cases',
            where: { id: { equals: identity.id } },
            data: { internalTitle: 'Unsafe write' },
            req,
          }),
      },
      async () => 'unexpected',
    ),
  ).rejects.toMatchObject({ cause: { code: '25006' } });
  expect(
    await fixture.payload.db.findOne({
      collection: 'cases',
      where: { id: { equals: identity.id } },
    }),
  ).toMatchObject({ internalTitle: 'Synthetic read-only A' });
  expect(nativeSessionIds()).toEqual(sessions);
});
it('releases native exporter and publication writer when the consumer fails', async () => {
  const sessions = nativeSessionIds();
  await expect(
    withNativeBackupSnapshot(
      {
        payload: fixture.payload,
        directory: runtimePublication().directory,
        capture: async () => ({ marker: randomUUID() }),
      },
      async () => {
        throw new Error('Synthetic backup consumer failed');
      },
    ),
  ).rejects.toThrow('Synthetic backup consumer failed');
  const inventory = await withNativeBackupSnapshot(
    {
      payload: fixture.payload,
      directory: runtimePublication().directory,
      capture: async () => ({ marker: randomUUID() }),
    },
    async (value) => value.captured,
  );
  expect(inventory.marker).toMatch(/^[a-f0-9-]{36}$/);
  expect(nativeSessionIds()).toEqual(sessions);
});
