import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const version = '1.3.2';
const archives = Object.freeze({
  'win32-x64': Object.freeze({
    archive: 'age-v1.3.2-windows-amd64.zip',
    sha256: 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7',
    age: 'age.exe',
    keygen: 'age-keygen.exe',
  }),
  'linux-x64': Object.freeze({
    archive: 'age-v1.3.2-linux-amd64.tar.gz',
    sha256: 'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10',
    age: 'age',
    keygen: 'age-keygen',
  }),
});
export function ageDistribution(platform = process.platform, arch = process.arch) {
  const selected = archives[`${platform}-${arch}`];
  if (!selected)
    throw new Error('age setup has no verified official distribution for this platform');
  return selected;
}
function within(root, selected) {
  const relative = path.relative(root, selected);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
    throw new Error('Setup path leaves its owned project');
}
export async function assertUnlinkedProjectPath(root, selected) {
  if (!path.isAbsolute(root) || !path.isAbsolute(selected))
    throw new Error('Setup paths require an absolute project root');
  within(path.resolve(root), path.resolve(selected));
  for (let current = selected; ; current = path.dirname(current)) {
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (info?.isSymbolicLink()) throw new Error('Linked setup path refused');
    if (info && current !== selected && !info.isDirectory())
      throw new Error('Setup ancestor is not a directory');
    if (current === path.dirname(current)) break;
  }
}
export function validateAgeArchiveEntries(entries, distribution) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000)
    throw new Error('Invalid age archive entries');
  const seen = new Set();
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/');
    const trimmed = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    const segments = trimmed.split('/');
    if (
      typeof entry !== 'string' ||
      normalized.length > 256 ||
      !/^[A-Za-z0-9._/-]+$/.test(normalized) ||
      segments[0] !== 'age' ||
      segments.some((segment) => !segment || segment === '.' || segment === '..') ||
      seen.has(normalized)
    )
      throw new Error('Archive path leaves or aliases the fixed age installation');
    seen.add(normalized);
  }
  if (!seen.has(`age/${distribution.age}`) || !seen.has(`age/${distribution.keygen}`))
    throw new Error('Verified age archive is missing a required executable');
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function exists(selected) {
  try {
    await lstat(selected);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function regularBytes(root, selected) {
  await assertUnlinkedProjectPath(root, selected);
  const info = await lstat(selected);
  if (!info.isFile() || info.nlink !== 1)
    throw new Error('Setup requires an unlinked regular file');
  return readFile(selected);
}
function nativeVersion(binary) {
  let result;
  try {
    result = execFileSync(binary, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('Verified age executable could not report its version');
  }
  if (result !== `v${version}`)
    throw new Error('Unexpected age version; existing installation preserved');
  return result;
}
export async function resolveBackupTarBinary() {
  const selected =
    process.platform === 'win32'
      ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      : '/usr/bin/tar';
  const binary = await realpath(selected);
  const result = execFileSync(binary, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!/^bsdtar 3\.8\.9(?:\s|$)/.test(result) && !/^tar \(GNU tar\) 1\.35(?:\r?\n|$)/.test(result))
    throw new Error('Backup tar version requires validation');
  return { binary, version: result };
}
export async function verifyInstalledAge({ root = process.cwd() } = {}) {
  const distribution = ageDistribution();
  const platform = `${process.platform}-${process.arch}`;
  const destination = path.join(root, '.toolchain', `age-${version}-${platform}`);
  await assertUnlinkedProjectPath(root, destination);
  if (!(await exists(destination)))
    throw new Error('Install verified age before configuring backup tools');
  try {
    const marker = JSON.parse(
      (await regularBytes(root, path.join(destination, '.codex-install.json'))).toString('utf8'),
    );
    if (
      Object.keys(marker).sort().join(',') !==
        'ageSha256,archiveSha256,keygenSha256,platform,version' ||
      marker.version !== version ||
      marker.platform !== platform ||
      marker.archiveSha256 !== distribution.sha256 ||
      !/^[a-f0-9]{64}$/.test(marker.ageSha256) ||
      !/^[a-f0-9]{64}$/.test(marker.keygenSha256)
    )
      throw new Error(
        'Existing age installation provenance differs; preserved without replacement',
      );
    const ageBinary = path.join(destination, 'bin', distribution.age);
    const keygenBinary = path.join(destination, 'bin', distribution.keygen);
    if (
      hash(await regularBytes(root, ageBinary)) !== marker.ageSha256 ||
      hash(await regularBytes(root, keygenBinary)) !== marker.keygenSha256
    )
      throw new Error('Existing age installation hashes differ; preserved without replacement');
    nativeVersion(ageBinary);
    nativeVersion(keygenBinary);
    return {
      destination,
      ageBinary,
      keygenBinary,
      version: `v${version}`,
      archiveSha256: distribution.sha256,
    };
  } catch (error) {
    if (error instanceof SyntaxError || error.code === 'ENOENT')
      throw new Error('Existing age installation is incomplete; preserved without replacement');
    throw error;
  }
}
export async function installAge({ root = process.cwd() } = {}) {
  const distribution = ageDistribution();
  const platform = `${process.platform}-${process.arch}`;
  const toolchain = path.join(root, '.toolchain');
  const destination = path.join(toolchain, `age-${version}-${platform}`);
  await assertUnlinkedProjectPath(root, destination);
  if (await exists(destination))
    return { ...(await verifyInstalledAge({ root })), status: 'existing' };
  const cache = path.join(root, '.work', 'age-downloads');
  const archive = path.join(cache, distribution.archive);
  await assertUnlinkedProjectPath(root, archive);
  await mkdir(cache, { recursive: true, mode: 0o700 });
  await assertUnlinkedProjectPath(root, archive);
  if (!(await exists(archive))) {
    const response = await fetch(
      `https://github.com/FiloSottile/age/releases/download/v${version}/${distribution.archive}`,
    );
    if (!response.ok) throw new Error('Official age archive download failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024 || hash(bytes) !== distribution.sha256)
      throw new Error('Official age archive SHA256 mismatch');
    await writeFile(archive, bytes, { flag: 'wx', mode: 0o600 });
  }
  if (hash(await regularBytes(root, archive)) !== distribution.sha256)
    throw new Error(
      'Cached age archive SHA256 mismatch; preserved without extraction or replacement',
    );
  const tar = await resolveBackupTarBinary();
  const entries = execFileSync(tar.binary, ['-tf', archive], {
    encoding: 'utf8',
    windowsHide: true,
  })
    .split(/\r?\n/)
    .filter(Boolean);
  validateAgeArchiveEntries(entries, distribution);
  await mkdir(toolchain, { recursive: true, mode: 0o700 });
  await assertUnlinkedProjectPath(root, toolchain);
  const staging = await mkdtemp(path.join(toolchain, '.age-stage-'));
  try {
    execFileSync(tar.binary, ['-xf', archive, '-C', staging], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    async function checkTree(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const selected = path.join(directory, entry.name);
        await assertUnlinkedProjectPath(root, selected);
        const info = await lstat(selected);
        if (info.isDirectory()) await checkTree(selected);
        else if (!info.isFile() || info.nlink !== 1)
          throw new Error('Age extraction contains linked or special files');
      }
    }
    await checkTree(staging);
    const extracted = path.join(staging, 'age');
    const ageBinary = path.join(extracted, distribution.age),
      keygenBinary = path.join(extracted, distribution.keygen);
    const ageSha256 = hash(await regularBytes(root, ageBinary)),
      keygenSha256 = hash(await regularBytes(root, keygenBinary));
    nativeVersion(ageBinary);
    nativeVersion(keygenBinary);
    await assertUnlinkedProjectPath(root, destination);
    // Atomic exclusive acquisition: a concurrent/pre-existing destination is never adopted/replaced.
    await mkdir(destination, { mode: 0o700 });
    await rename(extracted, path.join(destination, 'bin'));
    await writeFile(
      path.join(destination, '.codex-install.json'),
      JSON.stringify({
        version,
        platform,
        archiveSha256: distribution.sha256,
        ageSha256,
        keygenSha256,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    return { ...(await verifyInstalledAge({ root })), status: 'installed' };
  } finally {
    within(toolchain, staging);
    if (!path.basename(staging).startsWith('.age-stage-'))
      throw new Error('Unsafe age staging cleanup target');
    await assertUnlinkedProjectPath(root, staging);
    await rm(staging, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await installAge();
    console.log(
      `Verified age ${result.version} (${process.platform}-${process.arch}, ${result.status})`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'age setup failed');
    process.exitCode = 1;
  }
}
