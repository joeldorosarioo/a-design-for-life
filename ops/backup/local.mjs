import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'dotenv';

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
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  const actual = await realpath(directory);
  const normalize = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
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
  const base = '/app/.work/private-media';
  const selected =
    typeof value === 'string' && path.posix.isAbsolute(value)
      ? path.posix.normalize(value)
      : undefined;
  requireCondition(
    selected !== undefined && (selected === base || selected.startsWith(base + '/')),
    'The local media storage root must stay within its mounted volume.',
  );
  return selected;
}

async function main() {
  requireCondition(process.argv.length === 2, 'The local backup command takes no arguments.');
  const settings = parse(await readFile(path.join(root, '.env')));
  const appId = docker([
    'compose',
    '--project-name',
    'a-design-for-life-local',
    '-f',
    'compose.local.yaml',
    'ps',
    '--quiet',
    'portfolio',
  ]);
  requireCondition(
    /^[a-f0-9]{64}$/.test(appId),
    'Start the local portfolio Compose service before creating a backup.',
  );
  const app = JSON.parse(docker(['inspect', appId]))[0];
  const runtime = readEnvironment(app.Config.Env);
  requireCondition(
    app.Id === appId &&
      app.State.Running &&
      app.Config.User === '70:70' &&
      runtime.APP_ENV === 'local',
    'The local portfolio runtime identity is unexpected.',
  );
  for (const key of ['DATABASE_URI', 'PAYLOAD_SECRET', 'SITE_ORIGIN', 'MEDIA_BUCKET']) {
    requireCondition(
      settings[key] && settings[key] === runtime[key],
      'The local portfolio must be restarted with the current private environment configuration.',
    );
  }
  const database = new URL(settings.DATABASE_URI);
  requireCondition(
    ['postgres:', 'postgresql:'].includes(database.protocol) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname),
    'The local backup requires the explicit loopback PostgreSQL connection.',
  );
  const publication = app.Mounts.find((mount) => mount.Destination === '/app/.work/publication');
  requireCondition(
    publication?.Type === 'volume' && /^[a-zA-Z0-9_.-]+$/.test(publication.Name),
    'The local publication volume could not be identified.',
  );
  const image = JSON.parse(docker(['image', 'inspect', 'adfl:backup-local']))[0];
  requireCondition(
    /^sha256:[a-f0-9]{64}$/.test(image.Id) &&
      image.Config.Labels?.['org.opencontainers.image.title'] ===
        'A Design for Life operational backup',
    'Build the local operational backup image before creating a backup.',
  );
  const applicationImage = JSON.parse(docker(['image', 'inspect', app.Image]))[0];
  const applicationRevision = applicationImage.Config.Labels?.['org.opencontainers.image.revision'];
  requireCondition(
    applicationImage.Id === app.Image &&
      /^sha256:[a-f0-9]{64}$/.test(app.Image) &&
      typeof applicationRevision === 'string' &&
      /^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/.test(applicationRevision),
    'The local application image needs its immutable identity and source revision label.',
  );
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
    MEDIA_STORAGE_DRIVER: runtime.MEDIA_STORAGE_DRIVER ?? 'local',
    OPS_LOCAL_DATABASE_TARGET: `${database.hostname}:${database.port || '5432'}${database.pathname}`,
    OPS_BACKUP_SOURCE: 'portfolio-local',
    OPS_BACKUP_RECIPIENT: recipient,
    OPS_APPLICATION_IMAGE_ID: app.Image,
    OPS_APPLICATION_REVISION: applicationRevision,
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
    'OPS_APPLICATION_IMAGE_ID',
    'OPS_APPLICATION_REVISION',
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
      if (runtime[key] === undefined) continue;
      requireCondition(
        settings[key] === runtime[key],
        'The current R2 source configuration differs from the local runtime.',
      );
      env[key] = runtime[key];
      forwarded.push(key);
    }
  }
  if (env.MEDIA_STORAGE_DRIVER === 'local') {
    const mediaRoot = localMediaStorageRoot(runtime.MEDIA_STORAGE_ROOT);
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
    `container:${appId}`,
    '--user',
    '70:70',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--tmpfs',
    '/app/.work/backup-private:rw,noexec,nosuid,nodev,uid=70,gid=70,mode=0700',
    '--mount',
    `type=volume,source=${publication.Name},target=/app/.work/publication,readonly,volume-nocopy`,
    '--mount',
    `type=bind,source=${store.replaceAll('\\', '/')},target=/app/.work/backup-sets`,
  ];
  if (env.MEDIA_STORAGE_DRIVER === 'local') {
    const media = app.Mounts.find((mount) => mount.Destination === '/app/.work/private-media');
    requireCondition(
      media?.Type === 'volume' && /^[a-zA-Z0-9_.-]+$/.test(media.Name),
      'The local private media volume could not be identified.',
    );
    args.push(
      '--mount',
      `type=volume,source=${media.Name},target=/app/.work/private-media,readonly,volume-nocopy`,
    );
  }
  for (const name of forwarded) args.push('--env', name);
  args.push(image.Id, 'backup');
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
        job.HostConfig.NetworkMode === `container:${appId}`,
      'The acquired local backup container identity changed.',
    );
    return job;
  };
  try {
    inspect();
    const output = docker(['start', '--attach', containerId]);
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
      result.marker.application?.imageId === app.Image &&
        result.marker.application?.revision === applicationRevision,
      'The persisted backup must identify the inspected source application image and revision.',
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
        applicationImage: app.Image,
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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
