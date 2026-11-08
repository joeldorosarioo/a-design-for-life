import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  access,
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

const version = '12.4.2';
const distributions = {
  'win32-x64': {
    name: 'qpdf-12.4.2-msvc64.zip',
    sha256: 'db87077e683630c1217e0e8f9a20a9749d952ab676e881c3689187763a5de25d',
    nested: 'qpdf-12.4.2-msvc64',
    binary: 'qpdf.exe',
  },
  'linux-x64': {
    name: 'qpdf-12.4.2-bin-linux-x86_64.zip',
    sha256: 'db367d897829f22c4198ce1094143c9d467bd6ee7dfabc44ba6f02056b24f8b1',
    nested: '',
    binary: 'qpdf',
  },
};
const platform = `${process.platform}-${process.arch}`;
const distribution = distributions[platform];
if (!distribution)
  throw new Error(`QPDF setup has no verified official distribution for ${platform}`);
const toolchain = path.resolve('.toolchain');
const destination = path.join(toolchain, `qpdf-${version}-${platform}`);
const binary = path.join(destination, 'bin', distribution.binary);
const marker = path.join(destination, '.codex-install.json');
const inside = (root, target) => target.startsWith(root + path.sep);
function verifyVersion() {
  const output = execFileSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true });
  if (!output.startsWith(`qpdf version ${version}`))
    throw new Error('Unexpected QPDF version; existing installation preserved');
}
async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
if (await exists(destination)) {
  const installed = JSON.parse(await readFile(marker, 'utf8'));
  if (installed.sha256 !== distribution.sha256)
    throw new Error('Existing installation differs; preserved without replacement');
  verifyVersion();
  console.log(`Verified existing QPDF ${version} (${platform})`);
} else {
  await mkdir(toolchain, { recursive: true });
  const cache = path.resolve('.work/qpdf-downloads');
  await mkdir(cache, { recursive: true });
  const archive = path.join(cache, distribution.name);
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  let bytes = (await exists(archive)) ? await readFile(archive) : undefined;
  if (!bytes || hash(bytes) !== distribution.sha256) {
    const response = await fetch(
      `https://github.com/qpdf/qpdf/releases/download/v${version}/${distribution.name}`,
    );
    if (!response.ok) throw new Error(`QPDF download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== distribution.sha256)
      throw new Error('Official QPDF archive SHA256 mismatch');
    await writeFile(archive, bytes);
  }
  const list =
    process.platform === 'win32'
      ? execFileSync('tar', ['-tf', archive], { encoding: 'utf8', windowsHide: true })
      : execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
  for (const entry of list.split(/\r?\n/).filter(Boolean)) {
    const normalized = entry.replaceAll('\\', '/');
    if (
      normalized.startsWith('/') ||
      /^[a-z]:/i.test(normalized) ||
      normalized.split('/').includes('..')
    )
      throw new Error('Archive path leaves the owned installation');
  }
  const staging = await mkdtemp(path.join(toolchain, '.qpdf-stage-'));
  try {
    if (process.platform === 'win32')
      execFileSync('tar', ['-xf', archive, '-C', staging], { windowsHide: true });
    else execFileSync('unzip', ['-q', archive, '-d', staging]);
    async function checkTree(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (!inside(staging, target)) throw new Error('Invalid extracted path');
        if (entry.isSymbolicLink() && !inside(staging, await realpath(target)))
          throw new Error('Extracted symlink leaves installation');
        if (entry.isDirectory()) await checkTree(target);
      }
    }
    await checkTree(staging);
    const extracted = distribution.nested ? path.join(staging, distribution.nested) : staging;
    await writeFile(
      path.join(extracted, '.codex-install.json'),
      JSON.stringify({ version, platform, sha256: distribution.sha256 }) + '\n',
    );
    const absoluteSource = path.resolve(extracted);
    const absoluteDestination = path.resolve(destination);
    if (!inside(toolchain, absoluteSource) || !inside(toolchain, absoluteDestination))
      throw new Error('QPDF move leaves the owned toolchain');
    await rename(absoluteSource, absoluteDestination);
    verifyVersion();
    console.log(`Installed verified QPDF ${version} (${platform})`);
  } finally {
    const absolute = path.resolve(staging);
    if (!inside(toolchain, absolute) || !path.basename(absolute).startsWith('.qpdf-stage-'))
      throw new Error('Invalid setup cleanup target');
    await rm(absolute, { recursive: true, force: true });
  }
}
