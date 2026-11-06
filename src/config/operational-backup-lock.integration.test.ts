import { createRequire } from 'node:module';
import type { Payload } from 'payload';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { isolatedTestDatabaseUri } from '../../testing/setup/test-environment';
import {
  withOperationalBackupLock,
  withR2RetentionLock,
  type OperationalBackupLockPermit,
} from '../../ops/backup/r2-retention-lock';

const require = createRequire(import.meta.url);
const adapterRequire = createRequire(require.resolve('@payloadcms/db-postgres'));
const { Pool } = adapterRequire('pg');
type RealPool = Payload['db']['pool'];
const namespace = {
  project: 'a-design-for-life',
  environment: 'test',
  source: 'native-operational-lock',
} as const;
const storage = { endpoint: 'http://127.0.0.1:9', bucket: 'adfl-test-backup-operational-lock' };
const scope = { namespace, ...storage };
let first: RealPool;
let second: RealPool;
let owned: ReturnType<typeof inspectOwnedTestDatabase>;
function identity() {
  const current = inspectOwnedTestDatabase();
  if (current.containerId !== owned.containerId || current.networkId !== owned.networkId)
    throw new Error('The operational lock proof lost its owned PostgreSQL target.');
}
function options(pool: RealPool) {
  identity();
  return {
    payload: { db: { pool } } as unknown as Payload,
    databaseUri: isolatedTestDatabaseUri,
    namespace,
    backupStorage: storage,
  };
}
beforeAll(() => {
  owned = inspectOwnedTestDatabase();
  first = new Pool({
    connectionString: isolatedTestDatabaseUri,
    connectionTimeoutMillis: 3000,
    max: 3,
  });
  second = new Pool({
    connectionString: isolatedTestDatabaseUri,
    connectionTimeoutMillis: 3000,
    max: 3,
  });
});
afterAll(async () => {
  identity();
  await Promise.all([first.end(), second.end()]);
});

it('holds the actual PostgreSQL advisory lock across repositories and releases it for the next job', async () => {
  await withOperationalBackupLock(options(first), async (permit) => {
    await withR2RetentionLock(permit, scope, async (checkpoint) => {
      await checkpoint();
    });
    let competitorRan = false;
    await expect(
      withOperationalBackupLock(options(second), async () => {
        competitorRan = true;
      }),
    ).rejects.toThrow();
    expect(competitorRan).toBe(false);
  });
  let admitted = false;
  await withOperationalBackupLock(options(second), (permit) =>
    withR2RetentionLock(permit, scope, async (checkpoint) => {
      await checkpoint();
      admitted = true;
    }),
  );
  expect(admitted).toBe(true);
});

it('revokes a permit after callback failure while allowing another real session to acquire the lock', async () => {
  let retained: OperationalBackupLockPermit | undefined;
  await expect(
    withOperationalBackupLock(options(first), async (permit) => {
      retained = permit;
      throw new Error('Controlled Native failure');
    }),
  ).rejects.toThrow('Controlled Native failure');
  await expect(withR2RetentionLock(retained, scope, async () => undefined)).rejects.toThrow();
  await withOperationalBackupLock(options(second), (permit) =>
    withR2RetentionLock(permit, scope, async (checkpoint) => {
      await checkpoint();
    }),
  );
});

it('refuses an effect after the dedicated real PostgreSQL connection has ended', async () => {
  await withOperationalBackupLock(options(first), async (permit) => {
    await withR2RetentionLock(permit, scope, async (checkpoint) => {
      const pool = first as RealPool & {
        _clients: { processID: number; end: () => Promise<void> }[];
      };
      expect(pool._clients).toHaveLength(1);
      const connection = pool._clients[0];
      await connection.end();
      await expect(checkpoint()).rejects.toThrow();
    });
  });
  await withOperationalBackupLock(options(second), (permit) =>
    withR2RetentionLock(permit, scope, async (checkpoint) => {
      await checkpoint();
    }),
  );
});
