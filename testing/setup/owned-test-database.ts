import { prepareTestLifecycle } from './test-lifecycle-lock';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { assertIsolatedTestEnvironment, configureTestEnvironment } from './test-environment';
import {
  planOwnedCleanup,
  testResourceNames,
  verifyOwnedTestNetwork,
  verifyOwnedTestResources,
  type Inspection,
  type NetworkInspection,
} from './test-ownership';

function docker(args: string[], env: NodeJS.ProcessEnv) {
  assertIsolatedTestEnvironment(env);
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...env,
      COMPOSE_PROJECT_NAME: testResourceNames(env).project,
      COMPOSE_DISABLE_ENV_FILE: 'true',
      COMPOSE_PROFILES: '',
    },
  });
  if (result.error || result.status !== 0)
    throw new Error(
      'Isolated test Docker lifecycle command failed; resources were not assumed owned.',
    );
  return result.stdout.trim();
}
function inspection<T>(kind: 'container' | 'network', id: string, env: NodeJS.ProcessEnv): T {
  const values = JSON.parse(docker([kind, 'inspect', id], env)) as T[];
  if (values.length !== 1) throw new Error('Expected exactly one owned test resource.');
  return values[0]!;
}
function matchingIds(kind: 'container' | 'network', filter: string, env: NodeJS.ProcessEnv) {
  return docker(
    kind === 'container'
      ? ['ps', '--all', '--quiet', '--no-trunc', '--filter', filter]
      : ['network', 'ls', '--quiet', '--no-trunc', '--filter', filter],
    env,
  );
}

export function inspectOwnedTestDatabase(attached: boolean | 'cleanup' = true, env = process.env) {
  assertIsolatedTestEnvironment(env);
  if (
    !/^[a-f0-9]{64}$/.test(env.ADFL_TEST_CONTAINER_ID ?? '') ||
    !/^[a-f0-9]{64}$/.test(env.ADFL_TEST_NETWORK_ID ?? '')
  )
    throw new Error('No acquired owned test database identity.');
  const container = inspection<Inspection>('container', env.ADFL_TEST_CONTAINER_ID!, env);
  const network = inspection<NetworkInspection>('network', env.ADFL_TEST_NETWORK_ID!, env);
  const owned = verifyOwnedTestResources(env, container, network, attached);
  if (
    owned.containerId !== env.ADFL_TEST_CONTAINER_ID ||
    owned.networkId !== env.ADFL_TEST_NETWORK_ID
  )
    throw new Error('Owned test database immutable identity changed.');
  return { ...owned, container, network };
}

export function setOwnedTestDatabaseNetwork(action: 'disconnect' | 'connect') {
  const owned = inspectOwnedTestDatabase(action === 'disconnect');
  docker(['network', action, owned.networkId, owned.containerId], process.env);
  inspectOwnedTestDatabase(action === 'connect');
}

