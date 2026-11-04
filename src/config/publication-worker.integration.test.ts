import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PublicationUpdate } from '../payload-types';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { readPublicationRetry } from '../helpers/payload/publication-retries';
import {
  installPublicationProvider,
  runtimePublication,
} from '../helpers/payload/publication-runtime';
import { portfolioPublicationCoordinator } from './publication';
import { createPublicationRetryDrain } from './publication-worker';
import { observedRequest } from '../../testing/fixtures/editorial-lifecycle';
import { withPublicRootWriter } from '../helpers/payload/public-root';
import { confirmPublicationWrite } from '../helpers/payload/confirm-publication-write';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
let previousDirectory: string;
const cleanupOperations: string[] = [];
const firstDue = '2000-01-01T00:00:00.000Z';
const queueClock = () => new Date('2000-01-01T00:00:10.000Z');
let queueOrder = 0;

async function placeInFixtureQueue(operationId: string) {
  cleanupOperations.push(operationId);
  await fixture.payload.db.updateOne({
    collection: 'publication-retries',
    where: { operationId: { equals: operationId } },
    options: { atomic: true },
    data: { nextAttemptAt: new Date(Date.parse(firstDue) + ++queueOrder).toISOString() },
  });
}
afterEach(async () => {
  for (const operationId of cleanupOperations.splice(0))
    await fixture.payload.db.updateOne({
      collection: 'publication-retries',
      where: { operationId: { equals: operationId } },
      options: { atomic: true },
      data: { nextAttemptAt: null },
    });
});
async function pendingOrder() {
  const subject = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic bounded worker order' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await placeInFixtureQueue(subject.latestPublicationIntent!);
  return subject;
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e3-native-publication-worker');
  const alreadyDue = await fixture.payload.db.find({
    collection: 'publication-retries',
    where: { nextAttemptAt: { less_than_equal: queueClock().toISOString() } },
    limit: 1,
  });
  if (alreadyDue.docs.length)
    throw new Error('The synthetic worker queue window is already occupied.');
  previousDirectory = runtimePublication().directory;
  directory = await mkdtemp(path.join(tmpdir(), 'publication-worker-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  const owned = inspectOwnedTestDatabase();
  console.info('Native worker provenance', {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    node: process.versions.node,
    workerEnabled: process.env.PUBLICATION_RETRY_WORKER_ENABLED,
    databasePort: '55434',
  });
});

it.each(['terminal', 'null-actor', 'missing-account', 'stale'] as const)(
  'maintains %s due metadata including version0 so it cannot starve later pending work',
  async (kind) => {
    const blocked = await pendingOrder();
    const operationId = blocked.latestPublicationIntent!;
    if (kind === 'terminal')
      expect(
        (
          await portfolioPublicationCoordinator(directory).retry(
            operationId,
            await fixture.request(),
          )
        )?.state,
      ).toBe('public');
    if (kind === 'stale') {
      const newer = await fixture.payload.update({
        collection: 'cases',
        id: blocked.id,
        data: { sortOrder: 8 },
        req: await observedRequest('cases', blocked.id, await fixture.request()),
        overrideAccess: false,
      });
      await placeInFixtureQueue(newer.latestPublicationIntent!);
    }
    await fixture.payload.db.updateOne({
      collection: 'publication-retries',
      where: { operationId: { equals: operationId } },
      options: { atomic: true },
      data: {
        nextAttemptAt: firstDue,
        ...(kind === 'null-actor' ? { retryUserId: null } : {}),
        ...(kind === 'missing-account' ? { retryUserId: randomUUID() } : {}),
      },
    });
    const later = await pendingOrder();
    const drain = createPublicationRetryDrain({
      payload: async () => fixture.payload,
      directory,
      clock: queueClock,
      batchSize: 1,
    });
    await drain();
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      startedAttemptsVersion: 0,
      nextAttemptAt: null,
    });
    // Stale creates one additional legitimate newer intent before the later row.
    await drain();
    if (kind === 'stale') await drain();
    expect(
      await fixture.payload.db.findOne<PublicationUpdate>({
        collection: 'publication-updates',
        where: { operationId: { equals: later.latestPublicationIntent } },
      }),
    ).toMatchObject({ state: 'public' });
    expect(
      await fixture.payload.db.findOne<PublicationUpdate>({
        collection: 'publication-updates',
        where: { operationId: { equals: operationId } },
      }),
    ).toMatchObject({
      state: kind === 'terminal' ? 'public' : kind === 'stale' ? 'superseded' : 'update-pending',
    });
  },
);

