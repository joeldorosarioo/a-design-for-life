import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLocalReq, type CollectionSlug, type PayloadRequest } from 'payload';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import type { PublicationUpdate } from '@/payload-types';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../testing/fixtures/editorial-lifecycle';
import { portfolioPublicationCoordinator } from '../../config/publication';
import { inspectOwnedTestDatabase } from '../../../testing/setup/owned-test-database';
import * as retryMigration from '../../migrations/20261104_012603_publication_retry_metadata';
import * as coordinationMigration from '../../migrations/20261030_124550_publication_coordination';
import { readPublicRoot } from './public-root';
import {
  claimPublicationRetry,
  readPublicationRetry,
  recordPublicationRetryOutcome,
  schedulePublicationRetry,
  type PublicationRetryClaim,
} from './publication-retries';

// This suite is prepared for a separately coordinated owned PostgreSQL55434 run.
// No inline schema creation: the first RED must observe missing Native persistence.
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const retryCollection = 'publication-retries' as CollectionSlug;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e3-persisted-publication-retries');
  const owned = inspectOwnedTestDatabase();
  // Diagnostic through the actual Native adapter pool; no business data query.
  const version = await fixture.payload.db.pool.query<{ server_version: string }>(
    'SHOW server_version',
  );
  console.info('Native retry provenance', {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    image: owned.container.Config.Image,
    postgres: version.rows[0]?.server_version,
    node: process.versions.node,
    enabled: process.env.PUBLICATION_RETRIES_ENABLED,
    databasePort: '55434',
  });
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

function claimed(result: PublicationRetryClaim) {
  expect(result.kind).toBe('claimed');
  if (result.kind !== 'claimed') throw new Error('Expected a durably claimed Native retry.');
  return result;
}
async function outbox(operationId: string, req?: PayloadRequest) {
  return fixture.payload.db.findOne<PublicationUpdate>({
    collection: 'publication-updates',
    where: { operationId: { equals: operationId } },
    req,
  });
}
async function nativeTransaction() {
  const req = await fixture.request();
  const transaction = await fixture.payload.db.beginTransaction();
  if (!transaction) throw new Error('Real Native editorial transaction required.');
  req.transactionID = transaction;
  return { req, transaction };
}
async function createScheduledCase() {
  const { req, transaction } = await nativeTransaction();
  let committed = false;
  try {
    const subject = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic persisted retry', sortOrder: 1 },
      req,
      overrideAccess: false,
    });
    const operationId = subject.latestPublicationIntent!;
    const retry = await schedulePublicationRetry(operationId, req, () => new Date());
    expect(retry).not.toBeNull();
    if (!retry?.nextAttemptAt) throw new Error('Expected a real persisted due time.');
    await fixture.payload.db.commitTransaction(transaction);
    committed = true;
    return { subject, operationId, retry };
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
}
async function ownedDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-retries-'));
  return {
    directory,
    remove: async () => {
      if (
        path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
        !path.basename(directory).startsWith('publication-retries-')
      )
        throw new Error('Retry fixture cleanup refused an unowned filesystem target.');
      await rm(directory, { recursive: true, force: true });
    },
  };
}

it('persists retry actor and due time in the same Native editorial transaction while remaining invisible before COMMIT', async () => {
  const { req, transaction } = await nativeTransaction();
  let committed = false;
  try {
    const before = Date.now();
    const subject = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic transaction-bound retry' },
      req,
      overrideAccess: false,
    });
    const operationId = subject.latestPublicationIntent!;
    expect(await outbox(operationId, req)).toMatchObject({ state: 'update-pending', attempts: 0 });
    await schedulePublicationRetry(operationId, req, () => new Date());
    const retry = await readPublicationRetry(operationId, req);
    expect(retry).toMatchObject({
      operationId,
      retryUserId: fixture.user.id,
      startedAttemptsVersion: 0,
      automaticAttempts: 0,
    });
    if (!retry?.nextAttemptAt) throw new Error('Expected a persisted Native retry instant.');
    expect(Date.parse(retry.nextAttemptAt)).toBeGreaterThanOrEqual(before + 1_000);
    expect(Date.parse(retry.nextAttemptAt)).toBeLessThanOrEqual(Date.now() + 1_000);
    expect(await outbox(operationId, await fixture.request())).toBeNull();
    expect(await readPublicationRetry(operationId, await fixture.request())).toBeNull();
    await fixture.payload.db.commitTransaction(transaction);
    committed = true;
    expect(await readPublicationRetry(operationId, await fixture.request())).toEqual(retry);
    expect(await outbox(operationId, await fixture.request())).toMatchObject({
      targetRevision: subject.editorialRevision,
      state: 'update-pending',
      attempts: 0,
    });
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
});

