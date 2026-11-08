import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertUnlinkedProjectPath,
  resolveBackupTarBinary,
  verifyInstalledAge,
} from './install-age.mjs';

function syntheticEnvironment(env) {
  try {
    const database = new URL(env.DATABASE_URI),
      site = new URL(env.SITE_ORIGIN);
    if (
      env.APP_ENV !== 'test' ||
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
      database.username !== 'adfl_test' ||
      database.password !== 'synthetic-local-test-only' ||
      !/^\/adfl_test_[a-z0-9_]+$/.test(database.pathname) ||
      database.search ||
      database.hash ||
      !/^adfl-test-[a-z0-9-]+$/.test(env.MEDIA_BUCKET ?? '') ||
      site.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(site.hostname) ||
      site.pathname !== '/' ||
      site.search ||
      site.hash ||
      site.username ||
      site.password
    )
      throw new Error();
  } catch {
    throw new Error(
      'Backup tool identities require APP_ENV=test and the synthetic local test namespace',
    );
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
      [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } else if (((await lstat(directory)).mode & 0o077) !== 0)
    throw new Error('Test identity directory is not private');
}
/** @param {{ root?: string, env?: Partial<NodeJS.ProcessEnv> }} options */
export async function configureBackupTools({ root = process.cwd(), env = process.env } = {}) {
  syntheticEnvironment(env);
  await assertUnlinkedProjectPath(root, path.join(root, 'package.json'));
  const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (
    project.name !== 'a-design-for-life' ||
    project.private !== true ||
    project.packageManager !== 'pnpm@12.10.1' ||
    project.engines?.node !== '>=24.22.2 <25' ||
    project.engines?.pnpm !== '12.10.1'
  )
    throw new Error('Backup test identities require the exact pinned project');
  const installed = await verifyInstalledAge({ root });
  const tar = await resolveBackupTarBinary();
  const parent = path.join(root, '.work', 'test-tool-identities');
  const directory = path.join(parent, randomUUID());
  await assertUnlinkedProjectPath(root, directory);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await assertUnlinkedProjectPath(root, directory);
  await mkdir(directory, { mode: 0o700 });
  await makePrivateDirectory(directory);
  const identityPath = path.join(directory, 'identity.agekey');
  const wrongIdentityPath = path.join(directory, 'wrong-identity.agekey');
  for (const selected of [identityPath, wrongIdentityPath]) {
    await assertUnlinkedProjectPath(root, selected);
    // Native keygen writes its private output to a fresh file, never stdout/logs.
    execFileSync(installed.keygenBinary, ['--output', selected], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await chmod(selected, 0o600);
    const info = await lstat(selected);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1 ||
      (process.platform !== 'win32' && (info.mode & 0o077) !== 0)
    )
      throw new Error('Test identity file is not a private regular file');
  }
  const publicRecipient = (selected) =>
    execFileSync(installed.keygenBinary, ['-y', selected], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const recipient = publicRecipient(identityPath),
    wrongRecipient = publicRecipient(wrongIdentityPath);
  if (
    !/^age1(?:pq1)?[023456789acdefghjklmnpqrstuvwxyz]{20,2048}$/.test(recipient) ||
    recipient === wrongRecipient
  )
    throw new Error('Native synthetic test recipients were not distinct and valid');
  const configPath = path.join(directory, 'tools-config.json');
  await assertUnlinkedProjectPath(root, configPath);
  await writeFile(
    configPath,
    JSON.stringify({
      ageBinary: installed.ageBinary,
      tarBinary: tar.binary,
      identityPath,
      wrongIdentityPath,
      recipient,
    }) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  return configPath;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await configureBackupTools());
  } catch {
    console.error('Synthetic backup tool fixture setup failed; private details omitted.');
    process.exitCode = 1;
  }
}