it('does not allocate another immediate post-write attempt while a real pending one waits, but permits explicit manual reset', async () => {
  const subject = await pendingOrder();
  const operationId = subject.latestPublicationIntent!;
  await withPublicRootWriter(directory, async () => {
    expect(await confirmPublicationWrite(subject, await fixture.request())).toMatchObject({
      state: 'update-pending',
    });
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      startedAttemptsVersion: 1,
    });
    expect(await confirmPublicationWrite(subject, await fixture.request())).toMatchObject({
      state: 'update-pending',
    });
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      startedAttemptsVersion: 1,
    });
    expect(
      await retryPublicationUpdate(operationId, await fixture.request(), { mode: 'manual' }),
    ).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      startedAttemptsVersion: 2,
      automaticAttempts: 0,
    });
  });
});

it('advances a bounded cursor past a genuinely Native access-denied pending row without claiming or publishing it', async () => {
  const blocked = await pendingOrder();
  const later = await pendingOrder();
  await fixture.payload.db.updateOne({
    collection: 'publication-retries',
    where: { operationId: { equals: blocked.latestPublicationIntent } },
    options: { atomic: true },
    data: { nextAttemptAt: firstDue },
  });
  const access = fixture.payload.collections.cases.config.access;
  const originalRead = access.read;
  if (!originalRead) throw new Error('Actual Native read policy required.');
  access.read = (args) => (args.id === blocked.id ? false : originalRead(args));
  try {
    const drain = createPublicationRetryDrain({
      payload: async () => fixture.payload,
      directory,
      clock: queueClock,
      batchSize: 1,
    });
    await drain();
    await drain();
    expect(
      await fixture.payload.db.findOne<PublicationUpdate>({
        collection: 'publication-updates',
        where: { operationId: { equals: later.latestPublicationIntent } },
      }),
    ).toMatchObject({ state: 'public' });
    expect(
      await readPublicationRetry(blocked.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({
      startedAttemptsVersion: 0,
      nextAttemptAt: firstDue,
    });
  } finally {
    access.read = originalRead;
  }
});

it('rechecks a terminal public receipt through the existing coordinator when current.json becomes unavailable', async () => {
  const subject = await pendingOrder();
  const operationId = subject.latestPublicationIntent!;
  const retry = async () =>
    retryPublicationUpdate(operationId, await fixture.request(), { mode: 'manual' });
  expect(await retry()).toMatchObject({ ok: true, value: { state: 'public' } });
  const before = await readPublicationRetry(operationId, await fixture.request());
  const current = path.join(directory, 'current.json');
  const preserved = path.join(directory, `saved-${randomUUID()}.json`);
  await rename(current, preserved);
  let blocked = false;
  try {
    await mkdir(current);
    blocked = true;
    expect(await retry()).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    expect(await readPublicationRetry(operationId, await fixture.request())).toEqual(before);
  } finally {
    if (blocked) await rmdir(current);
    await rename(preserved, current);
  }
  expect(await retry()).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(await readPublicationRetry(operationId, await fixture.request())).toEqual(before);
});
afterAll(async () => {
  if (previousDirectory)
    installPublicationProvider(() => portfolioPublicationCoordinator(previousDirectory));
  await fixture?.payload.destroy();
  if (directory) {
    if (
      path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('publication-worker-')
    )
      throw new Error('Publication worker fixture cleanup refused an unowned target.');
    await rm(directory, { recursive: true, force: true });
  }
});

it('drains a due Native intention with its recorded real actor and exactly one durable automatic claim', async () => {
  const subject = await pendingOrder();
  const operationId = subject.latestPublicationIntent!;
  const scheduled = await readPublicationRetry(operationId, await fixture.request());
  expect(scheduled).toMatchObject({ retryUserId: fixture.user.id, startedAttemptsVersion: 0 });
  if (!scheduled?.nextAttemptAt) throw new Error('Native due metadata required.');
  const drain = createPublicationRetryDrain({
    payload: async () => fixture.payload,
    directory,
    clock: () => new Date(Date.parse(scheduled.nextAttemptAt!) + 1),
    batchSize: 5,
  });
  await drain();
  expect(
    await fixture.payload.db.findOne<PublicationUpdate>({
      collection: 'publication-updates',
      where: { operationId: { equals: operationId } },
    }),
  ).toMatchObject({ state: 'public', attempts: 1, targetRevision: subject.editorialRevision });
  expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
    retryUserId: fixture.user.id,
    startedAttemptsVersion: 1,
    automaticAttempts: 1,
    nextAttemptAt: null,
  });
});
