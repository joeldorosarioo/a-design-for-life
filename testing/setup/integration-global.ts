import { configureTestEnvironment, assertIsolatedTestEnvironment } from './test-environment';
import { startOwnedTestDatabase } from './owned-test-database';
import { resolveNextDistDir } from '../../src/config/next-dist';
import { configureSharedDatabaseUri } from './local-database-environment';

export default async function setup() {
  configureSharedDatabaseUri();
  configureTestEnvironment();
  assertIsolatedTestEnvironment(process.env);
  resolveNextDistDir(process.env);
  return startOwnedTestDatabase();
}
