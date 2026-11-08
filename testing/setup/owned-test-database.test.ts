import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inspectOwnedTestDatabase, setOwnedTestDatabaseNetwork } from './owned-test-database';
import { finishOwnedDatabaseOutage, observeOwnedDatabasePool } from './owned-database-outage';
import { isolatedTestBucket, isolatedTestDatabaseUri } from './test-environment';
import {
  testImage,
  testResourceNames,
  type Inspection,
  type NetworkInspection,
} from './test-ownership';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const runId = '443f2f55-41c5-499a-9c24-a038128133f7';
const containerId = 'c'.repeat(64);
const networkId = 'd'.repeat(64);
const failure = 'Isolated test Docker lifecycle command failed; resources were not assumed owned.';
type CommandMode =
  | 'normal'
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
  const names = testResourceNames(process.env);
  const labels = {
    'com.docker.compose.project': names.project,
    'life.adfl.test-run': runId,
    'life.adfl.purpose': 'disposable-test',
    'com.docker.compose.project.working_dir': process.cwd(),
    'com.docker.compose.project.config_files': path.resolve('compose.test.yaml'),
  };
  const container: Inspection = {
    Id: containerId,
    Name: `/${names.container}`,
    Config: {
      Image: testImage,
      Labels: { ...labels, 'com.docker.compose.service': names.service },
      Env: [
        'POSTGRES_DB=adfl_test_runner',
        'POSTGRES_USER=adfl_test',
        'POSTGRES_PASSWORD=synthetic-local-test-only',
      ],
    },
    HostConfig: {
      PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55434' }] },
      Tmpfs: { '/var/lib/postgresql/data': '' },
    },
    NetworkSettings: {
      Networks: attached ? { [names.network]: { NetworkID: networkId } } : {},
    },
  };
  const network: NetworkInspection = {
    Id: networkId,
    Name: names.network,
    Driver: 'bridge',
    Labels: { ...labels, 'com.docker.compose.network': 'default' },
    Containers: attached ? { [containerId]: {} } : {},
  };
  return { container, network };
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
    MEDIA_STORAGE_ROOT: path.resolve('.work/private-media', isolatedTestBucket, 'adfl_test_runner'),
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
