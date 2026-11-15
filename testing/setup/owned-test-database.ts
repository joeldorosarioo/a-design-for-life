import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { assertLocalDatabase } from '../../src/config/local-database';
import { acquireTestLifecycleLock } from './test-lifecycle-lock';
import { beginOwnedDatabaseOutage, finishOwnedDatabaseOutage } from './owned-database-outage';
import { assertIsolatedTestEnvironment, configureTestEnvironment } from './test-environment';
import { configureSharedDatabaseUri } from './local-database-environment';
import { clearSharedDatabaseFiles } from './shared-database-files';
import {
  testResourceNames,
  verifyOwnedTestResources,
  type Inspection,
  type NetworkInspection,
} from './test-ownership';

export const sharedDatabaseLock = 'adfl:shared-local-database-runtime';

export function localDatabaseDocker(args: string[], env = process.env) {
  assertLocalDatabase(env.DATABASE_URI);
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, env });
  if (result.error || result.status !== 0)
    throw new Error(
      'Isolated test Docker lifecycle command failed; resources were not assumed owned.',
    );
  return result.stdout.trim();
}

function inspection<T>(kind: 'container' | 'network', id: string, env: NodeJS.ProcessEnv): T {
  const values = JSON.parse(localDatabaseDocker([kind, 'inspect', id], env)) as T[];
  if (values.length !== 1) throw new Error('Expected exactly one shared local database resource.');
  return values[0]!;
}

export function inspectOwnedTestDatabase(attached: boolean | 'cleanup' = true, env = process.env) {
  assertLocalDatabase(env.DATABASE_URI);
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
  assertIsolatedTestEnvironment(process.env);
  const owned = inspectOwnedTestDatabase(action === 'disconnect');
  if (action === 'disconnect') beginOwnedDatabaseOutage(owned);
  try {
    localDatabaseDocker(['network', action, owned.networkId, owned.containerId]);
    const verified = inspectOwnedTestDatabase(action === 'connect');
    if (action === 'connect') finishOwnedDatabaseOutage(verified);
  } catch (error) {
    try {
      finishOwnedDatabaseOutage(inspectOwnedTestDatabase());
    } catch {
      // An uncertain attachment retains the expected outage scope.
    }
    throw error;
  }
}

