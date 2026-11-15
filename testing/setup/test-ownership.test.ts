import path from 'node:path';
import { expect, it } from 'vitest';
import { localDatabaseResources } from '../fixtures/local-database-resources';
import { syntheticLocalDatabaseUri } from './local-database-environment';
import { testResourceNames, verifyOwnedTestResources, type Inspection } from './test-ownership';

const env = { NODE_ENV: 'test' as const, DATABASE_URI: syntheticLocalDatabaseUri };

it('validates the same persistent local service for every test run and development', () => {
  const { container, network } = localDatabaseResources(env);
  expect(verifyOwnedTestResources(env, container, network)).toEqual({
    containerId: container.Id,
    networkId: network.Id,
    networkName: network.Name,
  });
  expect(testResourceNames({ ...env, ADFL_TEST_RUN_ID: 'different-run' })).toEqual(
    testResourceNames(env),
  );
});

it.each([
  [
    'compose project',
    (c: Inspection) => {
      c.Config.Labels['com.docker.compose.project'] = 'foreign';
    },
  ],
  [
    'service',
    (c: Inspection) => {
      c.Config.Labels['com.docker.compose.service'] = 'portfolio';
    },
  ],
  [
    'purpose',
    (c: Inspection) => {
      c.Config.Labels['life.adfl.purpose'] = 'disposable-test';
    },
  ],
  [
    'port',
    (c: Inspection) => {
      c.HostConfig.PortBindings['5432/tcp']![0]!.HostPort = '55434';
    },
  ],
  [
    'listen address',
    (c: Inspection) => {
      c.HostConfig.PortBindings['5432/tcp']![0]!.HostIp = '0.0.0.0';
    },
  ],
  [
    'data volume',
    (c: Inspection) => {
      c.Mounts[0]!.Name = 'different-data';
    },
  ],
  [
    'data directory',
    (c: Inspection) => {
      c.Mounts[0]!.Destination = '/different';
    },
  ],
  [
    'read only data',
    (c: Inspection) => {
      c.Mounts[0]!.RW = false;
    },
  ],
  [
    'extra host storage',
    (c: Inspection) => {
      c.Mounts.push({ Type: 'bind', Destination: '/host' });
    },
  ],
  [
    'disposable storage',
    (c: Inspection) => {
      c.HostConfig.Tmpfs = { '/var/lib/postgresql/data': '' };
    },
  ],
  [
    'image',
    (c: Inspection) => {
      c.Config.Image = 'postgres:latest';
    },
  ],
  [
    'immutable image',
    (c: Inspection) => {
      c.Image = 'latest';
    },
  ],
  [
    'user',
    (c: Inspection) => {
      c.Config.User = '0:0';
    },
  ],
  [
    'stopped service',
    (c: Inspection) => {
      c.State.Running = false;
    },
  ],
  [
    'application mode',
    (c: Inspection) => {
      c.Config.Env = ['APP_ENV=local'];
    },
  ],
  [
    'container name',
    (c: Inspection) => {
      c.Name = '/foreign';
    },
  ],
  [
    'network identity',
    (c: Inspection) => {
      c.NetworkSettings.Networks[testResourceNames(env).network]!.NetworkID = 'foreign';
    },
  ],
] as const)('refuses a %s mismatch before any database operation', (_name, mutate) => {
  const { container, network } = localDatabaseResources(env);
  mutate(container);
  expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
});

it.each(['life.adfl.purpose', 'com.docker.compose.project', 'com.docker.compose.network'])(
  'refuses network label mismatch %s',
  (label) => {
    const { container, network } = localDatabaseResources(env);
    network.Labels[label] = 'foreign';
    expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
  },
);

it('refuses a network shared by an unexpected container', () => {
  const { container, network } = localDatabaseResources(env);
  network.Containers['foreign-container'] = {};
  expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
});

it('refuses a different database before inspecting the resources', () => {
  const { container, network } = localDatabaseResources(env);
  expect(() =>
    verifyOwnedTestResources(
      { ...env, DATABASE_URI: env.DATABASE_URI.replace('5432', '55434') },
      container,
      network,
    ),
  ).toThrow(/shared local/i);
});

it('validates the same fixed service while its network is deliberately disconnected', () => {
  const { container, network } = localDatabaseResources(env, false);
  expect(verifyOwnedTestResources(env, container, network, false).containerId).toBe(container.Id);
  expect(verifyOwnedTestResources(env, container, network, 'cleanup').containerId).toBe(
    container.Id,
  );
  expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
});

it.each(['com.docker.compose.project.working_dir', 'com.docker.compose.project.config_files'])(
  'refuses another checkout or Compose file %s',
  (label) => {
    const { container, network } = localDatabaseResources(env);
    container.Config.Labels[label] = path.resolve('foreign-checkout');
    expect(() => verifyOwnedTestResources(env, container, network)).toThrow(/owned test/i);
  },
);
