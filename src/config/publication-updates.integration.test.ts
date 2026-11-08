import { handleEndpoints, getPayload } from 'payload';
import config from '@payload-config';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { z } from 'zod';
import { resolveMediaAccess } from '@/features/media-library/server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
} from '../../testing/fixtures/editorial-lifecycle';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.8-publication');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('keeps a committed native target private until public publication is confirmed', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic publication' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `pending-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const publicResult = await fixture.payload.find({
    collection: 'case-content',
    where: { id: { equals: doc.id } },
    draft: false,
    overrideAccess: false,
  });
  expect(publicResult.totalDocs).toBe(0);
  const operations = await fixture.payload.find({
    collection: 'publication-updates',
    where: { subjectId: { equals: doc.id } },
    overrideAccess: true,
  });
  expect(operations.totalDocs).toBe(1);
  expect(
    (
      await fixture.payload.find({
        collection: 'case-routes',
        where: { content: { equals: doc.id } },
        overrideAccess: true,
      })
    ).docs[0]?.everPublished,
  ).toBe(false);
  expect(operations.docs[0]).toMatchObject({
    state: 'update-pending',
    targetRevision: doc.editorialRevision,
  });
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: false },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: false, status: 404 });
  expect(
    await retryPublicationUpdate(operations.docs[0]!.operationId, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { id: { equals: doc.id } },
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(1);
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: false },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: true });
});

import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createPublicationCoordinator } from '../helpers/payload/publication-coordinator';
import { readPublicRoot } from '../helpers/payload/public-root';
it('publishes the committed immutable target and persists its confirmation receipt', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-native-'));
  try {
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic projection' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const operation = (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: parent.id } },
        overrideAccess: true,
      })
    ).docs[0]!;
    const coordinator = createPublicationCoordinator({
      directory,
      compose: async (root, update) => ({
        generation: randomUUID(),
        subjects: {
          ...root?.subjects,
          [`${update.subjectCollection}/${update.subjectId}`]: {
            operationId: update.operationId,
            targetRevision: update.targetRevision,
            value: z.json().parse(update.target),
          },
        },
      }),
    });
    const receipt = await coordinator.retry(operation.operationId, await fixture.request());
    expect(receipt).toMatchObject({ state: 'public', operationId: operation.operationId });
    expect((await readPublicRoot(directory))?.subjects[`cases/${parent.id}`]?.value).toMatchObject({
      kind: 'case-order',
      caseId: parent.id,
    });
    const stored = await fixture.payload.findByID({
      collection: 'publication-updates',
      id: operation.id,
      overrideAccess: true,
    });
    expect(stored.state).toBe('public');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import { observedRequest } from '../../testing/fixtures/editorial-lifecycle';
import { resolveCaseRoute } from '@/features/cases/server/resolve-case-route';
it('keeps the confirmed canonical body while a newer native title and slug are pending', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic prior public' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `confirmed-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Confirmed title',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: { title: 'Pending private title', slug: `new-${randomUUID()}`, _status: 'published' },
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({
    status: 200,
    case: { title: 'Confirmed title' },
  });
});

it('retains confirmed bytes through pending withdrawal and releases publication pins after confirmation', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic withdrawal' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `withdraw-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const withdrawn = await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: { _status: 'draft' },
    draft: false,
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: false },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: true });
  expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({ status: 200 });
  expect(
    await retryPublicationUpdate(withdrawn.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: false },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: false, status: 404 });
  expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({ status: 410 });
  await expect(
    fixture.payload.update({
      collection: 'media',
      id: media.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ id: media.id });
});

