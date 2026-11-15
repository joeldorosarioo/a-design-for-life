import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parse } from 'dotenv';
import { assertLocalDatabase } from '../../src/config/local-database.ts';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory.ts';
import {
  acquireSharedDatabaseRuntime,
  inspectOwnedTestDatabase,
} from '../../testing/setup/owned-test-database.ts';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const dockerBinary = process.platform === 'win32' ? 'docker.exe' : 'docker';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function docker(args, env = process.env) {
  const result = spawnSync(dockerBinary, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  requireCondition(
    !result.error && result.status === 0,
    'The local backup Docker operation failed.',
  );
  return result.stdout.trim();
}

async function privateDirectory(directory) {
  let ancestor = directory;
  while (
    !(await lstat(ancestor).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    }))
  )
    ancestor = path.dirname(ancestor);
  const normalize = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
  requireCondition(
    normalize(await realpath(ancestor)) === normalize(ancestor),
    'The local backup directory must be an unlinked private directory.',
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  const actual = await realpath(directory);
  requireCondition(
    info.isDirectory() && !info.isSymbolicLink() && normalize(actual) === normalize(directory),
    'The local backup directory must be an unlinked private directory.',
  );
}

async function recipientForLocalKey() {
  const directory = path.join(root, '.work/backup-keys');
  await privateDirectory(directory);
  const identity = path.join(directory, 'local.agekey');
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const keygen = path.join(
    root,
    `.toolchain/age-1.3.2-${process.platform}-${process.arch}/bin/age-keygen${suffix}`,
  );
  const existing = await lstat(identity).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing)
    requireCondition(
      existing.isFile() && !existing.isSymbolicLink(),
      'The local recovery identity must be an unlinked private file.',
    );
  else {
    const generated = spawnSync(keygen, ['-o', identity], { encoding: 'utf8', windowsHide: true });
    requireCondition(
      !generated.error && generated.status === 0,
      'Install the pinned age tools before creating a local backup.',
    );
    if (process.platform === 'win32') {
      const sid = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
        ],
        { encoding: 'utf8', windowsHide: true },
      );
      requireCondition(
        sid.status === 0 && /^S-1-[0-9-]+$/.test(sid.stdout.trim()),
        'The local recovery identity access policy could not be prepared.',
      );
      const permissions = spawnSync(
        path.join(process.env.SystemRoot, 'System32/icacls.exe'),
        [identity, '/inheritance:r', '/grant:r', `*${sid.stdout.trim()}:R`],
        { encoding: 'utf8', windowsHide: true },
      );
      requireCondition(
        permissions.status === 0,
        'The local recovery identity access policy could not be applied.',
      );
    }
  }
  const extracted = spawnSync(keygen, ['-y', identity], { encoding: 'utf8', windowsHide: true });
  const recipient = extracted.stdout?.trim();
  requireCondition(
    extracted.status === 0 && /^age1[0-9a-z]{58}$/.test(recipient),
    'The local recovery identity could not be verified.',
  );
  await writeFile(path.join(directory, 'local-recipient.txt'), recipient + '\n', { mode: 0o600 });
  return recipient;
}

function readEnvironment(entries) {
  return Object.fromEntries(
    entries.map((entry) => {
      const split = entry.indexOf('=');
      return [entry.slice(0, split), entry.slice(split + 1)];
    }),
  );
}

export function localMediaStorageRoot(value) {
  if (value === undefined) return undefined;
  const base = path.join(root, '.work/private-media');
  const relative =
    typeof value === 'string' ? path.relative(base, path.resolve(root, value)) : '..';
  requireCondition(
    relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    'The local media storage root must stay within its mounted directory.',
  );
  return path.posix.join('/app/.work/private-media', relative.replaceAll('\\', '/'));
}

