import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { ageDistribution, installAge, validateAgeArchiveEntries } from './install-age.mjs';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function scratch() {
  const root = await mkdtemp(path.join(tmpdir(), 'adfl-age-setup-'));
  roots.push(root);
  return root;
}

it('pins only the two verified upstream archives and rejects unsupported architectures', () => {
  expect(ageDistribution('win32', 'x64')).toMatchObject({
    archive: 'age-v1.3.2-windows-amd64.zip',
    sha256: 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7',
  });
  expect(ageDistribution('linux', 'x64')).toMatchObject({
    archive: 'age-v1.3.2-linux-amd64.tar.gz',
    sha256: 'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10',
  });
  expect(() => ageDistribution('linux', 'arm64')).toThrow();
  expect(() => ageDistribution('darwin', 'x64')).toThrow();
});

it.each([
  '/etc/passwd',
  '../outside',
  'age/../../outside',
  'C:/outside',
  'age/file:stream',
  'other/file',
  'age/linked/../outside',
])('refuses an archive path outside the fixed upstream directory: %s', (entry) => {
  expect(() =>
    validateAgeArchiveEntries(
      ['age/', 'age/age.exe', 'age/age-keygen.exe', entry],
      ageDistribution('win32', 'x64'),
    ),
  ).toThrow();
});
it('accepts the exact ordinary upstream tree and requires both native executables', () => {
  const selected = ageDistribution('linux', 'x64');
  expect(() =>
    validateAgeArchiveEntries(['age/', 'age/age', 'age/age-keygen', 'age/LICENSE'], selected),
  ).not.toThrow();
  expect(() => validateAgeArchiveEntries(['age/', 'age/age'], selected)).toThrow();
});
it('never replaces an existing installation with mismatched provenance', async () => {
  const root = await scratch();
  const installed = path.join(root, '.toolchain', `age-1.3.2-${process.platform}-${process.arch}`);
  await mkdir(installed, { recursive: true });
  await writeFile(
    path.join(installed, '.codex-install.json'),
    JSON.stringify({ archiveSha256: 'f'.repeat(64) }),
  );
  await writeFile(path.join(installed, 'preserved.txt'), 'existing tool must remain');
  await expect(installAge({ root })).rejects.toThrow(/existing|installation|provenance/i);
  expect(await readFile(path.join(installed, 'preserved.txt'), 'utf8')).toBe(
    'existing tool must remain',
  );
  await expect(readdir(path.join(root, '.work'))).rejects.toMatchObject({ code: 'ENOENT' });
});
it('rejects a corrupt cached archive without extracting, downloading or replacing it', async () => {
  const root = await scratch();
  const cache = path.join(root, '.work', 'age-downloads');
  await mkdir(cache, { recursive: true });
  const archive = path.join(cache, ageDistribution(process.platform, process.arch).archive);
  await writeFile(archive, 'corrupt synthetic archive');
  await expect(installAge({ root })).rejects.toThrow(/sha256/i);
  expect(await readFile(archive, 'utf8')).toBe('corrupt synthetic archive');
  await expect(
    readdir(path.join(root, '.toolchain', `age-1.3.2-${process.platform}-${process.arch}`)),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
it('refuses a linked toolchain before touching the external target', async () => {
  const root = await scratch();
  const outside = await scratch();
  await symlink(
    outside,
    path.join(root, '.toolchain'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(installAge({ root })).rejects.toThrow(/linked/i);
  expect(await readdir(outside)).toEqual([]);
});
it('requires an absolute project root', async () => {
  await expect(installAge({ root: 'relative-project' })).rejects.toThrow(/absolute/i);
});
