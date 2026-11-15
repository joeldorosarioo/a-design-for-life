import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import path from 'node:path';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';

function currentUserLeaseDirectory() {
  const user = userInfo();
  const identity = createHash('sha256')
    .update(`${user.uid}:${user.username}`)
    .digest('hex')
    .slice(0, 20);
  return path.join(tmpdir(), `adfl-test-runner-${identity}`);
}

// The same lease covers development and tests across this OS user's checkouts.
// A PostgreSQL session lock also excludes other users of the local Docker service.
export function acquireTestLifecycleLock(
  runId: string,
  checkoutRoot = process.cwd(),
  leaseDirectory = currentUserLeaseDirectory(),
) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId))
    throw new Error('Invalid shared local database lifecycle identity.');
  const directory = path.resolve(leaseDirectory);
  const file = path.join(directory, 'postgres-5432.lock');
  assertUnlinkedWorkspacePath(file, directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const ownership = JSON.stringify({
    token: randomUUID(),
    runId,
    checkoutRoot: path.resolve(checkoutRoot),
  });
  try {
    writeFileSync(file, ownership, { flag: 'wx', mode: 0o600 });
  } catch {
    throw new Error('The shared local database is already reserved by development or tests.');
  }
  let held = true;
  return () => {
    if (!held) return;
    assertUnlinkedWorkspacePath(file, directory);
    if (readFileSync(file, 'utf8') !== ownership)
      throw new Error('Owned test lifecycle lock changed.');
    rmSync(file);
    held = false;
  };
}

export async function prepareTestLifecycle<T>(
  runId: string,
  preflight: () => T | Promise<T>,
  checkoutRoot = process.cwd(),
  leaseDirectory = currentUserLeaseDirectory(),
) {
  const releaseLock = acquireTestLifecycleLock(runId, checkoutRoot, leaseDirectory);
  try {
    return { releaseLock, preflightReceipt: await preflight() };
  } catch (error) {
    releaseLock();
    throw error;
  }
}
