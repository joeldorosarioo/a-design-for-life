import { afterAll, beforeAll, expect, it } from 'vitest';
import { handleEndpoints } from 'payload';
import config from '@payload-config';
import { sql } from '@payloadcms/db-postgres';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../testing/fixtures/editorial-lifecycle';
import { retryPublicationUpdate } from './publication-updates';
import { confirmNativePublication } from './publication-transport';
import { editorialHead } from './editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('native-settlement');
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
  cookie = login.headers.get('set-cookie')!.split(';')[0]!;
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
async function rejectDraftCommit(id: string) {
  await fixture.payload.db.drizzle.execute(
    sql.raw(
      `CREATE FUNCTION e18_reject_draft_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.parent_id = '${id}'::uuid THEN RAISE EXCEPTION 'Synthetic deferred draft COMMIT rejection'; END IF; RETURN NEW; END; $$; CREATE CONSTRAINT TRIGGER e18_draft_commit_failure AFTER INSERT ON _case_content_v DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e18_reject_draft_commit();`,
    ),
  );
}
async function removeFault() {
  await fixture.payload.db.drizzle.execute(
    sql`DROP TRIGGER IF EXISTS e18_draft_commit_failure ON _case_content_v; DROP FUNCTION IF EXISTS e18_reject_draft_commit();`,
  );
}
async function nativeDraft(id: string, title: string) {
  const req = await observedRequest('case-content', id, await fixture.request());
  const request = new Request(`${process.env.SITE_ORIGIN}/api/case-content/${id}?draft=true`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: process.env.SITE_ORIGIN!,
      cookie,
      'x-editorial-revision': req.headers.get('x-editorial-revision')!,
      'x-editorial-lease': req.headers.get('x-editorial-lease')!,
    },
    body: JSON.stringify({ title, _status: 'draft' }),
  });
  return confirmNativePublication(await handleEndpoints({ config, request }), request);
}
it.each([false, true])(
  'rejects actual Native draft COMMIT failure with prior publication=%s and leaves the old version/head intact',
  async (priorPublic) => {
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Native draft COMMIT' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const media = await mediaMetadataFixture(fixture.payload);
    const doc = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(media.id),
        case: parent.id,
        locale: 'pt',
        slug: `settlement-${randomUUID()}`,
        title: 'Prior durable content',
        _status: priorPublic ? 'published' : 'draft',
      },
      draft: !priorPublic,
      req: await fixture.request(),
      overrideAccess: false,
    });
    if (priorPublic)
      expect(
        await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
      ).toMatchObject({ ok: true, value: { state: 'public' } });
    const before = await editorialHead('case-content', doc.id, await fixture.request());
    const versions = (
      await fixture.payload.findVersions({
        collection: 'case-content',
        where: { parent: { equals: doc.id } },
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).totalDocs;
    const operations = (
      await fixture.payload.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: doc.id } },
        overrideAccess: true,
      })
    ).totalDocs;
    await rejectDraftCommit(doc.id);
    try {
      const response = await nativeDraft(doc.id, 'THIS DRAFT NEVER COMMITS');
      expect(response.status).toBe(503);
      expect((await response.json()).errors[0].message).toMatch(/gravação|commit/i);
      expect(
        (await editorialHead('case-content', doc.id, await fixture.request())).editorialRevision,
      ).toBe(before.editorialRevision);
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
      ).toBe('Prior durable content');
      expect(
        (
          await fixture.payload.findVersions({
            collection: 'case-content',
            where: { parent: { equals: doc.id } },
            req: await fixture.request(),
            overrideAccess: false,
          })
        ).totalDocs,
      ).toBe(versions);
      expect(
        (
          await fixture.payload.find({
            collection: 'publication-updates',
            where: { subjectId: { equals: doc.id } },
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(operations);
    } finally {
      await removeFault();
    }
    expect((await nativeDraft(doc.id, 'Normal draft really commits')).status).toBe(200);
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
    ).toBe('Normal draft really commits');
  },
);

it('keeps external Local writes provisional and isolates concurrent commit, failed commit and rollback settlements', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'External transaction draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: { case: parent.id, locale: 'pt', title: 'Durable draft' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const requests = await Promise.all([fixture.request(), fixture.request(), fixture.request()]);
  const transactions = await Promise.all(requests.map(() => fixture.payload.db.beginTransaction()));
  if (transactions.some((id) => !id)) throw new Error('Real native transactions required');
  requests.forEach((req, index) => {
    req.transactionID = transactions[index]!;
  });
  await rejectDraftCommit(doc.id);
  try {
    const req = await observedRequest('case-content', doc.id, requests[0]!);
    const provisional = await fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      draft: true,
      data: { title: 'Provisional external draft' },
      req,
      overrideAccess: false,
    });
    expect(provisional.title).toBe('Provisional external draft');
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
    ).toBe('Durable draft');
    const kept = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Independent committed session' },
      req: requests[1]!,
      overrideAccess: false,
    });
    const cancelled = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Independent rolled-back session' },
      req: requests[2]!,
      overrideAccess: false,
    });
    const results = await Promise.allSettled([
      fixture.payload.db.commitTransaction(transactions[0]!),
      fixture.payload.db.commitTransaction(transactions[1]!),
      fixture.payload.db.rollbackTransaction(transactions[2]!),
    ]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled', 'fulfilled']);
    expect(results[0]).toMatchObject({ reason: { status: 503 } });
    expect(
      (
        await fixture.payload.find({
          collection: 'cases',
          where: { id: { equals: kept.id } },
          req: await fixture.request(),
          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(1);
    expect(
      (
        await fixture.payload.find({
          collection: 'cases',
          where: { id: { equals: cancelled.id } },
          req: await fixture.request(),
          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(0);
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
    ).toBe('Durable draft');
  } finally {
    await Promise.all(transactions.map((id) => fixture.payload.db.rollbackTransaction(id!)));
    await removeFault();
  }
});
