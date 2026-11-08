import { expect, it, vi } from 'vitest';
import { dumpPostgresSnapshot } from './postgres-dump';
import type { runBackupTool } from './tools';

const connection = 'postgresql://test-editor:synthetic%40password@127.0.0.1:25434/adfl_test_ops';
const snapshot = '00000003-0000001B-1';
const run = vi.fn<typeof runBackupTool>(async () => ({
  stdout: '',
  exitCode: 0 as const,
}));

it('streams a custom snapshot dump and passes the credential only in the child environment', async () => {
  vi.stubEnv('PGSERVICE', 'ambient-service');
  try {
    await dumpPostgresSnapshot({
      databaseUri: connection,
      snapshotId: snapshot,
      binary: '/usr/lib/postgresql/17/bin/pg_dump',
      destination: '/app/.work/backup-private/database.dump',
      run,
    });

    expect(run).toHaveBeenCalledExactlyOnceWith({
      binary: '/usr/lib/postgresql/17/bin/pg_dump',
      args: [
        '--format=custom',
        '--snapshot=' + snapshot,
        '--no-owner',
        '--no-acl',
        '--no-password',
      ],
      outputFile: '/app/.work/backup-private/database.dump',
      timeoutMs: 600_000,
      env: {
        PGHOST: '127.0.0.1',
        PGPORT: '25434',
        PGDATABASE: 'adfl_test_ops',
        PGUSER: 'test-editor',
        PGPASSWORD: 'synthetic@password',
        PGSSLMODE: 'prefer',
        PGCONNECT_TIMEOUT: '5',
      },
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it('preserves a verified TLS mode from the explicit connection', async () => {
  run.mockClear();
  await dumpPostgresSnapshot({
    databaseUri: connection + '?sslmode=verify-full',
    snapshotId: snapshot,
    binary: '/usr/lib/postgresql/17/bin/pg_dump',
    destination: '/app/.work/backup-private/database.dump',
    run,
  });
  expect(run.mock.calls[0]?.[0]).toMatchObject({ env: { PGSSLMODE: 'verify-full' } });
});

it.each([
  ['an unsupported connection option', connection + '?options=unsafe', snapshot],
  ['ambiguous TLS mode', connection + '?sslmode=prefer&sslmode=require', snapshot],
  ['a socket default', 'postgresql://test-editor:password@/adfl_test_ops', snapshot],
  ['an option-like snapshot', connection, '--clean'],
])('refuses %s before launching pg_dump', async (_description, databaseUri, snapshotId) => {
  run.mockClear();
  await expect(
    dumpPostgresSnapshot({
      databaseUri,
      snapshotId,
      binary: '/usr/lib/postgresql/17/bin/pg_dump',
      destination: '/app/.work/backup-private/database.dump',
      run,
    }),
  ).rejects.toThrow('Invalid PostgreSQL snapshot dump configuration.');
  expect(run).not.toHaveBeenCalled();
});
