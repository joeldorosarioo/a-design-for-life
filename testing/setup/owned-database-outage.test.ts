import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  beginOwnedDatabaseOutage,
  finishOwnedDatabaseOutage,
  observeOwnedDatabasePool,
} from './owned-database-outage';
import { isolatedTestBucket, isolatedTestDatabaseUri } from './test-environment';

const env = {
  NODE_ENV: 'test' as const,
  APP_ENV: 'test',
  DATABASE_URI: isolatedTestDatabaseUri,
  MEDIA_BUCKET: isolatedTestBucket,
  MEDIA_STORAGE_ROOT: path.resolve('.work/private-media', isolatedTestBucket, 'adfl_test_runner'),
  ADFL_TEST_RUN_ID: '443f2f55-41c5-499a-9c24-a038128133f7',
  ADFL_TEST_CONTAINER_ID: 'c'.repeat(64),
  ADFL_TEST_NETWORK_ID: 'd'.repeat(64),
};
const owned = { containerId: env.ADFL_TEST_CONTAINER_ID, networkId: env.ADFL_TEST_NETWORK_ID };
let active = false;
function begin() {
  beginOwnedDatabaseOutage(owned, env);
  active = true;
}
function finish() {
  const result = finishOwnedDatabaseOutage(owned, env);
  active = false;
  return result;
}
function pool() {
  return Object.assign(new EventEmitter(), {
    options: { connectionString: isolatedTestDatabaseUri },
  });
}
function dropped() {
  return new Error('Connection terminated unexpectedly');
}
afterEach(() => {
  if (active) finish();
});

it('propagates an idle connection error outside the explicitly controlled outage', () => {
  const fixture = pool();
  observeOwnedDatabasePool(fixture, env);
  const error = dropped();
  expect(() => fixture.emit('error', error)).toThrow(error);
});

it('collects only the two expected connection failures during the owned outage and closes the scope', () => {
  const fixture = pool();
  observeOwnedDatabasePool(fixture, env);
  begin();
  fixture.emit('error', dropped());
  fixture.emit('error', Object.assign(new Error('synthetic reset'), { code: 'ECONNRESET' }));
  expect(finish()).toEqual({ observedPoolErrors: 2 });
  expect(() => fixture.emit('error', dropped())).toThrow('Connection terminated unexpectedly');
});

it('covers previously created fixture pools as well as the active fixture pool', () => {
  const prior = pool();
  const current = pool();
  observeOwnedDatabasePool(prior, env);
  observeOwnedDatabasePool(current, env);
  begin();
  prior.emit('error', dropped());
  current.emit('error', dropped());
  expect(finish()).toEqual({ observedPoolErrors: 2 });
});

it('never collects an unexpected database error even while the outage is active', () => {
  const fixture = pool();
  observeOwnedDatabasePool(fixture, env);
  begin();
  const unexpected = Object.assign(new Error('synthetic unexpected database error'), {
    code: '23505',
  });
  expect(() => fixture.emit('error', unexpected)).toThrow(unexpected);
  expect(finish()).toEqual({ observedPoolErrors: 0 });
});

it.each([
  ['run', { ADFL_TEST_RUN_ID: 'b23d2ca8-7b29-4b03-a16a-62f2b62080b7' }],
  ['container', { ADFL_TEST_CONTAINER_ID: 'e'.repeat(64) }],
  ['network', { ADFL_TEST_NETWORK_ID: 'f'.repeat(64) }],
])('does not collect errors from a pool bound to another %s identity', (_label, foreign) => {
  const fixture = pool();
  observeOwnedDatabasePool(fixture, { ...env, ...foreign });
  begin();
  expect(() => fixture.emit('error', dropped())).toThrow('Connection terminated unexpectedly');
  expect(finish()).toEqual({ observedPoolErrors: 0 });
});

it('refuses collection if the environment changes after the pool was bound', () => {
  const mutable = { ...env };
  const fixture = pool();
  observeOwnedDatabasePool(fixture, mutable);
  begin();
  mutable.ADFL_TEST_NETWORK_ID = 'e'.repeat(64);
  expect(() => fixture.emit('error', dropped())).toThrow('Connection terminated unexpectedly');
  expect(finish()).toEqual({ observedPoolErrors: 0 });
});

it('deduplicates the observer and refuses rebinding a pool to another identity', () => {
  const fixture = pool();
  observeOwnedDatabasePool(fixture, env);
  observeOwnedDatabasePool(fixture, env);
  expect(fixture.listenerCount('error')).toBe(1);
  expect(() =>
    observeOwnedDatabasePool(fixture, { ...env, ADFL_TEST_CONTAINER_ID: 'e'.repeat(64) }),
  ).toThrow('cannot change ownership');
  begin();
  fixture.emit('error', dropped());
  expect(finish()).toEqual({ observedPoolErrors: 1 });
});

it('rejects a different runtime namespace or pool URI before attaching any listener', () => {
  const fixture = pool();
  expect(() =>
    observeOwnedDatabasePool(fixture, {
      ...env,
      DATABASE_URI: 'postgres://synthetic:synthetic@127.0.0.1:5432/adfl_test_foreign',
    }),
  ).toThrow('Exact isolated test runtime namespace');
  fixture.options.connectionString =
    'postgres://synthetic:synthetic@127.0.0.1:5432/adfl_test_foreign';
  expect(() => observeOwnedDatabasePool(fixture, env)).toThrow('exact owned pool namespace');
  expect(fixture.listenerCount('error')).toBe(0);
});

it('rejects a scope not matching the inspected IDs and never nests or closes another scope', () => {
  expect(() => beginOwnedDatabaseOutage({ ...owned, containerId: 'e'.repeat(64) }, env)).toThrow(
    'does not match',
  );
  begin();
  expect(() => beginOwnedDatabaseOutage(owned, env)).toThrow('already active');
  expect(() => finishOwnedDatabaseOutage({ ...owned, networkId: 'e'.repeat(64) }, env)).toThrow(
    'does not match',
  );
  expect(finish()).toEqual({ observedPoolErrors: 0 });
  expect(() => finishOwnedDatabaseOutage(owned, env)).toThrow('No matching');
});

it('requires acquired immutable IDs before beginning a controlled outage', () => {
  expect(() => beginOwnedDatabaseOutage(owned, { ...env, ADFL_TEST_CONTAINER_ID: '' })).toThrow(
    'acquired immutable',
  );
});

it('handles real pg-pool idle-client dispatch in scope and propagates it again after recovery without a socket', async () => {
  const require = createRequire(import.meta.url);
  const driverRequire = createRequire(require.resolve('@payloadcms/db-postgres'));
  const { Pool } = driverRequire('pg');
  class FakeClient extends EventEmitter {
    _queryable = true;
    _ending = false;
    connect(callback: (error: Error | null) => void) {
      queueMicrotask(() => callback(null));
    }
    end(callback?: () => void) {
      this._ending = true;
      queueMicrotask(() => callback?.());
    }
  }
  const fixture = new Pool({
    Client: FakeClient,
    idleTimeoutMillis: 0,
    connectionString: isolatedTestDatabaseUri,
  });
  observeOwnedDatabasePool(fixture, env);
  try {
    const first = await fixture.connect();
    first.release();
    begin();
    first.emit('error', dropped());
    expect(finish()).toEqual({ observedPoolErrors: 1 });
    const recovered = await fixture.connect();
    recovered.release();
    expect(() => recovered.emit('error', dropped())).toThrow('Connection terminated unexpectedly');
  } finally {
    await fixture.end();
  }
});