export async function startOwnedTestDatabase() {
  configureTestEnvironment();
  const env = { ...process.env };
  const names = testResourceNames(env);
  // The current-user fixed-port lease is held before any Docker query and through teardown.
  const { releaseLock, preflightReceipt } = await prepareTestLifecycle(
    env.ADFL_TEST_RUN_ID!,
    async () => {
      if (
        matchingIds('container', `label=com.docker.compose.project=${names.project}`, env) ||
        matchingIds('container', `name=^/${names.container}$`, env) ||
        matchingIds('network', `label=com.docker.compose.project=${names.project}`, env) ||
        matchingIds('network', `name=^${names.network}$`, env)
      )
        throw new Error(
          'Existing resources collide with the isolated test lifecycle; nothing changed.',
        );
      await new Promise<void>((resolve, reject) => {
        const probe = createServer();
        probe.once('error', () =>
          reject(new Error('Isolated test PostgreSQL port 55434 is unavailable.')),
        );
        probe.listen(55434, '127.0.0.1', () =>
          probe.close((error) => (error ? reject(error) : resolve())),
        );
      });
      return {
        resourcesAbsent: true as const,
        project: names.project,
        container: names.container,
        network: names.network,
        runId: env.ADFL_TEST_RUN_ID!,
        checkedAt: new Date().toISOString(),
      };
    },
  );
  const compose = [
    'compose',
    '--project-name',
    names.project,
    '-f',
    fileURLToPath(new URL('../../compose.test.yaml', import.meta.url)),
  ];
  let attempted = false;
  let captured: { containerId?: string; networkId: string } | undefined;
  const captureAttemptResources = () => {
    if (
      !attempted ||
      !preflightReceipt.resourcesAbsent ||
      preflightReceipt.project !== names.project ||
      preflightReceipt.runId !== env.ADFL_TEST_RUN_ID
    )
      throw new Error('No held-lease absence receipt for this owned test creation attempt.');
    // This is the only post-attempt discovery. The shared lease excludes other supported runners.
    // Validate the newly appeared pair before recording immutable IDs, including after failed up.
    const containerId = matchingIds('container', `name=^/${preflightReceipt.container}$`, env);
    const networkId = matchingIds('network', `name=^${preflightReceipt.network}$`, env);
    if (!containerId) {
      if (!networkId) return;
      const network = inspection<NetworkInspection>('network', networkId, env);
      verifyOwnedTestNetwork(env, network);
      captured = { networkId: network.Id };
      return;
    }
    if (!networkId) throw new Error('Owned test creation is missing its expected network.');
    const container = inspection<Inspection>('container', containerId, env);
    const network = inspection<NetworkInspection>('network', networkId, env);
    const owned = verifyOwnedTestResources(env, container, network, 'cleanup');
    captured = { containerId: owned.containerId, networkId: owned.networkId };
  };
  const cleanup = () => {
    if (!captured) return;
    // Cleanup never discovers/adopts resources by name. It uses only the verified attempt receipt.
    const network = inspection<NetworkInspection>('network', captured.networkId, env);
    if (!captured.containerId) {
      verifyOwnedTestNetwork(env, network);
      docker(['network', 'rm', captured.networkId], env);
      captured = undefined;
      return;
    }
    const expected = { containerId: captured.containerId, networkId: captured.networkId };
    const container = inspection<Inspection>('container', expected.containerId, env);
    const plan = planOwnedCleanup(
      env,
      preflightReceipt.resourcesAbsent && attempted,
      container,
      network,
      expected,
    );
    const acquired = {
      ...env,
      ADFL_TEST_CONTAINER_ID: expected.containerId,
      ADFL_TEST_NETWORK_ID: expected.networkId,
    };
    for (const args of plan) {
      if (args[0] === 'container') inspectOwnedTestDatabase('cleanup', acquired);
      else
        verifyOwnedTestNetwork(
          env,
          inspection<NetworkInspection>('network', expected.networkId, env),
        );
      docker(args, env);
    }
    captured = undefined;
  };
  const stop = () => {
    try {
      cleanup();
    } finally {
      releaseLock();
    }
  };
  try {
    attempted = true;
    let startFailure: unknown;
    try {
      docker([...compose, 'up', '-d', '--wait', names.service], env);
    } catch (error) {
      startFailure = error;
    }
    // Capture while the lease is still held even when compose only created a partial fixture.
    captureAttemptResources();
    if (startFailure) throw startFailure;
    if (!captured?.containerId)
      throw new Error('Owned test creation did not produce its complete fixture.');
    const acquired = {
      ...env,
      ADFL_TEST_CONTAINER_ID: captured.containerId,
      ADFL_TEST_NETWORK_ID: captured.networkId,
    };
    const owned = inspectOwnedTestDatabase(true, acquired);
    Object.assign(process.env, {
      ADFL_TEST_CONTAINER_ID: owned.containerId,
      ADFL_TEST_NETWORK_ID: owned.networkId,
    });
    return stop;
  } catch (error) {
    try {
      stop();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Isolated test start failed; unsafe cleanup was refused.',
      );
    }
    throw error;
  }
}
