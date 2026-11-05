import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { embeddedDatabaseTarget, stagingDatabaseOnly } from './staging-mode.mjs';

const databasePort = '5432';
const run = promisify(execFile);

function databaseSettings(env) {
  const { url, user, database } = embeddedDatabaseTarget(env);

  const postgresEnv = { PATH: env.PATH, LANG: env.LANG, PGDATA: env.PGDATA };
  const versionPath = path.join(env.PGDATA, 'PG_VERSION');
  if (existsSync(versionPath)) {
    if (readFileSync(versionPath, 'utf8').trim() !== '17')
      throw new Error('Expected a PostgreSQL 17 data directory.');
  } else {
    const password = decodeURIComponent(url.password);
    if (!password || /[\0\r\n]/.test(password))
      throw new Error('Fresh PostgreSQL initialization requires a password.');
    Object.assign(postgresEnv, {
      POSTGRES_DB: database,
      POSTGRES_USER: user,
      POSTGRES_PASSWORD: password,
    });
  }

  return { user, database, postgresEnv };
}

async function probeDatabase({ user, database, env, signal }) {
  const args = ['-h', '127.0.0.1', '-p', databasePort, '-U', user, '-d', database, '-t', '1'];
  while (!signal.aborted) {
    try {
      await run('pg_isready', args, { env, timeout: 1500, signal });
      return;
    } catch (error) {
      if (error.code !== 1 && error.code !== 2) throw error;
    }
    await delay(250, undefined, { signal });
  }
  signal.throwIfAborted();
}

function watch(child) {
  const completion = Promise.withResolvers();
  let alive = true;
  const finish = () => {
    alive = false;
    completion.resolve('exited');
  };
  child.once('exit', finish);
  child.once('error', finish);
  return {
    exited: completion.promise,
    stop: async (signal) => {
      if (!alive) return;
      child.kill(signal);
      const timer = new AbortController();
      try {
        const result = await Promise.race([
          completion.promise,
          delay(12_000, 'timeout', { signal: timer.signal }),
        ]);
        if (result === 'timeout') child.kill('SIGKILL');
      } finally {
        timer.abort();
      }
    },
  };
}

export async function startLocalStack({
  env = process.env,
  signal = new AbortController().signal,
  launch = spawn,
  waitForDatabase = probeDatabase,
} = {}) {
  if (signal.aborted) return 0;
  const databaseOnly = stagingDatabaseOnly(env);
  const { postgresEnv, user, database } = databaseSettings(env);
  const requestStop = Promise.withResolvers();
  const abort = () => requestStop.resolve('stopping');
  signal.addEventListener('abort', abort, { once: true });

  const startup = new AbortController();
  let postgres;
  let next;
  try {
    postgres = watch(
      launch(
        '/usr/local/bin/docker-entrypoint.sh',
        ['postgres', '-p', databasePort, '-c', 'listen_addresses=*'],
        { env: postgresEnv, stdio: 'inherit' },
      ),
    );
    const ready = waitForDatabase({
      user,
      database,
      env: { PATH: env.PATH, LANG: env.LANG },
      signal: AbortSignal.any([startup.signal, AbortSignal.timeout(90_000)]),
    }).then(() => 'ready');
    const opening = await Promise.race([requestStop.promise, postgres.exited, ready]);
    if (opening !== 'ready') return opening === 'stopping' ? 0 : 1;
    if (signal.aborted) return 0;

    if (databaseOnly) {
      const closing = await Promise.race([requestStop.promise, postgres.exited]);
      return closing === 'stopping' ? 0 : 1;
    }

    next = watch(launch(process.execPath, ['server.js'], { env, stdio: 'inherit' }));
    const closing = await Promise.race([requestStop.promise, postgres.exited, next.exited]);
    return closing === 'stopping' ? 0 : 1;
  } finally {
    startup.abort();
    signal.removeEventListener('abort', abort);
    try {
      await next?.stop('SIGTERM');
    } finally {
      await postgres?.stop('SIGINT');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    if (process.getuid?.() === 0) throw new Error('Container runtime must be non-root.');
    process.exitCode = await startLocalStack({ signal: controller.signal });
    if (process.exitCode !== 0) console.error('A local stack process exited.');
  } catch {
    console.error(
      'Local stack startup failed. Check the database volume and runtime configuration.',
    );
    process.exitCode = 1;
  } finally {
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
  }
}
