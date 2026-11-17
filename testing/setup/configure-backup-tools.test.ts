import { mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configureBackupTools, dockerTestContainerOptions } from './configure-backup-tools.mjs';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== path.resolve(tmpdir()) ||
      !path.basename(root).startsWith('adfl-backup-tool-fixture-')
    )
      throw new Error('Invalid backup tool fixture cleanup target');
    await rm(root, { recursive: true, force: true });
  }
});
it('uses the host identity to read private test inputs with capabilities and network disabled', () => {
  expect(dockerTestContainerOptions()).toEqual([
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    String(process.getuid?.() ?? 0) + ':' + String(process.getgid?.() ?? 0),
  ]);
});
it('preserves a nonroot Linux owner instead of falling back to container root', () => {
  const previous = ['getuid', 'getgid'].map((key) => Object.getOwnPropertyDescriptor(process, key));
  let options: string[];
  try {
    Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1001 });
    Object.defineProperty(process, 'getgid', { configurable: true, value: () => 1002 });
    options = dockerTestContainerOptions();
  } finally {
    for (const [index, key] of ['getuid', 'getgid'].entries()) {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(process, key, descriptor);
      else Reflect.deleteProperty(process, key);
    }
  }
  expect(options.slice(-2)).toEqual(['--user', '1001:1002']);
});
async function project(name = 'a-design-for-life') {
  const root = await mkdtemp(path.join(tmpdir(), 'adfl-backup-tool-fixture-'));
  roots.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      packageManager: 'pnpm@12.10.1',
      engines: { node: '>=26.13.1 <27', pnpm: '12.10.1' },
    }),
  );
  return root;
}
it('does not generate keys in a different project', async () => {
  const root = await project('unrelated-project');
  await expect(configureBackupTools({ root })).rejects.toThrow(/project/i);
  expect(await readdir(root)).toEqual(['package.json']);
});
it('requires the project Dockerfile without consulting application environment settings', async () => {
  const root = await project();
  await expect(configureBackupTools({ root })).rejects.toThrow(/Dockerfile/i);
  expect(await readdir(root)).toEqual(['package.json']);
});
it('requires an absolute project root', async () => {
  await expect(configureBackupTools({ root: 'relative-project' })).rejects.toThrow(/absolute/i);
});
it('refuses a linked project before reading or building its Docker target', async () => {
  const root = await project(),
    outside = await project();
  const linked = path.join(root, 'linked');
  await symlink(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(configureBackupTools({ root: linked })).rejects.toThrow(/linked/i);
  expect(await readdir(outside)).toEqual(['package.json']);
});
