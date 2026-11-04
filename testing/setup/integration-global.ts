import { rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { configureTestEnvironment, assertIsolatedTestEnvironment } from './test-environment';
import { startOwnedTestDatabase } from './owned-test-database';
import { resolveNextDistDir, assertUnlinkedWorkspacePath } from '../../src/config/next-dist';

export default async function setup() {
  const env = configureTestEnvironment();
  assertIsolatedTestEnvironment(process.env);
  resolveNextDistDir(process.env);
  const projection = publicRootDirectory(env);
  if (!projection.startsWith(path.resolve('.work/publication') + path.sep))
    throw new Error('Projection cleanup outside isolated test environment refused.');
  const stopDatabase = await startOwnedTestDatabase();
  try {
    // Cleanup follows acquisition: no pre-existing visual resource is ever adopted.
    assertUnlinkedWorkspacePath(projection);
    rmSync(projection, { recursive: true, force: true });
    const result = spawnSync(
      process.execPath,
      ['--conditions=react-server', './node_modules/payload/bin.js', 'migrate'],
      { stdio: 'inherit', env: process.env, windowsHide: true },
    );
    if (result.error || result.status !== 0)
      throw result.error ?? new Error(`Native test migrations failed: ${result.status}`);
  } catch (error) {
    stopDatabase();
    throw error;
  }
  return stopDatabase;
}