it('rolls back execution metadata with its actual editorial intention and cannot independently claim uncommitted work', async () => {
  const { req, transaction } = await nativeTransaction();
  let operationId = '';
  try {
    const subject = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic rolled-back retry' },
      req,
      overrideAccess: false,
    });
    operationId = subject.latestPublicationIntent!;
    expect(await schedulePublicationRetry(operationId, req, () => new Date())).not.toBeNull();
    expect(await readPublicationRetry(operationId, req)).not.toBeNull();
    expect(
      await claimPublicationRetry(
        operationId,
        { mode: 'manual' },
        await fixture.request(),
        () => new Date(),
      ),
    ).toEqual({ kind: 'skip', reason: 'missing-operation' });
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  expect(await outbox(operationId, await fixture.request())).toBeNull();
  expect(await readPublicationRetry(operationId, await fixture.request())).toBeNull();
});

it('gives two Native CAS claimers reading the same persisted version exactly one winner', async () => {
  const scheduled = await createScheduledCase();
  const readVersions: number[] = [];
  let release!: () => void;
  const bothRead = new Promise<void>((resolve) => (release = resolve));
  const findOne = fixture.payload.db.findOne.bind(fixture.payload.db);
  // Hold actual completed Native reads before their CAS writes; no row/result is
  // fabricated. This distinguishes a real conditional claim from a lucky serial run.
  fixture.payload.db.findOne = (async (args: Parameters<typeof fixture.payload.db.findOne>[0]) => {
    const document = await findOne(args);
    if (args.collection === retryCollection && document && readVersions.length < 2) {
      readVersions.push(
        (document as unknown as { startedAttemptsVersion: number }).startedAttemptsVersion,
      );
      if (readVersions.length === 2) release();
      await bothRead;
    }
    return document;
  }) as typeof fixture.payload.db.findOne;
  try {
    const results = await Promise.all([
      claimPublicationRetry(
        scheduled.operationId,
        { mode: 'automatic' },
        await fixture.request(),
        () => new Date(scheduled.retry.nextAttemptAt!),
      ),
      claimPublicationRetry(
        scheduled.operationId,
        { mode: 'automatic' },
        await fixture.request(),
        () => new Date(scheduled.retry.nextAttemptAt!),
      ),
    ]);
    expect(readVersions).toEqual([0, 0]);
    expect(results.filter((result) => result.kind === 'claimed')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'skip')).toHaveLength(1);
  } finally {
    release();
    fixture.payload.db.findOne = findOne;
  }
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toMatchObject({
    startedAttemptsVersion: 1,
    automaticAttempts: 1,
    nextAttemptAt: new Date(Date.parse(scheduled.retry.nextAttemptAt!) + 5_000).toISOString(),
  });
  expect((await outbox(scheduled.operationId))?.attempts).toBe(0);
});