import { sql } from '@payloadcms/db-postgres';
import { requirePublicationTransaction } from '../helpers/payload/publication-coordinator';
it('cannot consume an uncommitted external transaction and rollback leaves no executable intent', async () => {
  const req = await fixture.request();
  const tx = await fixture.payload.db.beginTransaction();
  if (!tx) throw new Error('Native transaction required');
  req.transactionID = tx;
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'External pending' },
    req,
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(parent.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: false });
  await fixture.payload.db.rollbackTransaction(tx);
  delete req.transactionID;
  expect(
    (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: parent.id } },
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  const committedReq = await fixture.request();
  const committedTx = await fixture.payload.db.beginTransaction();
  if (!committedTx) throw new Error('Native transaction required');
  committedReq.transactionID = committedTx;
  const committed = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'External committed' },
    req: committedReq,
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(committed.latestPublicationIntent!, committedReq),
  ).toMatchObject({ ok: false });
  await fixture.payload.db.commitTransaction(committedTx);
  delete committedReq.transactionID;
  expect(
    await retryPublicationUpdate(committed.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
});
it('rejects the installed adapter missing-session autocommit fallback before a publication fence', async () => {
  const req = await fixture.request();
  req.transactionID = randomUUID();
  await expect(requirePublicationTransaction(req)).rejects.toThrow(
    'active native publication transaction',
  );
});
it('characterizes a real deferred PostgreSQL COMMIT failure and never treats the saved response as public', async () => {
  await fixture.payload.db.drizzle.execute(
    sql`ALTER TABLE publication_updates ADD CONSTRAINT e18_commit_failure UNIQUE (subject_id,target_revision) DEFERRABLE INITIALLY DEFERRED`,
  );
  let tx: Awaited<ReturnType<typeof fixture.payload.db.beginTransaction>>;
  try {
    const req = await fixture.request();
    tx = await fixture.payload.db.beginTransaction();
    if (!tx) throw new Error('Native transaction required');
    req.transactionID = tx;
    const saved = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Actual deferred failure' },
      req,
      overrideAccess: false,
    });
    const operation = (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: saved.id } },
        overrideAccess: true,
        req,
      })
    ).docs[0]!;
    await fixture.payload.db.create({
      collection: 'publication-updates',
      req,
      data: { ...operation, id: randomUUID(), operationId: randomUUID() },
    });
    // Both rows exist inside the real transaction; uniqueness is checked only at COMMIT.
    expect(
      (
        await fixture.payload.find({
          collection: 'publication-updates',
          where: { subjectId: { equals: saved.id } },
          overrideAccess: true,
          req,
        })
      ).totalDocs,
    ).toBe(2);
    await expect(fixture.payload.db.commitTransaction(tx)).rejects.toMatchObject({ status: 503 });
    delete req.transactionID;
    // The composed guard exposes the real failure consumed by the unwrapped adapter.
    expect(
      (
        await fixture.payload.find({
          collection: 'cases',
          where: { id: { equals: saved.id } },
          overrideAccess: false,
          req: await fixture.request(),
        })
      ).totalDocs,
    ).toBe(0);
    expect(
      await retryPublicationUpdate(operation.operationId, await fixture.request()),
    ).toMatchObject({ ok: false });
    const login = await handleEndpoints({
      config,
      request: new Request(`${process.env.SITE_ORIGIN}/api/users/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN! },
        body: JSON.stringify({
          email: fixture.user.email,
          password: 'Synthetic-editorial-test-password-123!',
        }),
      }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const native = await getPayload({ config });
    installPayloadProvider(async () => native);
    const create = native.db.create.bind(native.db);
    native.db.create = async (args) => {
      const row = await create(args);
      if (args.collection === 'publication-updates')
        await create({
          ...args,
          data: { ...args.data, id: randomUUID(), operationId: randomUUID() },
        });
      return row;
    };
    let response: Response;
    try {
      const request = new Request(`${process.env.SITE_ORIGIN}/api/cases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN!, cookie },
        body: JSON.stringify({ internalTitle: 'Native COMMIT rejection' }),
      });
      const savedResponse = await handleEndpoints({ config, request });
      expect(savedResponse.status).toBe(503);
      response = await confirmNativePublication(savedResponse, request);
    } finally {
      native.db.create = create;
    }
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('doc');
  } finally {
    if (tx!) await fixture.payload.db.rollbackTransaction(tx!);
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE publication_updates DROP CONSTRAINT IF EXISTS e18_commit_failure`,
    );
  }
});
it('does not let an old in-flight attempt overwrite a newer confirmed generation', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-inflight-'));
  let release!: () => void;
  let entered!: () => void;
  const paused = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const first = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'In-flight case', sortOrder: 1 },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const coordinator = createPublicationCoordinator({
      directory,
      beforePromote: async (operation) => {
        if (operation.operationId === first.latestPublicationIntent) {
          entered();
          await resume;
        }
      },
      compose: async (root, operation) => ({
        generation: randomUUID(),
        subjects: {
          ...root?.subjects,
          [`cases/${operation.subjectId}`]: {
            operationId: operation.operationId,
            targetRevision: operation.targetRevision,
            value: z.json().parse(operation.target),
          },
        },
      }),
    });
    const old = coordinator.retry(first.latestPublicationIntent!, await fixture.request());
    await paused;
    const current = await fixture.payload.update({
      collection: 'cases',
      id: first.id,
      data: { sortOrder: 9 },
      req: await observedRequest('cases', first.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(
      await coordinator.retry(current.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({ state: 'public' });
    release();
    expect(await old).toMatchObject({ state: 'superseded' });
    expect((await readPublicRoot(directory))?.subjects[`cases/${first.id}`]).toMatchObject({
      operationId: current.latestPublicationIntent,
      value: { sortOrder: 9 },
    });
  } finally {
    release?.();
    await rm(directory, { recursive: true, force: true });
  }
});
it('publishes the intended immutable body after a newer private draft without exposing the draft', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Pending then draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `draft-after-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Intended public body',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    draft: true,
    data: { title: 'New private draft', _status: 'draft' },
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({
    status: 200,
    case: { title: 'Intended public body' },
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: doc.id,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).title,
  ).toBe('New private draft');
});
it('preserves media and route ownership across a real SQL acknowledgement rejection after root publication', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Ack failure owner' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(parent.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `ack-root-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Root committed without SQL ack',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.db.drizzle.execute(
    sql.raw(
      `ALTER TABLE publication_updates ADD CONSTRAINT e18_ack_failure CHECK (operation_id <> '${doc.latestPublicationIntent}' OR state <> 'public') NOT VALID`,
    ),
  );
  try {
    expect(
      await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({
      status: 200,
      case: { title: 'Root committed without SQL ack' },
    });
    expect(
      await resolveMediaAccess(
        { mediaId: media.id, variant: 'original', preview: false },
        await fixture.request(),
      ),
    ).toMatchObject({ ok: true });
    const routes = await fixture.payload.find({
      collection: 'case-routes',
      where: { content: { equals: doc.id } },
      overrideAccess: true,
    });
    expect(routes.docs[0]?.everPublished).toBe(false);
    await fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      draft: true,
      data: { slug: `private-slug-${randomUUID()}`, _status: 'draft' },
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    });
    const other = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Competing route' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: { case: other.id, locale: 'pt', slug },
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      fixture.payload.delete({
        collection: 'case-content',
        id: doc.id,
        req: await observedRequest('case-content', doc.id, await fixture.request()),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      fixture.payload.update({
        collection: 'media',
        id: media.id,
        data: { deletedAt: new Date().toISOString() },
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
  } finally {
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE publication_updates DROP CONSTRAINT IF EXISTS e18_ack_failure`,
    );
  }
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(
    (
      await fixture.payload.find({
        collection: 'case-routes',
        where: { and: [{ content: { equals: doc.id } }, { slug: { equals: slug } }] },
        overrideAccess: true,
      })
    ).docs[0]?.everPublished,
  ).toBe(true);
});

import { confirmNativePublication } from '../helpers/payload/publication-transport';
import { installPayloadProvider } from '../helpers/payload/runtime';
it('does not retire root route ownership when a failed acknowledgement is superseded by a pending withdrawal', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Superseded ack owner' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await retryPublicationUpdate(parent.latestPublicationIntent!, await fixture.request());
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `superseded-root-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.db.drizzle.execute(
    sql.raw(
      `ALTER TABLE publication_updates ADD CONSTRAINT e18_superseded_ack CHECK (operation_id <> '${doc.latestPublicationIntent}' OR state <> 'public') NOT VALID`,
    ),
  );
  try {
    expect(
      await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    const withdrawn = await fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      data: { _status: 'draft' },
      draft: false,
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(withdrawn.latestPublicationIntent).not.toBe(doc.latestPublicationIntent);
    expect(
      await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({ ok: true, value: { state: 'superseded' } });
    await fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      draft: true,
      data: { slug: `new-private-${randomUUID()}`, _status: 'draft' },
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(
      (
        await fixture.payload.find({
          collection: 'case-routes',
          where: { and: [{ content: { equals: doc.id } }, { slug: { equals: slug } }] },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(1);
    expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({ status: 200 });
    await expect(
      fixture.payload.delete({
        collection: 'case-content',
        id: doc.id,
        req: await observedRequest('case-content', doc.id, await fixture.request()),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      fixture.payload.update({
        collection: 'media',
        id: media.id,
        data: { deletedAt: new Date().toISOString() },
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
  } finally {
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE publication_updates DROP CONSTRAINT IF EXISTS e18_superseded_ack`,
    );
  }
});

import { publishCase } from '@/features/cases/server/publish-case';
import { withPublicRootWriter } from '../helpers/payload/public-root';
import { runtimePublication } from '../helpers/payload/publication-runtime';
it('reports feature publication pending while the global writer is busy, then confirms only after real promotion', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Feature pending receipt' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const draft = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug: `feature-${randomUUID()}`,
      _status: 'draft',
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const request = await observedRequest('case-content', draft.id, await fixture.request());
  const head = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    req: request,
    overrideAccess: false,
  });
  await withPublicRootWriter(runtimePublication().directory, async () => {
    const result = await publishCase(
      { contentId: draft.id, expectedRevision: head.editorialRevision! },
      request,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        state: 'update-pending',
        operationId: expect.any(String),
        targetRevision: expect.any(String),
      },
    });
    if (!result.ok) throw new Error('Expected persisted pending intent');
    expect(result.value).not.toHaveProperty('status', 'published');
    expect(await resolveCaseRoute('pt', draft.slug!, fixture.payload)).toMatchObject({
      status: 404,
    });
  });
  const stored = await fixture.payload.db.findOne({
    collection: 'case-content',
    where: { id: { equals: draft.id } },
  });
  expect(
    await retryPublicationUpdate(
      String((stored as unknown as { latestPublicationIntent: string }).latestPublicationIntent),
      await fixture.request(),
    ),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  expect(await resolveCaseRoute('pt', draft.slug!, fixture.payload)).toMatchObject({ status: 200 });
});

it('keeps internal shared-case edits private without replacing the latest publication intent', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Shared approved order', sortOrder: 4 },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(parent.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const renamed = await fixture.payload.update({
    collection: 'cases',
    id: parent.id,
    data: { internalTitle: 'Private internal label' },
    req: await observedRequest('cases', parent.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(renamed.latestPublicationIntent).toBe(parent.latestPublicationIntent);
  expect(
    (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: parent.id } },
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(1);
});
it('releases a never-public cancelled intent only after withdrawal reconciliation and allows deletion and slug reuse', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Cancelled never public' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `cancelled-${randomUUID()}`;
  const pending = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const withdrawn = await fixture.payload.update({
    collection: 'case-content',
    id: pending.id,
    data: { _status: 'draft' },
    draft: false,
    req: await observedRequest('case-content', pending.id, await fixture.request()),
    overrideAccess: false,
  });
  await expect(
    fixture.payload.delete({
      collection: 'case-content',
      id: pending.id,
      req: await observedRequest('case-content', pending.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await retryPublicationUpdate(withdrawn.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  await expect(
    fixture.payload.delete({
      collection: 'case-content',
      id: pending.id,
      req: await observedRequest('case-content', pending.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ id: pending.id });
  const other = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'New owner after cancellation' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await expect(
    fixture.payload.create({
      collection: 'case-content',
      data: { case: other.id, locale: 'pt', slug },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ slug });
  await expect(
    fixture.payload.update({
      collection: 'media',
      id: media.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ id: media.id });
  expect(await resolveCaseRoute('pt', slug, fixture.payload)).toMatchObject({ status: 404 });
});

it('ignores forged Native public metadata and hides a committed pending target from anonymous where, sort and count', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Forged metadata control' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const forged = randomUUID();
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug: `forged-${randomUUID()}`,
      title: 'Private pending searchable title',
      _status: 'published',
      latestPublicationIntent: forged,
      publicConfirmed: true,
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(doc.latestPublicationIntent).not.toBe(forged);
  const head = (await fixture.payload.db.findOne({
    collection: 'case-content',
    where: { id: { equals: doc.id } },
  })) as unknown as { publicConfirmed: boolean };
  expect(head.publicConfirmed).toBe(false);
  expect(
    (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { operationId: { equals: forged } },
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  const query = new URLSearchParams({
    'where[id][equals]': doc.id,
    'where[title][equals]': 'Private pending searchable title',
    sort: 'title',
  });
  const response = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/case-content?${query}`),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ docs: [], totalDocs: 0 });
  const count = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/case-content/count?${query}`),
  });
  expect(count.status).toBe(200);
  expect(await count.json()).toMatchObject({ totalDocs: 0 });
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: false },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: false, status: 404 });
});