export async function acquireSharedDatabaseRuntime() {
  const uri = assertLocalDatabase(process.env.DATABASE_URI);
  const releaseFile = acquireTestLifecycleLock(process.env.ADFL_TEST_RUN_ID ?? randomUUID());
  const applicationName = `adfl-local-lease-${randomUUID()}`;
  const sqlArguments = [
    'psql',
    '--no-psqlrc',
    '--quiet',
    '--no-align',
    '--tuples-only',
    '--set=ON_ERROR_STOP=1',
    '--host=/var/run/postgresql',
    `--username=${decodeURIComponent(uri.username)}`,
    `--dbname=${uri.pathname.slice(1)}`,
  ];
  let child: ReturnType<typeof spawn> | undefined;
  let closing = false;
  let exited: Promise<void> | undefined;
  let acquired: NodeJS.ProcessEnv | undefined;
  const closeSession = async () => {
    closing = true;
    child?.stdin?.end('\\q\n');
    if (child && exited) {
      const timer = setTimeout(() => child?.kill('SIGTERM'), 5_000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
    if (acquired) {
      const owned = inspectOwnedTestDatabase('cleanup', acquired);
      // Killing the Docker client need not kill its exec; retire only this named session.
      const result = localDatabaseDocker(
        [
          'exec',
          '-i',
          owned.containerId,
          ...sqlArguments,
          '--command',
          `SELECT pg_terminate_backend(pid,5000) FROM pg_stat_activity
          WHERE application_name='${applicationName}' AND datname=current_database()
            AND pid<>pg_backend_pid();`,
        ],
        acquired,
      );
      if (result && result.split(/\s+/).some((value) => value !== 't'))
        throw new Error('The acquired local database session could not be released.');
      const remaining = localDatabaseDocker(
        [
          'exec',
          '-i',
          owned.containerId,
          ...sqlArguments,
          '--command',
          `SELECT count(*) FROM pg_stat_activity
          WHERE application_name='${applicationName}' AND datname=current_database();`,
        ],
        acquired,
      );
      if (remaining !== '0')
        throw new Error('The acquired local database session is still active.');
    }
    delete process.env.ADFL_SHARED_DATABASE_LEASE_PID;
    releaseFile();
  };
  try {
    const names = testResourceNames(process.env);
    const container = inspection<Inspection>('container', names.container, process.env);
    const network = inspection<NetworkInspection>('network', names.network, process.env);
    const owned = verifyOwnedTestResources(process.env, container, network);
    Object.assign(process.env, {
      ADFL_TEST_CONTAINER_ID: owned.containerId,
      ADFL_TEST_NETWORK_ID: owned.networkId,
    });
    acquired = { ...process.env };
    const identity = localDatabaseDocker(
      [
        'exec',
        '--env',
        'PGPASSWORD',
        owned.containerId,
        ...sqlArguments.filter((arg) => !arg.startsWith('--host=')),
        '--host=127.0.0.1',
        '--command',
        `SELECT current_database()='${uri.pathname.slice(1)}'
        AND current_user='${decodeURIComponent(uri.username)}'
        AND current_setting('server_version_num')::int BETWEEN 170000 AND 179999;`,
      ],
      { ...acquired, PGPASSWORD: decodeURIComponent(uri.password) },
    );
    if (identity !== 't')
      throw new Error('The shared local database connection identity is unexpected.');
    // Unix-socket psql remains connected during the suite's intentional bridge outages.
    child = spawn('docker', ['exec', '-i', owned.containerId, ...sqlArguments], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const lease = child;
    exited = new Promise<void>((resolve) => {
      lease.once('exit', () => resolve());
      lease.once('error', () => resolve());
    });
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(
        () => reject(new Error('Shared local database reservation timed out.')),
        10_000,
      );
      const fail = () => {
        clearTimeout(timer);
        reject(new Error('The local database is busy or its identity could not be verified.'));
      };
      lease.once('error', fail);
      lease.once('exit', fail);
      lease.stdin!.once('error', fail);
      lease.stderr!.resume();
      lease.stdout!.on('data', (chunk) => {
        output += String(chunk);
        const pid = /^ADFL_LEASE:(\d+)$/m.exec(output)?.[1];
        if (!pid) return;
        clearTimeout(timer);
        lease.off('error', fail);
        lease.off('exit', fail);
        lease.stdin!.off('error', fail);
        lease.stdin!.on('error', () => {
          delete process.env.ADFL_SHARED_DATABASE_LEASE_PID;
        });
        process.env.ADFL_SHARED_DATABASE_LEASE_PID = pid;
        resolve();
      });
      lease.stdin!.write(`SET application_name='${applicationName}';
      DO $$ BEGIN
        IF current_database() <> '${uri.pathname.slice(1)}'
          OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
          OR NOT pg_try_advisory_lock(hashtextextended('${sharedDatabaseLock}',0))
        THEN RAISE EXCEPTION 'Shared local database reservation refused'; END IF;
        IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND pid<>pg_backend_pid() AND backend_type='client backend')
        THEN RAISE EXCEPTION 'Close other local database clients before continuing'; END IF;
      END $$;
      SELECT 'ADFL_LEASE:' || pg_backend_pid();\n`);
    });
    exited.then(() => {
      if (!closing) delete process.env.ADFL_SHARED_DATABASE_LEASE_PID;
    });
    const release = async () => {
      if (closing) return;
      await closeSession();
    };
    return Object.assign(release, { lost: exited });
  } catch (error) {
    try {
      await closeSession();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Local database reservation failed; its lease was retained for review.',
      );
    }
    throw error;
  }
}

export async function startOwnedTestDatabase() {
  configureSharedDatabaseUri();
  configureTestEnvironment();
  const release = await acquireSharedDatabaseRuntime();
  const { assertSharedDatabaseLease, resetSharedDatabase, migrateSharedDatabase } =
    await import('./shared-database-state');
  const reset = async () => {
    const owned = inspectOwnedTestDatabase('cleanup');
    if (!Object.keys(owned.container.NetworkSettings.Networks).length) {
      localDatabaseDocker(['network', 'connect', owned.networkId, owned.containerId]);
      inspectOwnedTestDatabase();
    }
    await assertSharedDatabaseLease(true);
    await clearSharedDatabaseFiles();
    await resetSharedDatabase();
    await migrateSharedDatabase();
  };
  try {
    await reset();
  } catch (error) {
    await release();
    throw error;
  }
  return async () => {
    try {
      await reset();
    } finally {
      await release();
    }
  };
}
