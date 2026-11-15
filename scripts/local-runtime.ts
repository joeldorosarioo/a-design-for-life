import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { configureSharedDatabaseUri } from '../testing/setup/local-database-environment';
import { acquireSharedDatabaseRuntime } from '../testing/setup/owned-test-database';

async function stopLocalProcess(
  child: ChildProcess,
  platform: NodeJS.Platform,
  mode: 'dev' | 'start',
) {
  if (child.exitCode !== null || child.signalCode !== null) {
    if (platform === 'win32' && mode === 'dev')
      throw new Error(
        'The Windows development process tree could not be confirmed after its CLI exited; its database reservation was retained.',
      );
    return;
  }
  if (!child.pid || !Number.isSafeInteger(child.pid) || child.pid <= 0)
    throw new Error('The local application process identity is unavailable.');
  if (platform === 'win32') {
    const binary = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
    await new Promise<void>((resolve, reject) => {
      execFile(binary, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, (error) => {
        if (error)
          reject(
            new Error(
              'The owned local application process tree could not be stopped; its database reservation was retained.',
            ),
          );
        else resolve();
      });
    });
  } else if (!child.kill('SIGTERM')) {
    throw new Error(
      'The owned local application process could not be stopped; its database reservation was retained.',
    );
  }
}

export async function runLocalRuntime(
  mode: 'dev' | 'start',
  args: string[] = [],
  platform = process.platform,
) {
  const release = await acquireSharedDatabaseRuntime();
  let child: ChildProcess;
  try {
    child = spawn(
      process.execPath,
      ['./node_modules/next/dist/bin/next', mode, '--hostname', '127.0.0.1', ...args],
      {
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
  } catch (error) {
    await release();
    throw error;
  }
  let requestStop!: () => void;
  const requested = new Promise<void>((resolve) => {
    requestStop = resolve;
  });
  const stop = () => requestStop();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let stopped = false;
  try {
    const exited = once(child, 'exit');
    const result = await Promise.race([
      exited.then(([code]) => ({ code, stop: false })),
      release.lost.then(() => ({ code: 1, stop: true })),
      requested.then(() => ({ code: 0, stop: true })),
    ]);
    if (!result.stop && platform === 'win32' && mode === 'dev')
      throw new Error(
        'The Windows development CLI exited before its process tree could be confirmed; its database reservation was retained.',
      );
    if (result.stop) await stopLocalProcess(child, platform, mode);
    await exited;
    stopped = true;
    return typeof result.code === 'number' ? result.code : 1;
  } catch (error) {
    if (!child.pid) stopped = true;
    throw error;
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    if (stopped) await release();
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'dev' && mode !== 'start')
    throw new Error('Expected the local dev or start command.');
  loadEnv({ quiet: true });
  if (process.env.APP_ENV && process.env.APP_ENV !== 'local')
    throw new Error('Local development requires APP_ENV=local.');
  process.env.APP_ENV = 'local';
  process.env.DATABASE_URI = configureSharedDatabaseUri();
  process.exitCode = await runLocalRuntime(mode, process.argv.slice(3));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
