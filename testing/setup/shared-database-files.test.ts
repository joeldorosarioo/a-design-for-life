import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { syntheticLocalDatabaseUri } from './local-database-environment';
import { clearSharedDatabaseFiles } from './shared-database-files';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assertUnlinkedWorkspacePath(root);
    await rm(root, { recursive: true, force: true });
  }
});

async function fixture() {
  const root = path.resolve('.work', `shared-files-unit-${randomUUID()}`);
  roots.push(root);
  await mkdir(root, { recursive: true });
  const input: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URI: syntheticLocalDatabaseUri,
    SITE_ORIGIN: 'http://127.0.0.1:3101',
    MEDIA_BUCKET: 'adfl-test-runner',
    MEDIA_STORAGE_ROOT: path.join(
      root,
      '.work/private-media/adfl-test-runner/a_design_for_life_rebuild',
    ),
  };
  await writeFile(
    path.join(root, '.env'),
    [
      'APP_ENV=local',
      `DATABASE_URI=${syntheticLocalDatabaseUri}`,
      'SITE_ORIGIN=http://localhost:3000',
      'MEDIA_BUCKET=existing-local-media',
      'MEDIA_STORAGE_ROOT=outside-the-owned-test-namespace',
    ].join('\n'),
  );
  const projection = (APP_ENV: string, SITE_ORIGIN: string) =>
    path.join(
      root,
      '.work/publication',
      path.basename(
        publicRootDirectory({ APP_ENV, SITE_ORIGIN, DATABASE_URI: syntheticLocalDatabaseUri }),
      ),
    );
  const local = projection('local', 'http://localhost:3000');
  const test = projection('test', input.SITE_ORIGIN!);
  const mail = path.join(
    root,
    '.work/editorial-mail',
    createHash('sha256').update(syntheticLocalDatabaseUri).digest('hex').slice(0, 16),
  );
  const neighbors = [
    projection('staging', 'http://localhost:3000'),
    path.join(root, '.work/private-media/existing-local-media/a_design_for_life_rebuild'),
  ];
  const targets = [local, test, input.MEDIA_STORAGE_ROOT!, mail];
  for (const directory of [...targets, ...neighbors]) {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'sentinel'), 'preserve until its exact reset');
  }
  return { root, input, local, test, targets, neighbors };
}

it('clears local/test projections, test media and captured email while preserving neighboring namespaces', async () => {
  const data = await fixture();
  await clearSharedDatabaseFiles(data.input, data.root);
  for (const target of data.targets)
    await expect(lstat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  for (const neighbor of data.neighbors)
    expect(await readFile(path.join(neighbor, 'sentinel'), 'utf8')).toBe(
      'preserve until its exact reset',
    );
});

it('refuses a linked target before removing any namespace or following the link', async () => {
  const data = await fixture();
  const target = data.input.MEDIA_STORAGE_ROOT!;
  await rm(target, { recursive: true });
  await symlink(data.neighbors[0]!, target, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(clearSharedDatabaseFiles(data.input, data.root)).rejects.toThrow(/linked/i);
  expect(await readFile(path.join(data.local, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
  expect(await readFile(path.join(data.test, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
  expect(await readFile(path.join(data.neighbors[0]!, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
});

it('refuses an unrelated database before removing local files', async () => {
  const data = await fixture();
  await expect(
    clearSharedDatabaseFiles(
      {
        ...data.input,
        DATABASE_URI: syntheticLocalDatabaseUri.replace(
          'a_design_for_life_rebuild',
          'other_database',
        ),
      },
      data.root,
    ),
  ).rejects.toThrow(/shared local/i);
  expect(await readFile(path.join(data.local, 'sentinel'), 'utf8')).toBe(
    'preserve until its exact reset',
  );
});
