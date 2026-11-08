import { spawnSync } from 'node:child_process';
import { configureTestEnvironment } from './test-environment';
import { inspectOwnedTestDatabase, startOwnedTestDatabase } from './owned-test-database';

configureTestEnvironment();
const stop = await startOwnedTestDatabase();
try {
  for (const args of [
    ['migrate'],
    ['run', 'src/config/provision-structural-documents.cli.ts'],
    ['run', 'testing/fixtures/check-editorial-roundtrip.ts'],
    ['migrate:down'],
    ['migrate'],
    ['run', 'src/config/provision-structural-documents.cli.ts'],
    ['run', 'testing/fixtures/check-editorial-roundtrip.ts'],
  ]) {
    inspectOwnedTestDatabase();
    const result = spawnSync(
      process.execPath,
      ['--conditions=react-server', './node_modules/payload/bin.js', ...args],
      { env: process.env, windowsHide: true, stdio: 'inherit' },
    );
    if (result.error || result.status !== 0)
      throw result.error ?? new Error(`Native roundtrip command failed: ${args[0]}`);
  }
} finally {
  stop();
}
