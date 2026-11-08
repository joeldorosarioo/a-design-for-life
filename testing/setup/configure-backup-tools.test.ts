import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configureBackupTools } from './configure-backup-tools.mjs';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
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
      engines: { node: '>=24.22.2 <25', pnpm: '12.10.1' },
    }),
  );
  return root;
}
const synthetic = () => ({
  APP_ENV: 'test',
  DATABASE_URI: 'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_tools',
  MEDIA_BUCKET: 'adfl-test-tools',
  SITE_ORIGIN: 'http://127.0.0.1:3100',
});
it.each(['local', 'staging', 'production', undefined])(
  'generates no identity outside APP_ENV=test: %s',
  async (APP_ENV) => {
    const root = await project();
    await expect(configureBackupTools({ root, env: { ...synthetic(), APP_ENV } })).rejects.toThrow(
      /synthetic|test/i,
    );
    expect(await readdir(root)).toEqual(['package.json']);
  },
);
it.each([
  {
    DATABASE_URI: 'postgres://adfl_test:synthetic-local-test-only@database.invalid/adfl_test_tools',
  },
  { DATABASE_URI: 'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/production' },
  { DATABASE_URI: 'postgres://adfl_test:real-credential@127.0.0.1:55434/adfl_test_tools' },
  { MEDIA_BUCKET: 'production-media' },
  { SITE_ORIGIN: 'https://public.invalid' },
])('refuses a non-synthetic namespace before creating files', async (override) => {
  const root = await project();
  await expect(
    configureBackupTools({ root, env: { ...synthetic(), ...override } }),
  ).rejects.toThrow(/synthetic|test/i);
  expect(await readdir(root)).toEqual(['package.json']);
});
it('does not generate keys in a different project', async () => {
  const root = await project('unrelated-project');
  await expect(configureBackupTools({ root, env: synthetic() })).rejects.toThrow(/project/i);
  expect(await readdir(root)).toEqual(['package.json']);
});
it('requires verified installation instead of downloading tools during identity generation', async () => {
  const root = await project();
  await mkdir(path.join(root, '.toolchain'));
  await expect(configureBackupTools({ root, env: synthetic() })).rejects.toThrow(/install/i);
  expect(await readdir(root)).toEqual(['.toolchain', 'package.json']);
});
