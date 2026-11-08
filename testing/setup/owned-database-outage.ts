import type { EventEmitter } from 'node:events';
import { assertIsolatedTestEnvironment, isolatedTestDatabaseUri } from './test-environment';

type Identity = {
  runId: string;
  containerId: string;
  networkId: string;
  databaseUri: string;
  mediaBucket: string;
  mediaStorageRoot: string;
};
type FixturePool = EventEmitter & { options?: { connectionString?: string } };
type Outage = { identity: Identity; observedPoolErrors: number };
const stateKey = Symbol.for('a-design-for-life.owned-test-database-outage');
const shared = globalThis as typeof globalThis & {
  [stateKey]?: { active?: Outage; pools: WeakMap<FixturePool, Identity> };
};
const state = (shared[stateKey] ??= { pools: new WeakMap<FixturePool, Identity>() });

function identity(env: NodeJS.ProcessEnv): Identity {
  assertIsolatedTestEnvironment(env);
  if (
    !/^[a-f0-9]{64}$/.test(env.ADFL_TEST_CONTAINER_ID ?? '') ||
    !/^[a-f0-9]{64}$/.test(env.ADFL_TEST_NETWORK_ID ?? '')
  )
    throw new Error('Controlled database outage requires acquired immutable test identities.');
  return Object.freeze({
    runId: env.ADFL_TEST_RUN_ID!,
    containerId: env.ADFL_TEST_CONTAINER_ID!,
    networkId: env.ADFL_TEST_NETWORK_ID!,
    databaseUri: env.DATABASE_URI!,
    mediaBucket: env.MEDIA_BUCKET!,
    mediaStorageRoot: env.MEDIA_STORAGE_ROOT!,
  });
}
function same(left: Identity, right: Identity) {
  return (Object.keys(left) as (keyof Identity)[]).every((key) => left[key] === right[key]);
}
function inspectedIdentity(
  owned: { containerId: string; networkId: string },
  env: NodeJS.ProcessEnv,
) {
  const selected = identity(env);
  if (selected.containerId !== owned.containerId || selected.networkId !== owned.networkId)
    throw new Error('Controlled database outage does not match the inspected owned resources.');
  return selected;
}

/** Only call after inspecting the acquired, attached container and network. */
export function beginOwnedDatabaseOutage(
  owned: { containerId: string; networkId: string },
  env = process.env,
) {
  const selected = inspectedIdentity(owned, env);
  if (state.active) throw new Error('A controlled database outage is already active.');
  state.active = { identity: selected, observedPoolErrors: 0 };
}

/** Only call after verifying that those same resources are attached again. */
export function finishOwnedDatabaseOutage(
  owned: { containerId: string; networkId: string },
  env = process.env,
) {
  const selected = inspectedIdentity(owned, env);
  if (!state.active || !same(state.active.identity, selected))
    throw new Error('No matching controlled database outage can be closed.');
  const observedPoolErrors = state.active.observedPoolErrors;
  state.active = undefined;
  return { observedPoolErrors };
}

/** Native destroy() retains pools; bind each fixture pool once, including old fixtures. */
export function observeOwnedDatabasePool(pool: FixturePool, env = process.env) {
  const selected = identity(env);
  if (pool.options?.connectionString !== isolatedTestDatabaseUri)
    throw new Error('Controlled database errors require the exact owned pool namespace.');
  const previous = state.pools.get(pool);
  if (previous) {
    if (!same(previous, selected))
      throw new Error('An observed test pool cannot change ownership.');
    return;
  }
  pool.on('error', (error: unknown) => {
    const active = state.active;
    const expected =
      error instanceof Error &&
      (error.message === 'Connection terminated unexpectedly' ||
        ('code' in error && error.code === 'ECONNRESET'));
    if (!active || !same(active.identity, selected) || !same(identity(env), selected) || !expected)
      throw error;
    active.observedPoolErrors++;
  });
  state.pools.set(pool, selected);
}
