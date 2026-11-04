import { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  startOwnedNextServer,
  isOwnedNextReady,
  type OwnedNextServerRuntime,
} from './owned-next-server';
import { isolatedTestBucket, isolatedTestDatabaseUri } from './test-environment';

const runId = '4ce282fd-b66c-4fc4-97e2-7c33308f0312';
function environment(): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URI: isolatedTestDatabaseUri,
    MEDIA_BUCKET: isolatedTestBucket,
    MEDIA_STORAGE_ROOT: path.resolve('.work/private-media/adfl-test-runner/adfl_test_runner'),
    PAYLOAD_SECRET: 'synthetic-local-test-secret-for-isolated-payload-only',
    SITE_ORIGIN: 'http://127.0.0.1:3101',
    INTERNAL_HTTP_ORIGIN: 'http://127.0.0.1:3101',
    ADFL_TEST_RUN_ID: runId,
    NEXT_TEST_DIST_DIR: `.work/next-tests/${runId}`,
  };
}

// The forbidden real Next/DB boundary is controlled here; lifecycle decisions
// (ownership, cleanup, restart, failure propagation) run through the actual helper.
function controlledRuntime() {
  const children: ChildProcess[] = [];
  const killed: ChildProcess[] = [];
  const launchedEnvironments: NodeJS.ProcessEnv[] = [];
  const probes: number[] = [];
  let buildId = 'synthetic-existing-next-build';
  let ready = true;
  let clock = 0;
  const runtime: OwnedNextServerRuntime = {
    async readBuildId() {
      return buildId;
    },
    async probe(port) {
      probes.push(port);
    },
    launch(env) {
      // A replacement may only be launched after its predecessor actually exits.
      expect(children.every((child) => child.signalCode !== null || child.exitCode !== null)).toBe(
        true,
      );
      const child = new ChildProcess();
      child.kill = () => {
        killed.push(child);
        Object.defineProperty(child, 'signalCode', { value: 'SIGTERM', configurable: true });
        child.emit('exit', null, 'SIGTERM');
        return true;
      };
      launchedEnvironments.push({ ...env });
      children.push(child);
      return child;
    },
    async healthy() {
      return ready;
    },
    async wait() {
      clock += 10_000;
    },
    now: () => clock,
  };
  return {
    runtime,
    children,
    killed,
    probes,
    launchedEnvironments,
    setBuildId: (value: string) => (buildId = value),
    setReady: (value: boolean) => (ready = value),
  };
}

it('refuses the preserved visual database before probing or launching any process', async () => {
  const control = controlledRuntime();
  const env = environment();
  env.DATABASE_URI = env.DATABASE_URI!.replace(':55434/', ':55433/');
  await expect(startOwnedNextServer({ env }, control.runtime)).rejects.toThrow(/isolated/i);
  expect(control.probes).toEqual([]);
  expect(control.children).toEqual([]);
});

it('accepts only the private uncached health contract when deciding that the owned child is ready', async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  expect(await isOwnedNextReady(Response.json({ status: 'ready' }, { headers }))).toBe(true);
  for (const response of [
    Response.json({ status: 'ready' }),
    Response.json({ status: 'not-ready' }, { headers }),
    Response.json({ status: 'ready', unexpected: true }, { headers }),
    Response.json({ status: 'ready' }, { headers, status: 503 }),
    new Response('<html>Ready</html>', { headers }),
  ])
    expect(await isOwnedNextReady(response)).toBe(false);
});

