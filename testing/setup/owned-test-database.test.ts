import { EventEmitter } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { syntheticLocalDatabaseUri } from './local-database-environment';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  clearSharedDatabaseFiles,
  inspectOwnedTestDatabase,
  setOwnedTestDatabaseNetwork,
} from './owned-test-database';
import { finishOwnedDatabaseOutage, observeOwnedDatabasePool } from './owned-database-outage';
import { isolatedTestBucket, isolatedTestDatabaseUri } from './test-environment';
import { localDatabaseResources } from '../fixtures/local-database-resources';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(), spawn: vi.fn() }));

const runId = '443f2f55-41c5-499a-9c24-a038128133f7';
const containerId = 'c'.repeat(64);
const networkId = 'd'.repeat(64);
const failure = 'Isolated test Docker lifecycle command failed; resources were not assumed owned.';
type CommandMode =
  | 'normal'
  | 'replaced-container'
  | 'replaced-network'
  | 'connect-attached-failure'
  | 'connect-detached-failure'
  | 'disconnect-attached-failure';
let mode: CommandMode;
let attached: boolean;

function result(status = 0, stdout = '') {
  return {
    pid: 1,
    output: [null, stdout, ''],
    stdout,
    stderr: '',
    status,
    signal: null,
  } as unknown as ReturnType<typeof spawnSync>;
}
function resources() {
  const value = localDatabaseResources(process.env, attached);
  if (mode === 'replaced-container') {
    value.container.Id = 'a'.repeat(64);
    value.network.Containers = attached ? { [value.container.Id]: {} } : {};
  }
  if (mode === 'replaced-network') {
    value.network.Id = 'b'.repeat(64);
    for (const network of Object.values(value.container.NetworkSettings.Networks))
      network.NetworkID = value.network.Id;
  }
  return value;
}
function observedPool() {
  const pool = Object.assign(new EventEmitter(), {
    options: { connectionString: isolatedTestDatabaseUri },
  });
  observeOwnedDatabasePool(pool);
  return pool;
}
function dropped() {
  return new Error('Connection terminated unexpectedly');
}

beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URI: isolatedTestDatabaseUri,
    MEDIA_BUCKET: isolatedTestBucket,
    MEDIA_STORAGE_ROOT: path.resolve(
      '.work/private-media',
      isolatedTestBucket,
      'a_design_for_life_rebuild',
    ),
    ADFL_TEST_RUN_ID: runId,
    ADFL_TEST_CONTAINER_ID: containerId,
    ADFL_TEST_NETWORK_ID: networkId,
  }))
    vi.stubEnv(key, value);
  mode = 'normal';
  attached = true;
  vi.mocked(spawnSync).mockImplementation((command, args) => {
    expect(command).toBe('docker');
    if (!Array.isArray(args)) throw new Error('Unexpected mocked Docker arguments.');
    if (args[0] === 'container' && args[1] === 'inspect' && args[2] === containerId)
      return result(0, JSON.stringify([resources().container]));
    if (args[0] === 'network' && args[1] === 'inspect' && args[2] === networkId)
      return result(0, JSON.stringify([resources().network]));
    if (args[0] === 'network' && ['connect', 'disconnect'].includes(args[1])) {
      expect(args.slice(2)).toEqual([networkId, containerId]);
      if (mode === 'connect-attached-failure' && args[1] === 'connect') {
        attached = true;
        return result(1);
      }
      if (mode === 'connect-detached-failure' && args[1] === 'connect') return result(1);
      if (mode === 'disconnect-attached-failure' && args[1] === 'disconnect') return result(1);
      attached = args[1] === 'connect';
      return result();
    }
    throw new Error('Unexpected external command in mocked database recovery test.');
  });
});
afterEach(() => {
  // Restore the mock's same acquired attachment before clearing any open scope.
  mode = 'normal';
  attached = true;
  try {
    finishOwnedDatabaseOutage(inspectOwnedTestDatabase());
  } catch (error) {
    expect((error as Error).message).toBe('No matching controlled database outage can be closed.');
  }
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it('closes the outage after connect took effect but its CLI failed, while propagating the original command failure', () => {
  const pool = observedPool();
  setOwnedTestDatabaseNetwork('disconnect');
  expect(() => pool.emit('error', dropped())).not.toThrow();
  mode = 'connect-attached-failure';
  expect(() => setOwnedTestDatabaseNetwork('connect')).toThrow(failure);
  expect(attached).toBe(true);
  const unexpectedAfterRecovery = dropped();
  expect(() => pool.emit('error', unexpectedAfterRecovery)).toThrow(unexpectedAfterRecovery);
});

it('keeps the outage scope active when failed connect cannot verify the same acquired attachment', () => {
  const pool = observedPool();
  setOwnedTestDatabaseNetwork('disconnect');
  mode = 'connect-detached-failure';
  expect(() => setOwnedTestDatabaseNetwork('connect')).toThrow(failure);
  expect(attached).toBe(false);
  expect(() => pool.emit('error', dropped())).not.toThrow();
});

it('closes the outage after failed disconnect left the same acquired resources attached', () => {
  const pool = observedPool();
  mode = 'disconnect-attached-failure';
  expect(() => setOwnedTestDatabaseNetwork('disconnect')).toThrow(failure);
  expect(attached).toBe(true);
  const unexpectedWithoutOutage = dropped();
  expect(() => pool.emit('error', unexpectedWithoutOutage)).toThrow(unexpectedWithoutOutage);
});

it.each(['replaced-container', 'replaced-network'] as const)(
  'refuses a replacement of the already acquired resource before any network mutation: %s',
  (replacement) => {
    mode = replacement;
    expect(() => setOwnedTestDatabaseNetwork('disconnect')).toThrow(/immutable identity changed/i);
    expect(
      vi
        .mocked(spawnSync)
        .mock.calls.some(
          ([, args]) =>
            Array.isArray(args) &&
            args[0] === 'network' &&
            ['connect', 'disconnect'].includes(args[1]),
        ),
    ).toBe(false);
    mode = 'normal';
  },
);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assertUnlinkedWorkspacePath(root);
    await rm(root, { recursive: true, force: true });
  }
});

