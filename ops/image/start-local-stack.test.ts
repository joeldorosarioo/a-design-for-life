import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { startLocalStack } from './start-local-stack.mjs';

const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});

class TestProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  kill = vi.fn((signal: NodeJS.Signals) => {
    this.signalCode = signal;
    this.emit('exit', null, signal);
  });

  fail() {
    this.exitCode = 1;
    this.emit('exit', 1, null);
  }
}

async function fixture(initialized: boolean) {
  const PGDATA = await mkdtemp(path.join(tmpdir(), 'adfl-stack-'));
  directories.push(PGDATA);
  if (initialized) await writeFile(path.join(PGDATA, 'PG_VERSION'), '17\n');
  const database = new TestProcess();
  const app = new TestProcess();
  const launch = vi.fn().mockReturnValueOnce(database).mockReturnValueOnce(app);
  const env = {
    NODE_ENV: 'test' as const,
    PGDATA,
    DATABASE_URI: 'postgres://fixture:synthetic-only@127.0.0.1:5432/portfolio',
  };
  return { database, app, launch, env };
}

it('waits for PostgreSQL before starting Next and leaves initialized database roles alone', async () => {
  const { database, app, launch, env } = await fixture(true);
  const controller = new AbortController();
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const result = startLocalStack({
    env,
    signal: controller.signal,
    launch,
    waitForDatabase: () => ready,
  });
  expect(launch).toHaveBeenCalledTimes(1);
  expect(launch.mock.calls[0][2].env).not.toHaveProperty('POSTGRES_PASSWORD');
  markReady();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(2));
  controller.abort();
  await expect(result).resolves.toBe(0);
  expect(app.kill).toHaveBeenCalledWith('SIGTERM');
  expect(database.kill).toHaveBeenCalledWith('SIGINT');
  expect(app.kill.mock.invocationCallOrder[0]).toBeLessThan(
    database.kill.mock.invocationCallOrder[0],
  );
});

it('bootstraps a fresh volume with credentials from the configured database URL', async () => {
  const { app, launch, env } = await fixture(false);
  env.DATABASE_URI = 'postgres://fixture:encoded%40password@localhost/portfolio';
  const result = startLocalStack({ env, launch, waitForDatabase: async () => {} });
  await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(2));
  expect(launch.mock.calls[0][2].env).toMatchObject({
    POSTGRES_DB: 'portfolio',
    POSTGRES_USER: 'fixture',
    POSTGRES_PASSWORD: 'encoded@password',
  });
  expect(launch.mock.calls[0][1]).not.toContain('encoded@password');
  app.fail();
  await expect(result).resolves.toBe(1);
});

it('fails without starting Next when PostgreSQL exits during readiness', async () => {
  const { database, launch, env } = await fixture(true);
  const result = startLocalStack({
    env,
    launch,
    waitForDatabase: () => new Promise(() => {}),
  });
  database.fail();
  await expect(result).resolves.toBe(1);
  expect(launch).toHaveBeenCalledTimes(1);
});

it('shuts down PostgreSQL when the Next process exits unexpectedly', async () => {
  const { database, app, launch, env } = await fixture(true);
  const result = startLocalStack({ env, launch, waitForDatabase: async () => {} });
  await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(2));
  app.fail();
  await expect(result).resolves.toBe(1);
  expect(database.kill).toHaveBeenCalledWith('SIGINT');
});

it('refuses a PostgreSQL data directory from a different major version', async () => {
  const { launch, env } = await fixture(true);
  await writeFile(path.join(env.PGDATA, 'PG_VERSION'), '16\n');
  await expect(startLocalStack({ env, launch })).rejects.toThrow('PostgreSQL 17');
  expect(launch).not.toHaveBeenCalled();
});