it.each(['.work/next-build', '.next', '.work/next-tests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])(
  'refuses a build directory outside its acquired run: %s',
  async (dist) => {
    const control = controlledRuntime();
    await expect(
      startOwnedNextServer(
        { env: { ...environment(), NEXT_TEST_DIST_DIR: dist } },
        control.runtime,
      ),
    ).rejects.toThrow(/run|build/i);
    expect(control.probes).toEqual([]);
    expect(control.children).toEqual([]);
  },
);

it.each([3100, 3101, 5432, 55432, 55433, 55434])(
  'refuses a primary, visual or database listener port: %s',
  async (port) => {
    const control = controlledRuntime();
    await expect(
      startOwnedNextServer({ env: environment(), port }, control.runtime),
    ).rejects.toThrow(/port/i);
    expect(control.probes).toEqual([]);
  },
);

it('preserves the canonical root namespace while using its own optimizer loopback and no external integrations', async () => {
  const control = controlledRuntime();
  const env: NodeJS.ProcessEnv = {
    ...environment(),
    R2_ACCESS_KEY_ID: 'synthetic-inherited-external',
    RESEND_API_KEY: 'synthetic-inherited-external',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: 'synthetic-inherited-external',
    EDITORIAL_EMAIL_FROM_ADDRESS: 'synthetic@example.invalid',
  };
  const server = await startOwnedNextServer({ env }, control.runtime);
  try {
    expect(server.origin).toBe('http://127.0.0.1:3102');
    expect(server.buildId).toBe('synthetic-existing-next-build');
    expect(control.probes).toEqual([3102]);
    expect(control.launchedEnvironments[0]).toMatchObject({
      SITE_ORIGIN: 'http://127.0.0.1:3101',
      INTERNAL_HTTP_ORIGIN: 'http://127.0.0.1:3102',
      DATABASE_URI: isolatedTestDatabaseUri,
      NEXT_TEST_DIST_DIR: `.work/next-tests/${runId}`,
      NODE_ENV: 'production',
      MEDIA_STORAGE_DRIVER: 'local',
    });
    for (const key of [
      'R2_ACCESS_KEY_ID',
      'RESEND_API_KEY',
      'NEXT_PUBLIC_GA_MEASUREMENT_ID',
      'EDITORIAL_EMAIL_FROM_ADDRESS',
    ])
      expect(control.launchedEnvironments[0][key]).toBeUndefined();
    expect(env.INTERNAL_HTTP_ORIGIN).toBe('http://127.0.0.1:3101');
    expect(env.R2_ACCESS_KEY_ID).toBe('synthetic-inherited-external');
  } finally {
    await server.stop();
  }
});

it('leaves an occupied port untouched without launching or killing a process', async () => {
  const control = controlledRuntime();
  control.runtime.probe = async () => {
    throw new Error('Port occupied by a process this helper does not own.');
  };
  await expect(startOwnedNextServer({ env: environment() }, control.runtime)).rejects.toThrow(
    /occupied/,
  );
  expect(control.children).toEqual([]);
  expect(control.killed).toEqual([]);
});

it('passes a bound test observer listener only to an explicitly opted-in child', async () => {
  const control = controlledRuntime();
  const listener = createServer();
  try {
    listener.listen({ host: '127.0.0.1', port: 0, exclusive: true });
    await once(listener, 'listening');
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('Expected owned loopback address');
    await expect(
      startOwnedNextServer(
        { env: environment(), publicationObserverListener: listener },
        control.runtime,
      ),
    ).rejects.toThrow(/observer/i);
    expect(control.children).toHaveLength(0);
    const child = await startOwnedNextServer(
      {
        env: { ...environment(), PUBLICATION_HTTP_VERIFICATION_ENABLED: 'true' },
        publicationObserverListener: listener,
      },
      control.runtime,
    );
    try {
      expect(control.launchedEnvironments[0]).toMatchObject({
        INTERNAL_HTTP_ORIGIN: `http://127.0.0.1:${address.port}`,
        SITE_ORIGIN: 'http://127.0.0.1:3101',
      });
      expect(child.origin).toBe('http://127.0.0.1:3102');
    } finally {
      await child.stop();
    }
  } finally {
    if (listener.listening) await new Promise<void>((resolve) => listener.close(() => resolve()));
  }
});

it('restarts only its retained child with the same completed build and immutable environment', async () => {
  const control = controlledRuntime();
  const env = environment();
  const server = await startOwnedNextServer({ env }, control.runtime);
  try {
    env.NEXT_TEST_DIST_DIR = '.next';
    env.SITE_ORIGIN = 'http://127.0.0.1:3100';
    await server.restart();
    expect(control.children).toHaveLength(2);
    expect(control.killed).toEqual([control.children[0]]);
    expect(control.launchedEnvironments[1]).toEqual(control.launchedEnvironments[0]);
    expect(control.probes).toEqual([3102, 3102]);
  } finally {
    await server.stop();
  }
  await server.stop();
  expect(control.killed).toEqual(control.children);
  await expect(server.restart()).rejects.toThrow(/stopped|closed/i);
});

it('refuses a different build on restart while preserving the running owned child', async () => {
  const control = controlledRuntime();
  const server = await startOwnedNextServer({ env: environment() }, control.runtime);
  try {
    control.setBuildId('different-build');
    await expect(server.restart()).rejects.toThrow(/same|changed|build/i);
    expect(control.children).toHaveLength(1);
    expect(control.killed).toEqual([]);
  } finally {
    await server.stop();
  }
});

it('cleans up its own child when readiness never succeeds', async () => {
  const control = controlledRuntime();
  control.setReady(false);
  await expect(startOwnedNextServer({ env: environment() }, control.runtime)).rejects.toThrow(
    /ready|readiness/i,
  );
  expect(control.killed).toEqual(control.children);
  expect(control.children).toHaveLength(1);
});

it('propagates a child launch error instead of mistaking another HTTP response for readiness', async () => {
  const control = controlledRuntime();
  const original = control.runtime.launch;
  control.runtime.launch = (env, port) => {
    const child = original(env, port);
    queueMicrotask(() => child.emit('error', new Error('Synthetic executable launch failure.')));
    return child;
  };
  await expect(startOwnedNextServer({ env: environment() }, control.runtime)).rejects.toThrow(
    /launch failure/,
  );
  expect(control.children).toHaveLength(1);
});
