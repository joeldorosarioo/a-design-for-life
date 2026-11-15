import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, open, rm, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { assertLocalDatabase, localDatabaseName } from '../../src/config/local-database';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { inspectOwnedTestDatabase, sharedDatabaseLock } from './owned-test-database';
import { assertIsolatedTestEnvironment } from './test-environment';

type Tool = 'psql' | 'pg_dump' | 'pg_restore';
type Files = { inputFile?: string; outputFile?: string; sql?: string; pinnedInput?: FileHandle };

async function privateInput(file: string) {
  const absolute = path.resolve(file);
  const root = path.resolve('.work');
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Database state files must remain in the private workspace.');
  assertUnlinkedWorkspacePath(absolute);
  const info = await lstat(absolute);
  if (!info.isFile() || info.nlink !== 1)
    throw new Error('Database restore requires an unlinked regular private file.');
  return absolute;
}

async function invoke(tool: Tool, args: string[], files: Files = {}): Promise<string> {
  const uri = assertLocalDatabase(process.env.DATABASE_URI);
  const owned = inspectOwnedTestDatabase('cleanup');
  const user = decodeURIComponent(uri.username);
  if (
    args.some(
      (arg) =>
        /^(?:-h|-p|-d|-U|-C|--host(?:=|$)|--port(?:=|$)|--create$)/.test(arg) ||
        /^(?:postgres|postgresql):/.test(arg) ||
        (arg.startsWith('--dbname') && arg !== `--dbname=${localDatabaseName}`) ||
        (arg.startsWith('--username') && arg !== `--username=${user}`),
    )
  )
    throw new Error('Database tools may only target the acquired shared local database.');
  const inputFile = files.inputFile ? await privateInput(files.inputFile) : undefined;
  if (files.outputFile) {
    assertUnlinkedWorkspacePath(files.outputFile);
    const relative = path.relative(path.resolve('.work'), path.resolve(files.outputFile));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Database dumps must remain in the private workspace.');
  }
  const connection =
    args.length === 1 && args[0] === '--version'
      ? []
      : ['--host=/var/run/postgresql', `--username=${user}`, `--dbname=${localDatabaseName}`];
  const child = spawn('docker', ['exec', '-i', owned.containerId, tool, ...connection, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', () => reject(new Error('Shared local database tool could not start.')));
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Shared local database tool failed; private details omitted.')),
    );
  });
  child.stderr!.resume();
  const streams: Promise<unknown>[] = [];
  let output = '';
  if (files.outputFile) {
    streams.push(
      pipeline(child.stdout!, createWriteStream(files.outputFile, { flags: 'wx', mode: 0o600 })),
    );
  } else {
    child.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
  }
  if (files.pinnedInput)
    streams.push(
      pipeline(files.pinnedInput.createReadStream({ start: 0, autoClose: false }), child.stdin!),
    );
  else if (inputFile) streams.push(pipeline(createReadStream(inputFile), child.stdin!));
  else child.stdin!.end(files.sql ?? '');
  try {
    await Promise.all([completion, ...streams]);
  } catch (error) {
    // Listing can close stdin after its TOC, before a large archive's data reaches Docker.
    if (
      tool === 'pg_restore' &&
      args.includes('--list') &&
      ['EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'].includes((error as NodeJS.ErrnoException).code ?? '')
    ) {
      await completion;
      return output.trim();
    }
    child.kill('SIGTERM');
    throw error;
  }
  return output.trim();
}

export async function assertSharedDatabaseLease(idle = false) {
  assertIsolatedTestEnvironment(process.env);
  const pid = process.env.ADFL_SHARED_DATABASE_LEASE_PID;
  if (!/^[1-9][0-9]*$/.test(pid ?? ''))
    throw new Error('An active shared local database lease is required.');
  const result = await invoke(
    'psql',
    ['--no-psqlrc', '--quiet', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1'],
    {
      sql: `SELECT current_database()='${localDatabaseName}'
      AND current_setting('server_version_num')::int BETWEEN 170000 AND 179999
      AND EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory'
        AND pid=${pid} AND granted AND mode='ExclusiveLock'
        AND classid=((hashtextextended('${sharedDatabaseLock}',0)>>32)&4294967295)::oid
        AND objid=(hashtextextended('${sharedDatabaseLock}',0)&4294967295)::oid AND objsubid=1)
      ${
        idle
          ? `AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
        AND backend_type='client backend' AND pid NOT IN (pg_backend_pid(),${pid}))`
          : ''
      };`,
    },
  );
  if (result !== 't')
    throw new Error(
      'The shared local database lease changed or another application still has open connections.',
    );
}

export async function runSharedDatabaseTool(tool: Tool, args: string[], files: Files = {}) {
  await assertSharedDatabaseLease();
  return invoke(tool, args, files);
}

export async function resetSharedDatabase() {
  await assertSharedDatabaseLease(true);
  await invoke(
    'psql',
    ['--no-psqlrc', '--quiet', '--set=ON_ERROR_STOP=1', '--single-transaction'],
    {
      sql: 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    },
  );
}

export async function migrateSharedDatabase() {
  await assertSharedDatabaseLease(true);
  const result = spawnSync(
    process.execPath,
    ['--conditions=react-server', './node_modules/payload/bin.js', 'migrate'],
    {
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error('Shared local database migrations failed.');
}

async function validatedDump(dumpPath: string) {
  const file = await open(await privateInput(dumpPath), 'r');
  try {
    const header = Buffer.alloc(5);
    await file.read(header, 0, 5, 0);
    if (header.toString('ascii') !== 'PGDMP')
      throw new Error('Shared database restore requires a complete PostgreSQL custom dump.');
    const hash = createHash('sha256');
    for await (const chunk of file.createReadStream({ start: 0, autoClose: false }))
      hash.update(chunk);
    return { file, sha256: hash.digest('hex') };
  } catch (error) {
    await file.close();
    throw error;
  }
}

export async function restoreSharedDatabase(dumpPath: string, expectedSha256?: string) {
  const dump = await validatedDump(dumpPath);
  try {
    if (expectedSha256 && dump.sha256 !== expectedSha256)
      throw new Error('The shared database checkpoint changed; its database was preserved.');
    // Parse the archive before any DROP and keep the same open file through restore.
    await runSharedDatabaseTool('pg_restore', ['--list'], { pinnedInput: dump.file });
    await resetSharedDatabase();
    await runSharedDatabaseTool(
      'pg_restore',
      ['--single-transaction', '--clean', '--if-exists', '--no-owner', '--no-acl'],
      { pinnedInput: dump.file },
    );
  } finally {
    await dump.file.close();
  }
}

export async function checkpointSharedDatabase() {
  await assertSharedDatabaseLease(true);
  const parent = path.resolve('.work/test-database-state');
  assertUnlinkedWorkspacePath(parent);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(parent, 'checkpoint-'));
  await chmod(directory, 0o700);
  const dump = path.join(directory, 'database.dump');
  await runSharedDatabaseTool('pg_dump', ['--format=custom', '--no-owner', '--no-acl'], {
    outputFile: dump,
  });
  const verified = await validatedDump(dump);
  await verified.file.close();
  return async () => {
    await restoreSharedDatabase(dump, verified.sha256);
    assertUnlinkedWorkspacePath(directory);
    await rm(directory, { recursive: true });
  };
}
