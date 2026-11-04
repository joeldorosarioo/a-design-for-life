import path from 'node:path';
import { expect, it } from 'vitest';
import {
  planOwnedCleanup,
  verifyOwnedTestResources,
  type Inspection,
  type NetworkInspection,
} from './test-ownership';

const runId = '443f2f55-41c5-499a-9c24-a038128133f7';
const env = {
  NODE_ENV: 'test' as const,
  APP_ENV: 'test',
  ADFL_TEST_RUN_ID: runId,
  DATABASE_URI: 'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
  MEDIA_BUCKET: 'adfl-test-runner',
  MEDIA_STORAGE_ROOT: path.resolve('.work/private-media/adfl-test-runner/adfl_test_runner'),
};
function resources() {
  const labels = {
    'com.docker.compose.project': 'adfl-isolated-tests-443f2f55-41c5-499a-9c24-a038128133f7',
    'life.adfl.test-run': runId,
    'life.adfl.purpose': 'disposable-test',
    'com.docker.compose.project.working_dir': process.cwd(),
    'com.docker.compose.project.config_files': path.resolve('compose.test.yaml'),
  };
  const container: Inspection = {
    Id: 'c'.repeat(64),
    Name: '/adfl-isolated-tests-443f2f55-41c5-499a-9c24-a038128133f7-postgres-isolated-1',
    Config: {
      Image:
        'postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b',
      Labels: { ...labels, 'com.docker.compose.service': 'postgres-isolated' },
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
      Networks: {
        'adfl-isolated-tests-443f2f55-41c5-499a-9c24-a038128133f7_default': {
          NetworkID: 'd'.repeat(64),
        },
      },
    },
  };
  const network: NetworkInspection = {
    Id: 'd'.repeat(64),
    Name: 'adfl-isolated-tests-443f2f55-41c5-499a-9c24-a038128133f7_default',
    Driver: 'bridge',
    Labels: { ...labels, 'com.docker.compose.network': 'default' },
    Containers: { [container.Id]: {} },
  };
  return { container, network };
}
it('allows cleanup of a newly acquired exact owned resource pair by immutable IDs', () => {
  const { container, network } = resources();
  expect(planOwnedCleanup(env, true, container, network)).toEqual([
    ['container', 'stop', 'c'.repeat(64)],
    ['container', 'rm', 'c'.repeat(64)],
    ['network', 'rm', 'd'.repeat(64)],
  ]);
});
it('never cleans up resources that this lifecycle did not create', () => {
  const { container, network } = resources();
  expect(planOwnedCleanup(env, false, container, network)).toEqual([]);
});
it.each([
  [
    'compose project',
    (c: Inspection) => {
      c.Config.Labels['com.docker.compose.project'] = 'a-design-for-life-local';
    },
  ],
  [
    'service',
    (c: Inspection) => {
      c.Config.Labels['com.docker.compose.service'] = 'postgres-test';
    },
  ],
  [
    'run identity',
    (c: Inspection) => {
      c.Config.Labels['life.adfl.test-run'] = 'another-run';
    },
  ],
  [
    'port',
    (c: Inspection) => {
      c.HostConfig.PortBindings['5432/tcp']![0]!.HostPort = '55433';
    },
  ],
  [
    'listen address',
    (c: Inspection) => {
      c.HostConfig.PortBindings['5432/tcp']![0]!.HostIp = '0.0.0.0';
    },
  ],
  [
    'database',
    (c: Inspection) => {
      c.Config.Env[0] = 'POSTGRES_DB=adfl_test_base';
    },
  ],
  [
    'persistent storage',
    (c: Inspection) => {
      c.HostConfig.Tmpfs = {};
    },
  ],
  [
    'container name',
    (c: Inspection) => {
      c.Name = '/a-design-for-life-local-postgres-test-1';
    },
  ],
  [
    'network identity',
    (c: Inspection) => {
      c.NetworkSettings.Networks[
        'adfl-isolated-tests-443f2f55-41c5-499a-9c24-a038128133f7_default'
      ]!.NetworkID = 'foreign-network';
    },
  ],
] as const)('refuses %s mismatch before planning any cleanup', (_name, mutate) => {
  const { container, network } = resources();
  mutate(container);
  expect(() => planOwnedCleanup(env, true, container, network)).toThrow(/owned test/i);
});
it.each(['life.adfl.test-run', 'com.docker.compose.project', 'com.docker.compose.network'])(
  'refuses network label mismatch %s',
  (label) => {
    const { container, network } = resources();
    network.Labels[label] = 'foreign';
    expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
  },
);
it('refuses a network shared by an unexpected container', () => {
  const { container, network } = resources();
  network.Containers['foreign-container'] = {};
  expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
});
it('refuses otherwise owned resources when runtime database or storage do not correspond', () => {
  const { container, network } = resources();
  expect(() =>
    verifyOwnedTestResources(
      { ...env, DATABASE_URI: env.DATABASE_URI.replace('55434', '55433') },
      container,
      network,
    ),
  ).toThrow(/isolated test/i);
  expect(() =>
    verifyOwnedTestResources(
      { ...env, MEDIA_STORAGE_ROOT: path.resolve('public') },
      container,
      network,
    ),
  ).toThrow(/isolated test/i);
});
it('validates the same ownership while the owned container is deliberately disconnected', () => {
  const { container, network } = resources();
  container.NetworkSettings.Networks = {};
  network.Containers = {};
  expect(verifyOwnedTestResources(env, container, network, false).containerId).toBe('c'.repeat(64));
  container.Config.Labels['life.adfl.test-run'] = 'foreign';
  expect(() => verifyOwnedTestResources(env, container, network, false)).toThrow(/owned test/i);
});
it.each(['com.docker.compose.project.working_dir', 'com.docker.compose.project.config_files'])(
  'refuses a matching run label from a foreign checkout or compose file %s',
  (label) => {
    const { container, network } = resources();
    container.Config.Labels[label] = path.resolve('foreign-checkout');
    expect(() => planOwnedCleanup(env, true, container, network)).toThrow(/owned test/i);
  },
);
it('refuses a tmpfs-looking container that additionally binds host storage', () => {
  const { container, network } = resources();
  Object.assign(container.HostConfig, { Binds: ['/foreign:/var/lib/postgresql/data'] });
  expect(() => planOwnedCleanup(env, true, container, network)).toThrow(/owned test/i);
});
it.each(['container', 'network'])(
  'refuses cleanup after a previously acquired %s has been replaced',
  (kind) => {
    const { container, network } = resources();
    const acquired = { containerId: container.Id, networkId: network.Id };
    if (kind === 'container') acquired.containerId = 'a'.repeat(64);
    else acquired.networkId = 'b'.repeat(64);
    expect(() => planOwnedCleanup(env, true, container, network, acquired)).toThrow(/owned test/i);
  },
);
