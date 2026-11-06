import type { Payload } from 'payload';
import { expect, it } from 'vitest';
import {
  withOperationalBackupLock,
  withR2RetentionLock,
  type OperationalBackupLockPermit,
} from './r2-retention-lock';

const namespace = {
  project: 'a-design-for-life',
  environment: 'test',
  source: 'lock-fixture',
} as const;
const storage = { endpoint: 'http://127.0.0.1:32123', bucket: 'adfl-test-backup-lock' };
const scope = { namespace, ...storage };
function fixture(
  input: { database?: string; version?: number; acquired?: boolean; pid?: number } = {},
) {
  const state = { held: true, pid: input.pid ?? 123, released: false, queries: [] as string[] };
  const client = {
    async query(text: string) {
      state.queries.push(text);
      if (text.includes('current_database()'))
        return {
          rows: [
            {
              database: input.database ?? 'adfl_test_lock',
              version: input.version ?? 170011,
              pid: state.pid,
            },
          ],
        };
      if (text.includes('pg_try_advisory_lock'))
        return { rows: [{ acquired: input.acquired ?? true }] };
      return { rows: [{ pid: state.pid, held: state.held }] };
    },
    release(destroy: boolean) {
      expect(destroy).toBe(true);
      state.released = true;
    },
  };
  return {
    state,
    options: {
      payload: { db: { pool: { connect: async () => client } } } as unknown as Payload,
      databaseUri: 'postgres://synthetic:synthetic@127.0.0.1:25434/adfl_test_lock',
      namespace,
      backupStorage: storage,
    },
  };
}

it('checks the actual dedicated PostgreSQL session and preserves it throughout the operation', async () => {
  const data = fixture();
  const result = await withOperationalBackupLock(data.options, (permit) =>
    withR2RetentionLock(permit, scope, async (checkpoint) => {
      expect(data.state.released).toBe(false);
      await checkpoint();
      return 'completed';
    }),
  );
  expect(result).toBe('completed');
  expect(data.state.queries.filter((query) => query.includes('pg_locks'))).toHaveLength(2);
  expect(data.state.released).toBe(true);
});

it.each([
  { database: 'foreign_database' },
  { version: 160011 },
  { version: 180000 },
  { acquired: false },
  { pid: 0 },
])(
  'refuses a wrong or unavailable PostgreSQL lock before invoking the consumer (%j)',
  async (input) => {
    const data = fixture(input);
    let invoked = false;
    await expect(
      withOperationalBackupLock(data.options, async () => {
        invoked = true;
      }),
    ).rejects.toThrow();
    expect(invoked).toBe(false);
    expect(data.state.released).toBe(true);
  },
);

it('does not authorize a flag, copied permit or a permit after its callback ends', async () => {
  const data = fixture();
  let retained: OperationalBackupLockPermit | undefined;
  await expect(withR2RetentionLock({} as never, scope, async () => undefined)).rejects.toThrow();
  await withOperationalBackupLock(data.options, async (permit) => {
    retained = permit;
    await expect(
      withR2RetentionLock({ ...permit }, scope, async () => undefined),
    ).rejects.toThrow();
  });
  await expect(withR2RetentionLock(retained, scope, async () => undefined)).rejects.toThrow();
});

it.each([
  { ...scope, bucket: 'adfl-test-foreign-bucket' },
  { ...scope, endpoint: 'http://127.0.0.1:32124' },
  { ...scope, namespace: { ...namespace, source: 'foreign-source' } },
])('binds the permit to its namespace and physical R2 destination (%j)', async (selected) => {
  const data = fixture();
  await withOperationalBackupLock(data.options, async (permit) => {
    await expect(withR2RetentionLock(permit, selected, async () => undefined)).rejects.toThrow();
  });
});

it('allows the common local operational lock without granting R2 deletion authority', async () => {
  const data = fixture();
  await withOperationalBackupLock({ ...data.options, backupStorage: undefined }, async (permit) => {
    await expect(withR2RetentionLock(permit, scope, async () => undefined)).rejects.toThrow();
  });
});

it.each(['lost', 'reconnected'] as const)(
  'refuses a %s session at an effect checkpoint',
  async (failure) => {
    const data = fixture();
    let effect = false;
    await withOperationalBackupLock(data.options, (permit) =>
      withR2RetentionLock(permit, scope, async (checkpoint) => {
        if (failure === 'lost') data.state.held = false;
        else data.state.pid++;
        await expect(
          checkpoint().then(() => {
            effect = true;
          }),
        ).rejects.toThrow();
        expect(effect).toBe(false);
      }),
    );
    expect(data.state.released).toBe(true);
  },
);

it('drains an admitted remote operation before releasing the session when the caller forgets to await it', async () => {
  const data = fixture();
  let finish!: () => void;
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const result = withOperationalBackupLock(data.options, async (permit) => {
    void withR2RetentionLock(permit, scope, async (checkpoint) => {
      started();
      await barrier;
      await checkpoint();
    });
  });
  await running;
  await Promise.resolve();
  expect(data.state.released).toBe(false);
  finish();
  await result;
  expect(data.state.released).toBe(true);
});

it('releases the dedicated client when the consumer fails', async () => {
  const data = fixture();
  await expect(
    withOperationalBackupLock(data.options, async () => {
      throw new Error('controlled failure');
    }),
  ).rejects.toThrow('controlled failure');
  expect(data.state.released).toBe(true);
});