it('retains a durably started version despite real filesystem failure without double-incrementing legacy coordinator attempts', async () => {
  const scheduled = await createScheduledCase();
  const started = claimed(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'immediate' },
      await fixture.request(),
      () => new Date(),
    ),
  );
  const owned = await ownedDirectory();
  try {
    await mkdir(path.join(owned.directory, 'current.json'));
    const receipt = await portfolioPublicationCoordinator(owned.directory).retry(
      scheduled.operationId,
      await fixture.request(),
    );
    expect(receipt).toMatchObject({ operationId: scheduled.operationId, state: 'update-pending' });
    if (!receipt) throw new Error('The committed intention must retain its pending receipt.');
    expect(
      await recordPublicationRetryOutcome(
        { attempt: started.attempt, receipt },
        await fixture.request(),
      ),
    ).toMatchObject({ kind: 'recorded' });
    expect(
      await readPublicationRetry(scheduled.operationId, await fixture.request()),
    ).toMatchObject({
      startedAttemptsVersion: 1,
      automaticAttempts: 0,
      nextAttemptAt: started.retry.nextAttemptAt,
    });
    expect(await outbox(scheduled.operationId)).toMatchObject({
      state: 'update-pending',
      attempts: 0,
    });
  } finally {
    await owned.remove();
  }
});

it('skips stale and future outcome versions after a newer manual attempt without replacing its schedule', async () => {
  const scheduled = await createScheduledCase();
  const first = claimed(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'immediate' },
      await fixture.request(),
      () => new Date(),
    ),
  );
  const second = claimed(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'manual' },
      await fixture.request(),
      () => new Date('2030-01-01T00:00:00.000Z'),
    ),
  );
  expect(second.attempt.version).toBe(2);
  const receipt = {
    operationId: scheduled.operationId,
    targetRevision: scheduled.subject.editorialRevision!,
    state: 'update-pending' as const,
  };
  for (const attempt of [first.attempt, { operationId: scheduled.operationId, version: 3 }])
    expect(
      await recordPublicationRetryOutcome({ attempt, receipt }, await fixture.request()),
    ).toEqual({ kind: 'skip', reason: 'stale-outcome' });
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toEqual(
    second.retry,
  );
  expect((await outbox(scheduled.operationId))?.state).toBe('update-pending');
});

it('records only independently confirmed core outcomes and never turns execution metadata into public authority', async () => {
  const scheduled = await createScheduledCase();
  const started = claimed(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'immediate' },
      await fixture.request(),
      () => new Date(),
    ),
  );
  const unconfirmed = {
    operationId: scheduled.operationId,
    targetRevision: scheduled.subject.editorialRevision!,
    state: 'public' as const,
  };
  expect(
    await recordPublicationRetryOutcome(
      { attempt: started.attempt, receipt: unconfirmed },
      await fixture.request(),
    ),
  ).toEqual({ kind: 'skip', reason: 'not-confirmed' });
  expect(await outbox(scheduled.operationId)).toMatchObject({
    state: 'update-pending',
    attempts: 0,
  });
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toEqual(
    started.retry,
  );
  const owned = await ownedDirectory();
  try {
    const receipt = await portfolioPublicationCoordinator(owned.directory).retry(
      scheduled.operationId,
      await fixture.request(),
    );
    expect(receipt?.state).toBe('public');
    if (!receipt) throw new Error('Existing coordinator must independently confirm its own ACK.');
    expect(
      await recordPublicationRetryOutcome(
        { attempt: started.attempt, receipt },
        await fixture.request(),
      ),
    ).toMatchObject({
      kind: 'recorded',
      retry: { startedAttemptsVersion: 1, nextAttemptAt: null },
    });
    expect(await outbox(scheduled.operationId)).toMatchObject({ state: 'public', attempts: 1 });
  } finally {
    await owned.remove();
  }
});

