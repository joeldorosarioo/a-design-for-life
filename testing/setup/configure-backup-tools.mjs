import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function dockerTestContainerOptions() {
  return [
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    String(process.getuid?.() ?? 0) + ':' + String(process.getgid?.() ?? 0),
  ];
}

async function unlinked(selected) {
  for (let current = selected; ; current = path.dirname(current)) {
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error('Linked backup test setup path refused');
    if (current === path.dirname(current)) return;
  }
}
async function makePrivateDirectory(directory) {
  await chmod(directory, 0o700);
  if (process.platform === 'win32') {
    const system = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    const identity = execFileSync(path.join(system, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const sid = identity.match(/S-1-[0-9-]+/)?.[0];
    if (!sid) throw new Error('Current user identity unavailable for private test tool fixture');
    execFileSync(
      path.join(system, 'icacls.exe'),
      [directory, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F'],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }
}
async function tarBinary() {
  const binary = await realpath(
    process.platform === 'win32'
      ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      : '/usr/bin/tar',
  );
  const version = execFileSync(binary, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  if (
    !/^bsdtar 3\.8\.9(?:\s|$)/.test(version) &&
    !/^tar \(GNU tar\) 1\.35(?:\r?\n|$)/.test(version)
  )
    throw new Error('Backup tar version requires validation');
  return binary;
}
/** @param {{ root?: string }} options */
export async function configureBackupTools({ root = process.cwd() } = {}) {
  if (!path.isAbsolute(root)) throw new Error('Backup test project root must be absolute');
  await unlinked(path.join(root, 'package.json'));
  const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (
    project.name !== 'a-design-for-life' ||
    project.private !== true ||
    project.packageManager !== 'pnpm@12.10.1' ||
    project.engines?.node !== '>=26.13.1 <27' ||
    project.engines?.pnpm !== '12.10.1'
  )
    throw new Error('Backup test identities require the exact pinned project');
  const dockerfile = path.join(root, 'Dockerfile');
  await unlinked(dockerfile);
  if (!(await readFile(dockerfile, 'utf8')).includes('FROM node-base AS backup-crypto'))
    throw new Error('The project backup-crypto Dockerfile target is required');
  const dockerBinary = await realpath(
    process.platform === 'win32'
      ? execFileSync(
          path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'where.exe'),
          ['docker.exe'],
          { encoding: 'utf8', windowsHide: true },
        )
          .trim()
          .split(/\r?\n/)[0]
      : '/usr/bin/docker',
  );
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'adfl-backup-tools-'));
  await makePrivateDirectory(directory);
  let complete = false;
  try {
    const dockerImage = execFileSync(
      dockerBinary,
      ['build', '--platform', 'linux/amd64', '--target', 'backup-crypto', '--quiet', root],
      { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    ).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(dockerImage))
      throw new Error('Immutable backup test image ID required');
    const docker = (tool, args, mounts = []) => {
      const name = 'adfl-test-age-setup-' + randomUUID();
      try {
        return execFileSync(
          dockerBinary,
          [
            'run',
            '--name',
            name,
            '--rm',
            '--pull=never',
            ...dockerTestContainerOptions(),
            ...mounts,
            '--entrypoint',
            '/tmp/age/' + tool,
            dockerImage,
            ...args,
          ],
          {
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
          },
        );
      } finally {
        const removed = spawnSync(dockerBinary, ['rm', '--force', name], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 30_000,
        });
        if (removed.error || (removed.status !== 0 && !/No such container/i.test(removed.stderr)))
          throw new Error('Docker backup test setup container cleanup failed');
      }
    };
    if (
      docker('age', ['--version']).trim() !== 'v1.3.2' ||
      docker('age-keygen', ['--version']).trim() !== 'v1.3.2'
    )
      throw new Error('Backup test image age version requires validation');
    const identityPath = path.join(directory, 'identity.agekey');
    const wrongIdentityPath = path.join(directory, 'wrong-identity.agekey');
    for (const selected of [identityPath, wrongIdentityPath])
      await writeFile(selected, docker('age-keygen', []), { flag: 'wx', mode: 0o600 });
    const recipient = (selected) => {
      if (/[,\r\n\0]/.test(selected)) throw new Error('Unsupported backup identity mount');
      return docker(
        'age-keygen',
        ['-y', '/tmp/test-identity'],
        ['--mount', 'type=bind,src=' + selected + ',dst=/tmp/test-identity,readonly'],
      ).trim();
    };
    const publicRecipient = recipient(identityPath),
      wrongRecipient = recipient(wrongIdentityPath);
    if (
      !/^age1(?:pq1)?[023456789acdefghjklmnpqrstuvwxyz]{20,2048}$/.test(publicRecipient) ||
      publicRecipient === wrongRecipient
    )
      throw new Error('Native synthetic test recipients were not distinct and valid');
    const configPath = path.join(directory, 'tools-config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        dockerBinary,
        dockerImage,
        ageBinary: path.join(directory, process.platform === 'win32' ? 'age.exe' : 'age'),
        tarBinary: await tarBinary(),
        identityPath,
        wrongIdentityPath,
        recipient: publicRecipient,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    complete = true;
    return configPath;
  } finally {
    if (!complete) {
      if (
        path.dirname(directory) !== (await realpath(tmpdir())) ||
        !path.basename(directory).startsWith('adfl-backup-tools-')
      )
        throw new Error('Invalid synthetic backup test cleanup target');
      await rm(directory, { recursive: true, force: true });
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await configureBackupTools());
  } catch {
    console.error('Synthetic Docker backup tool setup failed; private details omitted.');
    process.exitCode = 1;
  }
}
