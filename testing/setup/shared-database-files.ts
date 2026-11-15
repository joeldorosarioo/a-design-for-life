import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { assertLocalDatabase, localDatabaseName } from '../../src/config/local-database';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { isolatedTestBucket } from './test-environment';

function localOrigin(value: string | undefined) {
  const url = value && URL.parse(value);
  if (
    !url ||
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Shared database cleanup requires the configured local site origins.');
  return value!;
}

export async function clearSharedDatabaseFiles(input = process.env, root = process.cwd()) {
  root = path.resolve(root);
  if (root !== process.cwd()) assertUnlinkedWorkspacePath(root);
  assertLocalDatabase(input.DATABASE_URI);
  const media = path.resolve(root, '.work/private-media', isolatedTestBucket, localDatabaseName);
  if (
    input.APP_ENV !== 'test' ||
    input.MEDIA_BUCKET !== isolatedTestBucket ||
    input.MEDIA_STORAGE_ROOT !== media
  )
    throw new Error('Shared database cleanup requires the exact private test storage.');
  const file = path.resolve(root, '.env');
  assertUnlinkedWorkspacePath(file, root);
  const local = parse(await readFile(file));
  assertLocalDatabase(local.DATABASE_URI);
  if (
    local.DATABASE_URI !== input.DATABASE_URI ||
    (local.APP_ENV ?? 'local') !== 'local' ||
    !local.MEDIA_BUCKET
  )
    throw new Error('Shared database cleanup differs from the private local configuration.');
  const projection = (APP_ENV: 'local' | 'test', SITE_ORIGIN: string) =>
    path.resolve(
      root,
      '.work/publication',
      path.basename(
        publicRootDirectory({ APP_ENV, SITE_ORIGIN, DATABASE_URI: input.DATABASE_URI! }),
      ),
    );
  const targets = [
    projection('local', localOrigin(local.SITE_ORIGIN)),
    projection('test', localOrigin(input.SITE_ORIGIN)),
    media,
    path.resolve(
      root,
      '.work/editorial-mail',
      createHash('sha256').update(input.DATABASE_URI!).digest('hex').slice(0, 16),
    ),
  ];
  // Validate every exact namespace before removing anything; local media and R2 stay untouched.
  for (const target of targets) assertUnlinkedWorkspacePath(target, root);
  for (const target of targets) await rm(target, { recursive: true, force: true });
}