it('routes a newer native intention to existing stale reconciliation without allocating the old target another attempt', async () => {
  const scheduled = await createScheduledCase();
  const newer = await fixture.payload.update({
    collection: 'cases',
    id: scheduled.subject.id,
    data: { sortOrder: 9 },
    req: await observedRequest('cases', scheduled.subject.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(newer.latestPublicationIntent).not.toBe(scheduled.operationId);
  expect(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'manual' },
      await fixture.request(),
      () => new Date(),
    ),
  ).toEqual({ kind: 'reconcile-stale', operationId: scheduled.operationId });
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toMatchObject({
    startedAttemptsVersion: 0,
  });
});

it('keeps the approved immutable intention claimable after a real newer private draft changes editorialRevision', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic private-draft retry owner' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const { req, transaction } = await nativeTransaction();
  let committed = false;
  let content:
    | { id: string; latestPublicationIntent?: string | null; editorialRevision?: string | null }
    | undefined;
  try {
    content = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(media.id),
        case: parent.id,
        locale: 'pt',
        title: 'Synthetic approved immutable body',
        _status: 'published',
      },
      req,
      overrideAccess: false,
    });
    expect(
      await schedulePublicationRetry(content.latestPublicationIntent!, req, () => new Date()),
    ).not.toBeNull();
    await fixture.payload.db.commitTransaction(transaction);
    committed = true;
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  if (!content?.latestPublicationIntent || !content.editorialRevision)
    throw new Error('Expected the committed Native content intention and revision.');
  const draft = await fixture.payload.update({
    collection: 'case-content',
    id: content.id,
    draft: true,
    data: { title: 'PRIVATE newer draft must not become the retry target', _status: 'draft' },
    req: await observedRequest('case-content', content.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(draft.editorialRevision).not.toBe(content.editorialRevision);
  expect(draft.latestPublicationIntent).toBe(content.latestPublicationIntent);
  const result = claimed(
    await claimPublicationRetry(
      content.latestPublicationIntent,
      { mode: 'manual' },
      await fixture.request(),
      () => new Date(),
    ),
  );
  expect(result.attempt.operationId).toBe(content.latestPublicationIntent);
  expect(await outbox(content.latestPublicationIntent)).toMatchObject({
    targetRevision: content.editorialRevision,
  });
});

it('keeps a legacy NULL actor manual-only and rebinds solely to the real authorized manual editor', async () => {
  const scheduled = await createScheduledCase();
  await fixture.payload.db.updateOne({
    collection: retryCollection,
    where: { operationId: { equals: scheduled.operationId } },
    options: { atomic: true },
    select: { id: true },
    data: {
      retryUserId: null,
      startedAttemptsVersion: 0,
      automaticAttempts: 0,
      nextAttemptAt: null,
    },
    req: await fixture.request(),
  });
  expect(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'automatic' },
      await fixture.request(),
      () => new Date(),
    ),
  ).toEqual({ kind: 'skip', reason: 'manual-only' });
  expect(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'immediate' },
      await fixture.request(),
      () => new Date(),
    ),
  ).toEqual({ kind: 'skip', reason: 'manual-only' });
  const rebound = claimed(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'manual' },
      await fixture.request(),
      () => new Date(),
    ),
  );
  expect(rebound.retry).toMatchObject({
    retryUserId: fixture.user.id,
    startedAttemptsVersion: 1,
    automaticAttempts: 0,
  });
  expect(rebound.retry.nextAttemptAt).not.toBeNull();
  expect(await outbox(scheduled.operationId)).toMatchObject({
    state: 'update-pending',
    attempts: 0,
  });
});

