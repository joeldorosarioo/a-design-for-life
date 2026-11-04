import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import path from 'node:path';
import { resolveNextDistDir } from '../../src/config/next-dist';
import { assertIsolatedTestEnvironment } from './test-environment';

export type OwnedNextServerRuntime = {
  readBuildId: (directory: string) => Promise<string>;
  probe: (port: number) => Promise<void>;
  launch: (env: NodeJS.ProcessEnv, port: number) => ChildProcess;
  healthy: (origin: string) => Promise<boolean>;
  wait: () => Promise<void>;
  now: () => number;
};

export async function isOwnedNextReady(response: Response): Promise<boolean> {
  try {
    if (
      response.status !== 200 ||
      !response.headers.get('content-type')?.includes('application/json') ||
      !response.headers.get('cache-control')?.includes('no-store') ||
      response.headers.get('x-content-type-options') !== 'nosniff' ||
      !response.headers.get('x-robots-tag')?.includes('noindex')
    ) {
      await response.body?.cancel();
      return false;
    }
    const body: unknown = await response.json();
    return (
      !!body &&
      typeof body === 'object' &&
      Object.keys(body).length === 1 &&
      'status' in body &&
      body.status === 'ready'
    );
  } catch {
    return false;
  }
}

const systemRuntime: OwnedNextServerRuntime = {
  readBuildId: (directory) => readFile(path.join(directory, 'BUILD_ID'), 'utf8'),
  probe: (port) =>
    new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', () =>
        reject(new Error('Owned Next port is occupied; adoption refused.')),
      );
      probe.listen({ host: '127.0.0.1', port, exclusive: true }, () =>
        probe.close((error) => (error ? reject(error) : resolve())),
      );
    }),
  launch: (env, port) =>
    spawn(
      process.execPath,
      [
        './node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    ),
  async healthy(origin) {
    try {
      const response = await fetch(`${origin}/health`, {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(3_000),
      });
      return isOwnedNextReady(response);
    } catch {
      return false;
    }
  },
  wait: () => new Promise((resolve) => setTimeout(resolve, 200)),
  now: () => Date.now(),
};

type OwnedChild = {
  child: ChildProcess;
  exited: Promise<void>;
  terminal: boolean;
  failure?: Error;
};

async function waitForExit(state: OwnedChild) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      state.exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Owned Next child did not exit.')), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Owns only its returned child handle; never adopts, discovers or kills a PID/port. */
export async function startOwnedNextServer(
  options: { env: NodeJS.ProcessEnv; port?: number; publicationObserverListener?: Server },
  runtime: OwnedNextServerRuntime = systemRuntime,
): Promise<{
  origin: string;
  buildId: string;
  distDirectory: string;
  logs: () => string;
  restart: () => Promise<void>;
  stop: () => Promise<void>;
}> {
  const env = { ...options.env };
  assertIsolatedTestEnvironment(env);
  const dist = resolveNextDistDir(env);
  if (dist !== `.work/next-tests/${env.ADFL_TEST_RUN_ID}`)
    throw new Error('Owned Next requires the completed build of its exact isolated run.');
  const canonical = new URL(env.SITE_ORIGIN ?? 'file:///invalid');
  const port = options.port ?? 3102;
  if (
    canonical.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(canonical.hostname) ||
    !Number.isSafeInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    [3100, 3101, 5432, 55432, 55433, 55434, Number(canonical.port || 80)].includes(port)
  )
    throw new Error('Owned Next requires a distinct safe loopback listener port.');
  const origin = `http://127.0.0.1:${port}`;
  let internalOrigin = origin;
  if (options.publicationObserverListener) {
    const listener = options.publicationObserverListener;
    const address = listener.address();
    if (
      env.PUBLICATION_HTTP_VERIFICATION_ENABLED !== 'true' ||
      !listener.listening ||
      !address ||
      typeof address === 'string' ||
      address.address !== '127.0.0.1' ||
      address.port < 1024 ||
      [port, 3100, 3101, 5432, 55432, 55433, 55434, Number(canonical.port || 80)].includes(
        address.port,
      )
    )
      throw new Error('Publication observer requires a distinct owned loopback test listener.');
    internalOrigin = `http://${address.address}:${address.port}`;
  }
  // Preserve SITE_ORIGIN/DB so the secondary server reads the same approved root.
  // Internal HTTP defaults to the child. The observer proof can supply a bound test listener.
  for (const key of Object.keys(env))
    if (
      /^(?:R2_|CLOUDFLARE_|AWS_|S3_|OBJECT_STORAGE_|SMTP_|MAIL_|EMAIL_|EDITORIAL_EMAIL_|RESEND_|POSTMARK_|SENDGRID_|ANALYTICS_|GA_|GOOGLE_ANALYTICS_|NEXT_PUBLIC_(?:GA_|ANALYTICS_|GOOGLE_ANALYTICS_))/i.test(
        key,
      )
    )
      delete env[key];
  Object.assign(env, {
    NODE_ENV: 'production',
    INTERNAL_HTTP_ORIGIN: internalOrigin,
    MEDIA_STORAGE_DRIVER: 'local',
  });
  const distDirectory = path.resolve(dist);
  const buildId = (await runtime.readBuildId(distDirectory)).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(buildId))
    throw new Error('Owned Next completed build ID is invalid.');
  let current: OwnedChild | undefined;
  let closed = false;
  let queue = Promise.resolve();
  let logs = '';
  function record(chunk: Buffer | string) {
    let text = chunk.toString();
    for (const secret of [env.PAYLOAD_SECRET, env.DATABASE_URI])
      if (secret) text = text.replaceAll(secret, '[redacted]');
    logs = (logs + text).slice(-65_536);
  }
  async function stopCurrent() {
    const state = current;
    if (!state) return;
    if (!state.terminal) state.child.kill('SIGTERM');
    try {
      await waitForExit(state);
    } catch {
      if (!state.terminal) state.child.kill('SIGKILL');
      await waitForExit(state);
    }
    if (current === state) current = undefined;
  }
  async function start() {
    await runtime.probe(port);
    const child = runtime.launch({ ...env }, port);
    let resolveExit!: () => void;
    const state: OwnedChild = {
      child,
      terminal: false,
      exited: new Promise((resolve) => (resolveExit = resolve)),
    };
    current = state;
    child.once('error', (error) => {
      state.failure = error;
      state.terminal = true;
      resolveExit();
    });
    child.once('exit', () => {
      state.terminal = true;
      resolveExit();
    });
    child.stdout?.on('data', record);
    child.stderr?.on('data', record);
    const deadline = runtime.now() + 30_000;
    while (true) {
      if (state.failure) throw state.failure;
      if (state.terminal) throw new Error('Owned Next child exited before readiness.');
      const healthy = await runtime.healthy(origin);
      if (state.failure) throw state.failure;
      if (state.terminal) throw new Error('Owned Next child exited before readiness.');
      if (healthy) return;
      if (runtime.now() >= deadline) throw new Error('Owned Next readiness timed out.');
      await runtime.wait();
    }
  }
  function sequential(operation: () => Promise<void>) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  try {
    await start();
  } catch (error) {
    await stopCurrent();
    throw error;
  }
  return {
    origin,
    buildId,
    distDirectory,
    logs: () => logs,
    restart: () =>
      sequential(async () => {
        if (closed) throw new Error('Owned Next server is stopped.');
        if ((await runtime.readBuildId(distDirectory)).trim() !== buildId)
          throw new Error('Owned Next build changed; restart requires the same build.');
        await stopCurrent();
        try {
          await start();
        } catch (error) {
          await stopCurrent();
          throw error;
        }
      }),
    stop: () => {
      closed = true;
      return sequential(stopCurrent);
    },
  };
}