export async function localBackupSourceIdentity(workspace = root) {
  const listing = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${workspace}`,
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ],
    {
      cwd: workspace,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  requireCondition(
    !listing.error && listing.status === 0,
    'The local application source identity could not be verified.',
  );
  const files = [...new Set(listing.stdout.split('\0'))]
    .filter((file) => file && !file.startsWith('docs/') && !file.endsWith('.md'))
    .sort();
  const entries = await Promise.all(
    files.map(async (file) => {
      const bytes = await readFile(path.resolve(workspace, file)).catch((error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      return {
        path: file,
        sha256: bytes === null ? null : createHash('sha256').update(bytes).digest('hex'),
      };
    }),
  );
  return {
    revision: 'draft-uncommitted',
    sourceSha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  };
}

/** @param {(binary: string, args: string[], options: import('node:child_process').ExecFileOptionsWithStringEncoding) => Promise<{ stdout: string }>} [execute] */
export async function runLocalBackupContainer(
  containerId,
  leaseLost,
  execute = promisify(execFile),
) {
  const controller = new AbortController();
  leaseLost.then(() => controller.abort());
  try {
    const output = await execute(dockerBinary, ['start', '--attach', containerId], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();
    return output.stdout.trim();
  } catch {
    throw new Error('The local backup job failed or its database reservation was lost.');
  }
}

async function backupLocalApplication(settings, leaseLost) {
  const database = assertLocalDatabase(settings.DATABASE_URI);
  const { containerId: databaseContainerId, container } = inspectOwnedTestDatabase();
  const runtime = readEnvironment(container.Config.Env);
  requireCondition(
    runtime.DATABASE_URI === settings.DATABASE_URI,
    'The local PostgreSQL service must use the current private database configuration.',
  );
  const image = JSON.parse(docker(['image', 'inspect', 'adfl:backup-local']))[0];
  requireCondition(
    /^sha256:[a-f0-9]{64}$/.test(image.Id) &&
      image.Config.Labels?.['org.opencontainers.image.title'] ===
        'A Design for Life operational backup',
    'Build the local operational backup image before creating a backup.',
  );
  const source = await localBackupSourceIdentity();
  const { dependencies, devDependencies, engines, packageManager, type } = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
  );
  const dependencyManifest = {
    dependencies,
    devDependencies,
    engines,
    packageManager,
    type,
    lockSha256: createHash('sha256')
      .update(await readFile(path.join(root, 'pnpm-lock.yaml')))
      .digest('hex'),
  };
  const recipient = await recipientForLocalKey();
  const store = path.join(root, '.work/backup-sets');
  await privateDirectory(store);
  const env = {
    ...process.env,
    APP_ENV: 'local',
    DATABASE_URI: settings.DATABASE_URI,
    PAYLOAD_SECRET: settings.PAYLOAD_SECRET,
    SITE_ORIGIN: settings.SITE_ORIGIN,
    MEDIA_BUCKET: settings.MEDIA_BUCKET,
    MEDIA_STORAGE_DRIVER: settings.MEDIA_STORAGE_DRIVER ?? 'local',
    OPS_LOCAL_DATABASE_TARGET: `${database.hostname}:${database.port || '5432'}${database.pathname}`,
    OPS_BACKUP_SOURCE: 'portfolio-local',
    OPS_BACKUP_RECIPIENT: recipient,
    OPS_SOURCE_REVISION: source.revision,
    OPS_SOURCE_SHA256: source.sourceSha256,
    OPS_BACKUP_DEPENDENCIES: JSON.stringify(dependencyManifest),
    PUBLIC_SITE_ENABLED: 'false',
    PUBLICATION_RETRIES_ENABLED: 'false',
    PUBLICATION_RETRY_WORKER_ENABLED: 'false',
    PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
    PAYLOAD_DROP_DATABASE: 'false',
  };
  const forwarded = [
    'APP_ENV',
    'DATABASE_URI',
    'PAYLOAD_SECRET',
    'SITE_ORIGIN',
    'MEDIA_BUCKET',
    'MEDIA_STORAGE_DRIVER',
    'OPS_LOCAL_DATABASE_TARGET',
    'OPS_BACKUP_SOURCE',
    'OPS_BACKUP_RECIPIENT',
    'OPS_SOURCE_REVISION',
    'OPS_SOURCE_SHA256',
    'OPS_BACKUP_DEPENDENCIES',
    'PUBLIC_SITE_ENABLED',
    'PUBLICATION_RETRIES_ENABLED',
    'PUBLICATION_RETRY_WORKER_ENABLED',
    'PUBLICATION_HTTP_VERIFICATION_ENABLED',
    'PAYLOAD_DROP_DATABASE',
  ];
  if (env.MEDIA_STORAGE_DRIVER === 'r2') {
    for (const key of [
      'R2_ENDPOINT',
      'R2_BUCKET',
      'R2_MEDIA_PREFIX',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]) {
      if (settings[key] === undefined) continue;
      env[key] = settings[key];
      forwarded.push(key);
    }
  }
  if (env.MEDIA_STORAGE_DRIVER === 'local') {
    const mediaRoot = localMediaStorageRoot(settings.MEDIA_STORAGE_ROOT);
    if (mediaRoot !== undefined) {
      env.MEDIA_STORAGE_ROOT = mediaRoot;
      forwarded.push('MEDIA_STORAGE_ROOT');
    }
  }
  const runId = randomUUID();
  const args = [
    'create',
    '--pull=never',
    '--name',
    `adfl-local-backup-${runId}`,
    '--label',
    `life.adfl.local-backup-run=${runId}`,
    '--network',
    `container:${databaseContainerId}`,
    '--user',
    '70:70',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--tmpfs',
    '/app/.work/backup-private:rw,noexec,nosuid,nodev,uid=70,gid=70,mode=0700',
    '--mount',
    `type=bind,source=${store.replaceAll('\\', '/')},target=/app/.work/backup-sets`,
  ];
  await privateDirectory(publicRootDirectory(env));
  const publication = path.join(root, '.work/publication');
  const sources = [
    ['src', '/app/src'],
    ['ops/backup', '/app/ops/backup'],
    ['ops/migrations', '/app/ops/migrations'],
    ['tsconfig.json', '/app/tsconfig.json'],
    [publication, '/app/.work/publication'],
  ];
  for (const [selected, destination] of sources) {
    const file = path.resolve(root, selected);
    requireCondition((await realpath(file)) === file, 'Linked local backup sources are refused.');
    args.push(
      '--mount',
      `type=bind,source=${file.replaceAll('\\', '/')},target=${destination},readonly`,
    );
  }
  if (env.MEDIA_STORAGE_DRIVER === 'local') {
    const media = path.join(root, '.work/private-media');
    await privateDirectory(
      settings.MEDIA_STORAGE_ROOT
        ? path.resolve(root, settings.MEDIA_STORAGE_ROOT)
        : path.join(media, env.MEDIA_BUCKET, database.pathname.slice(1)),
    );
    args.push(
      '--mount',
      `type=bind,source=${media.replaceAll('\\', '/')},target=/app/.work/private-media,readonly`,
    );
  }
  for (const name of forwarded) args.push('--env', name);
  args.push(
    '--entrypoint',
    'node',
    image.Id,
    '--conditions=react-server',
    '--import',
    'tsx',
    '--input-type=module',
    '--eval',
    `
    import { createHash } from 'node:crypto';
    import { readFile } from 'node:fs/promises';
    const expected = JSON.parse(process.env.OPS_BACKUP_DEPENDENCIES);
    const actual = JSON.parse(await readFile('package.json', 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'engines', 'packageManager', 'type']) {
      if (JSON.stringify(actual[field]) !== JSON.stringify(expected[field]))
        throw new Error('Rebuild the local backup image for the current dependencies.');
    }
    if (createHash('sha256').update(await readFile('pnpm-lock.yaml')).digest('hex') !== expected.lockSha256)
      throw new Error('Rebuild the local backup image for the current lockfile.');
    process.argv = [process.execPath, 'ops/backup/job.ts', 'backup'];
    await import('./ops/backup/job.ts');
  `,
  );
  const containerId = docker(args, env);
  requireCondition(
    /^[a-f0-9]{64}$/.test(containerId),
    'The local backup did not return an immutable container identity.',
  );
  const inspect = () => {
    const job = JSON.parse(docker(['inspect', containerId]))[0];
    requireCondition(
      job.Id === containerId &&
        job.Image === image.Id &&
        job.Config.Labels?.['life.adfl.local-backup-run'] === runId &&
        job.Config.User === '70:70' &&
        job.HostConfig.NetworkMode === `container:${databaseContainerId}`,
      'The acquired local backup container identity changed.',
    );
    return job;
  };
  try {
    inspect();
    const output = await runLocalBackupContainer(containerId, leaseLost);
    requireCondition(inspect().State.ExitCode === 0, 'The local backup job failed.');
    const result = JSON.parse(output.split(/\r?\n/).at(-1));
    requireCondition(
      result.status === 'backed-up' &&
        result.marker?.complete === true &&
        result.marker.namespace.environment === 'local' &&
        result.marker.namespace.source === 'portfolio-local',
      'The local backup completion marker could not be verified.',
    );
    requireCondition(
      result.marker.application?.revision === source.revision &&
        result.marker.application?.sourceSha256 === source.sourceSha256 &&
        (await localBackupSourceIdentity()).sourceSha256 === source.sourceSha256,
      'The persisted backup must identify the unchanged host application source.',
    );
    requireCondition(
      /^\d+$/.test(process.env.ADFL_SHARED_DATABASE_LEASE_PID ?? ''),
      'The local database reservation was lost before the backup completed.',
    );
    const namespaceHash = createHash('sha256')
      .update(JSON.stringify(result.marker.namespace))
      .digest('hex');
    const payload = path.join(store, namespaceHash, result.marker.ciphertext.key);
    requireCondition(
      (await stat(payload)).size === result.marker.ciphertext.byteLength,
      'The persisted local backup length differs from the completion marker.',
    );
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(payload)) hash.update(bytes);
    requireCondition(
      hash.digest('hex') === result.marker.ciphertext.sha256,
      'The persisted local backup hash differs from the completion marker.',
    );
    console.log(
      JSON.stringify({
        ...result,
        applicationSource: source,
        backupImage: image.Id,
        persistedFile: payload,
        recoveryIdentityStoredSeparately: true,
      }),
    );
  } finally {
    const job = inspect();
    if (job.State.Running) docker(['stop', '--time', '30', containerId]);
    docker(['rm', '--volumes', containerId]);
  }
}

async function main() {
  requireCondition(process.argv.length === 2, 'The local backup command takes no arguments.');
  process.chdir(root);
  const settings = parse(await readFile(path.join(root, '.env')));
  requireCondition(settings.APP_ENV === 'local', 'The local backup requires APP_ENV=local.');
  assertLocalDatabase(settings.DATABASE_URI);
  Object.assign(process.env, { APP_ENV: 'local', DATABASE_URI: settings.DATABASE_URI });
  const release = await acquireSharedDatabaseRuntime();
  try {
    await backupLocalApplication(settings, release.lost);
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
