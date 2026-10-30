import { rmSync } from 'node:fs';
import path from 'node:path';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { spawnSync } from 'node:child_process';
import { configureTestEnvironment } from './test-environment';

function run(command: string, args: string[]) {
  const env =
    command === 'docker'
      ? { ...process.env, LOCAL_POSTGRES_PASSWORD: 'synthetic-unused-local-service-placeholder' }
      : process.env;
  // Compose interpolates every service; only postgres-test is ever selected here.
  const result = spawnSync(command, args, { stdio: 'inherit', env, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminou com código ${result.status}`);
}

const compose = ['compose', '-f', 'compose.local.yaml'];

export default function setup() {
  const env = configureTestEnvironment();
  const projection = publicRootDirectory(env);
  if (
    env.APP_ENV !== 'test' ||
    !new URL(env.DATABASE_URI).pathname.startsWith('/adfl_test_') ||
    !projection.startsWith(path.resolve('.work/publication') + path.sep)
  )
    throw new Error('Projection cleanup outside isolated test environment refused.');
  rmSync(projection, { recursive: true, force: true });
  run('docker', [...compose, 'up', '-d', '--wait', 'postgres-test']);
  try {
    // Run official migrations in their native Node/tsx loader, outside Vite's module runner.
    run(process.execPath, [
      '--conditions=react-server',
      './node_modules/payload/bin.js',
      'migrate',
    ]);
  } catch (error) {
    run('docker', [...compose, 'rm', '--stop', '--force', 'postgres-test']);
    throw error;
  }
  return () => run('docker', [...compose, 'rm', '--stop', '--force', 'postgres-test']);
}
