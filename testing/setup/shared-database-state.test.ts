import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { restoreSharedDatabase, runSharedDatabaseTool } from './shared-database-state';
import { syntheticLocalDatabaseUri } from './local-database-environment';

vi.mock('node:child_process', () => ({ spawn: vi.fn(), spawnSync: vi.fn() }));
vi.mock('./owned-test-database', () => ({
  inspectOwnedTestDatabase: vi.fn(() => ({ containerId: 'c'.repeat(64) })),
  sharedDatabaseLock: 'adfl:shared-local-database-runtime',
}));
const directories: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function dump(content: string) {
  const directory = path.resolve('.work/test-database-state', `unit-${randomUUID()}`);
  directories.push(directory);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'database.dump');
  await writeFile(file, content);
  return file;
}

it('refuses an invalid dump before acquiring a connection or clearing the shared schema', async () => {
  const file = await dump('not a PostgreSQL archive');
  await expect(restoreSharedDatabase(file)).rejects.toThrow(/custom dump/i);
  expect(spawn).not.toHaveBeenCalled();
  expect(await readFile(file, 'utf8')).toBe('not a PostgreSQL archive');
});

it('preserves the database and checkpoint when its saved digest no longer matches', async () => {
  const file = await dump('PGDMPchanged checkpoint');
  await expect(restoreSharedDatabase(file, '0'.repeat(64))).rejects.toThrow(/checkpoint changed/i);
  expect(spawn).not.toHaveBeenCalled();
  expect(await readFile(file, 'utf8')).toBe('PGDMPchanged checkpoint');
});

it('refuses files outside the private workspace before touching the database', async () => {
  await expect(restoreSharedDatabase(path.resolve('package.json'))).rejects.toThrow(
    /private workspace/i,
  );
  expect(spawn).not.toHaveBeenCalled();
});

it.each(['psql', 'pg_dump', 'pg_restore'] as const)(
  'checks the lease, then invokes %s --version in the position required by PostgreSQL',
  async (tool) => {
    for (const [key, value] of Object.entries({
      APP_ENV: 'test',
      DATABASE_URI: syntheticLocalDatabaseUri,
      ADFL_SHARED_DATABASE_URI: syntheticLocalDatabaseUri,
      MEDIA_BUCKET: 'adfl-test-runner',
      MEDIA_STORAGE_ROOT: path.resolve(
        '.work/private-media/adfl-test-runner/a_design_for_life_rebuild',
      ),
      ADFL_TEST_RUN_ID: '443f2f55-41c5-499a-9c24-a038128133f7',
      ADFL_SHARED_DATABASE_LEASE_PID: '41',
    }))
      vi.stubEnv(key, value);
    vi.mocked(spawn).mockImplementation((_command, args) => {
      const process = Object.assign(new EventEmitter(), {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: vi.fn(),
      });
      process.stdin.once('finish', () => {
        queueMicrotask(() => {
          process.stdout.end(
            Array.isArray(args) && args.at(-1) === '--version'
              ? `${tool} (PostgreSQL) 17.11\n`
              : 't\n',
          );
          process.stderr.end();
          process.emit('close', 0);
        });
      });
      return process as unknown as ReturnType<typeof spawn>;
    });
    await expect(runSharedDatabaseTool(tool, ['--version'])).resolves.toBe(
      `${tool} (PostgreSQL) 17.11`,
    );
    const calls = vi.mocked(spawn).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]).toContain('psql');
    expect(calls[0]![1]).toContain('--dbname=a_design_for_life_rebuild');
    expect(calls[1]![1]).toEqual(['exec', '-i', 'c'.repeat(64), tool, '--version']);
  },
);