it('denies anonymous helper access and keeps the Native technical metadata API private even to editors', async () => {
  const scheduled = await createScheduledCase();
  const anonymous = await createLocalReq({}, fixture.payload);
  await expect(readPublicationRetry(scheduled.operationId, anonymous)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    claimPublicationRetry(scheduled.operationId, { mode: 'manual' }, anonymous, () => new Date()),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    fixture.payload.find({
      collection: 'publication-retries',
      overrideAccess: false,
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 403 });
});

it('refuses a provisional attempt claim inside a caller-owned editorial transaction', async () => {
  const scheduled = await createScheduledCase();
  const { req, transaction } = await nativeTransaction();
  try {
    await expect(
      claimPublicationRetry(scheduled.operationId, { mode: 'manual' }, req, () => new Date()),
    ).rejects.toMatchObject({ status: 400 });
    expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toEqual(
      scheduled.retry,
    );
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
});

it('routes a genuinely missing native head to safe existing reconciliation without allocating another version', async () => {
  const scheduled = await createScheduledCase();
  // Test-only Native adapter fixture: no content body or public root is fabricated.
  await fixture.payload.db.deleteMany({
    collection: 'cases',
    where: { id: { equals: scheduled.subject.id } },
    req: await fixture.request(),
  });
  expect(
    await claimPublicationRetry(
      scheduled.operationId,
      { mode: 'manual' },
      await fixture.request(),
      () => new Date(),
    ),
  ).toEqual({ kind: 'reconcile-stale', operationId: scheduled.operationId });
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toEqual(
    scheduled.retry,
  );
});

it('keeps real withdrawal execution safe through approved media trash without reviving the mutable draft', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic withdrawal/trash retry' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const owned = await ownedDirectory();
  const coordinator = portfolioPublicationCoordinator(owned.directory);
  try {
    expect(
      (await coordinator.retry(parent.latestPublicationIntent!, await fixture.request()))?.state,
    ).toBe('public');
    expect(
      (await coordinator.retry(content.latestPublicationIntent!, await fixture.request()))?.state,
    ).toBe('public');
    const withdrawal = await fixture.payload.update({
      collection: 'case-content',
      id: content.id,
      data: { _status: 'draft' },
      draft: false,
      req: await observedRequest('case-content', content.id, await fixture.request()),
      overrideAccess: false,
    });
    const operationId = withdrawal.latestPublicationIntent!;
    const started = claimed(
      await claimPublicationRetry(
        operationId,
        { mode: 'manual' },
        await fixture.request(),
        () => new Date(),
      ),
    );
    await expect(
      fixture.payload.update({
        collection: 'media',
        id: media.id,
        data: { deletedAt: new Date().toISOString() },
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await coordinator.retry(operationId, await fixture.request()))?.state).toBe('public');
    await fixture.payload.update({
      collection: 'media',
      id: media.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await expect(
      fixture.payload.findByID({
        collection: 'media',
        id: media.id,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await fixture.payload.findByID({
          collection: 'media',
          id: media.id,
          trash: true,
          req: await fixture.request(),
          overrideAccess: false,
        })
      ).deletedAt,
    ).toBeTruthy();
    const receipt = await coordinator.retry(operationId, await fixture.request());
    expect(receipt?.state).toBe('public');
    if (!receipt)
      throw new Error('Expected idempotent withdrawal reconciliation after media trash.');
    expect(
      await recordPublicationRetryOutcome(
        { attempt: started.attempt, receipt },
        await fixture.request(),
      ),
    ).toMatchObject({
      kind: 'recorded',
      retry: { startedAttemptsVersion: 1, nextAttemptAt: null },
    });
    const root = await readPublicRoot(owned.directory);
    expect(root?.subjects[`case-content/${content.id}`]).toMatchObject({
      operationId,
      targetRevision: withdrawal.editorialRevision,
      value: { detail: null, slug: null, media: [] },
    });
  } finally {
    await owned.remove();
  }
});

it('replays the original Native capture with the later retry table absent and restores only additive execution schema', async () => {
  const scheduled = await createScheduledCase();
  const { req, transaction } = await nativeTransaction();
  const db = (fixture.payload.db as unknown as PostgresAdapter).sessions[String(transaction)]!.db;
  const args = { db, payload: fixture.payload, req };
  try {
    await retryMigration.down(args);
    const absent = await db.execute(
      sql`SELECT to_regclass('public.publication_retries') AS relation`,
    );
    expect(absent.rows[0]).toMatchObject({ relation: null });
    await coordinationMigration.down(args);
    // This exact published historical up() calls current capture/enqueue APIs.
    await coordinationMigration.up(args);
    const captured = await fixture.payload.db.find<PublicationUpdate>({
      collection: 'publication-updates',
      where: { subjectId: { equals: scheduled.subject.id } },
      req,
    });
    expect(captured.docs).toHaveLength(1);
    expect(captured.docs[0].dependencies).toContain('legacy-bootstrap');
    const stillAbsent = await db.execute(
      sql`SELECT to_regclass('public.publication_retries') AS relation`,
    );
    expect(stillAbsent.rows[0]).toMatchObject({ relation: null });
    await retryMigration.up(args);
    expect(await readPublicationRetry(captured.docs[0].operationId, req)).toBeNull();
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  expect(await readPublicationRetry(scheduled.operationId, await fixture.request())).toEqual(
    scheduled.retry,
  );
});
