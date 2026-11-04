import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { acquireTestLifecycleLock, prepareTestLifecycle } from './test-lifecycle-lock';
const runId = '443f2f55-41c5-499a-9c24-a038128133f7';
const otherRunId = 'e865e644-0b6b-4aac-bfac-e7d8609cd037';
let root: string;
let firstCheckout: string;
let secondCheckout: string;
let sharedLease: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'adfl-shared-lease-'));
  firstCheckout = path.join(root, 'first-checkout');
  secondCheckout = path.join(root, 'second-checkout');
  sharedLease = path.join(root, 'current-user-shared-lease');
  mkdirSync(firstCheckout);
  mkdirSync(secondCheckout);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});
it.each([runId, otherRunId])(
  'serializes distinct checkout roots on shared port55434 even for run %s',
  (secondRunId) => {
    const firstRelease = acquireTestLifecycleLock(runId, firstCheckout, sharedLease);
    const before = readFileSync(path.join(sharedLease, 'postgres-55434.lock'), 'utf8');
    let secondRelease: (() => void) | undefined;
    try {
      expect(() => {
        secondRelease = acquireTestLifecycleLock(secondRunId, secondCheckout, sharedLease);
      }).toThrow(/lock/i);
      expect(readFileSync(path.join(sharedLease, 'postgres-55434.lock'), 'utf8')).toBe(before);
    } finally {
      secondRelease?.();
      firstRelease();
    }
  },
);
it('releases only its own lease and lets a different checkout and UUID acquire it', () => {
  const release = acquireTestLifecycleLock(runId, firstCheckout, sharedLease);
  release();
  release();
  expect(readdirSync(sharedLease)).toEqual([]);
  acquireTestLifecycleLock(otherRunId, secondCheckout, sharedLease)();
});
it('refuses a changed ownership token without deleting the replacement lease', () => {
  const release = acquireTestLifecycleLock(runId, firstCheckout, sharedLease);
  const file = path.join(sharedLease, 'postgres-55434.lock');
  writeFileSync(file, 'different-owner-token');
  expect(() => release()).toThrow(/lock changed/i);
  expect(readFileSync(file, 'utf8')).toBe('different-owner-token');
});
it('rejects traversal identities before writing a shared lease directory', () => {
  expect(() => acquireTestLifecycleLock('../../foreign', firstCheckout, sharedLease)).toThrow(
    /identity/i,
  );
  expect(existsSync(sharedLease)).toBe(false);
});
it('refuses a linked shared lease ancestor even when the checkout itself is unlinked', () => {
  const outside = path.join(root, 'linked-destination');
  mkdirSync(outside);
  symlinkSync(outside, sharedLease, 'junction');
  expect(() => acquireTestLifecycleLock(runId, firstCheckout, sharedLease)).toThrow(/linked/i);
  expect(readdirSync(outside)).toEqual([]);
});
it('refuses the second checkout before its Docker/preflight boundary and permits it only after release', async () => {
  const marker = path.join(secondCheckout, 'preflight-reached');
  const first = await prepareTestLifecycle(
    runId,
    () => 'first-absence-receipt',
    firstCheckout,
    sharedLease,
  );
  try {
    await expect(
      prepareTestLifecycle(
        otherRunId,
        () => {
          writeFileSync(marker, 'reached');
          return 'second-absence-receipt';
        },
        secondCheckout,
        sharedLease,
      ),
    ).rejects.toThrow(/lock/i);
    expect(existsSync(marker)).toBe(false);
  } finally {
    first.releaseLock();
  }
  const second = await prepareTestLifecycle(
    otherRunId,
    () => {
      writeFileSync(marker, 'reached');
      return 'second-absence-receipt';
    },
    secondCheckout,
    sharedLease,
  );
  expect(second.preflightReceipt).toBe('second-absence-receipt');
  expect(readFileSync(marker, 'utf8')).toBe('reached');
  second.releaseLock();
});
it('releases the shared lease when preflight fails before a resource attempt', async () => {
  await expect(
    prepareTestLifecycle(
      runId,
      () => {
        throw new Error('Synthetic preflight failure');
      },
      firstCheckout,
      sharedLease,
    ),
  ).rejects.toThrow('Synthetic preflight failure');
  const second = await prepareTestLifecycle(
    otherRunId,
    () => 'absence-recorded',
    secondCheckout,
    sharedLease,
  );
  expect(second.preflightReceipt).toBe('absence-recorded');
  second.releaseLock();
});