async function fixture() {
  const root = path.resolve('.work', `shared-files-unit-${randomUUID()}`);
  roots.push(root);
  await mkdir(root, { recursive: true });
  const input: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URI: syntheticLocalDatabaseUri,
    SITE_ORIGIN: 'http://127.0.0.1:3101',
    MEDIA_BUCKET: 'adfl-test-runner',
    MEDIA_STORAGE_ROOT: path.join(
      root,
      '.work/private-media/adfl-test-runner/a_design_for_life_rebuild',
    ),
  };
  await writeFile(
    path.join(root, '.env'),
    [
      'APP_ENV=local',
      `DATABASE_URI=${syntheticLocalDatabaseUri}`,
      'SITE_ORIGIN=http://localhost:3000',
      'MEDIA_BUCKET=existing-local-media',
      'MEDIA_STORAGE_ROOT=outside-the-owned-test-namespace',
    ].join('\n'),
  );
  const projection = (APP_ENV: string, SITE_ORIGIN: string) =>
    path.join(
      root,
      '.work/publication',
      path.basename(
        publicRootDirectory({ APP_ENV, SITE_ORIGIN, DATABASE_URI: syntheticLocalDatabaseUri }),
      ),
    );
  const local = projection('local', 'http://localhost:3000');
  const test = projection('test', input.SITE_ORIGIN!);
  const mail = path.join(
    root,
    '.work/editorial-mail',
    createHash('sha256').update(syntheticLocalDatabaseUri).digest('hex').slice(0, 16),
  );
  const neighbors = [
    projection('staging', 'http://localhost:3000'),
    path.join(root, '.work/private-media/existing-local-media/a_design_for_life_rebuild'),
  ];
  const targets = [local, test, input.MEDIA_STORAGE_ROOT!, mail];
  for (const directory of [...targets, ...neighbors]) {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'sentinel'), 'preserve until its exact reset');
  }
  return { root, input, local, test, targets, neighbors };
}

it('clears local/test projections, test media and captured email while preserving neighboring namespaces', async () => {
  const data = await fixture();
  await clearSharedDatabaseFiles(data.input, data.root);
  for (const target of data.targets)
    await expect(lstat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  for (const neighbor of data.neighbors)
    expect(await readFile(path.join(neighbor, 'sentinel'), 'utf8')).toBe(
      'preserve until its exact reset',
    );
});

it('refuses a linked target before removing any namespace or following the link', async () => {
  const data = await fixture();
  const target = data.input.MEDIA_STORAGE_ROOT!;
  await rm(target, { recursive: true });
  await symlink(data.neighbors[0]!, target, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(clearSharedDatabaseFiles(data.input, data.root)).rejects.toThrow(/linked/i);
  expect(await readFile(path.join(data.local, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
  expect(await readFile(path.join(data.test, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
  expect(await readFile(path.join(data.neighbors[0]!, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
});

it('refuses an unrelated database before removing local files', async () => {
  const data = await fixture();
  await expect(
    clearSharedDatabaseFiles(
      {
        ...data.input,
        DATABASE_URI: syntheticLocalDatabaseUri.replace(
          'a_design_for_life_rebuild',
          'other_database',
        ),
      },
      data.root,
    ),
  ).rejects.toThrow(/shared local/i);
  expect(await readFile(path.join(data.local, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
});
