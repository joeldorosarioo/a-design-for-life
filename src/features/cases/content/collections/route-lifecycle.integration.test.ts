import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../../testing/fixtures/editorial-lifecycle';
import { editorialHead } from '@/helpers/payload/editorial-revision';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.5-routes');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
const slug = () => `route-${randomUUID()}`;
async function draft(value?: string, locale: 'pt' | 'en' = 'pt', caseId?: string) {
  const parent =
    caseId ??
    (
      await fixture.payload.create({
        collection: 'cases',
        data: { internalTitle: 'Synthetic route owner' },
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).id;
  return fixture.payload.create({
    collection: 'case-content',
    data: { case: parent, locale, slug: value },
    depth: 0,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
}
async function save(id: string, data: Record<string, unknown>, asDraft = true) {
  return fixture.payload.update({
    collection: 'case-content',
    id,
    data,
    draft: asDraft,
    overrideAccess: false,
    req: await observedRequest('case-content', id, await fixture.request()),
  });
}
async function routes(id: string) {
  return (
    await fixture.payload.find({
      collection: 'case-routes',
      where: { content: { equals: id } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
      req: await fixture.request(),
    })
  ).docs;
}
async function publish(id: string, value: string, asDraft = false) {
  const media = await mediaMetadataFixture(fixture.payload);
  return save(
    id,
    { ...casePublicationFixture(media.id), slug: value, _status: 'published' },
    asDraft,
  );
}
it('reserves supplied draft slugs and leaves title changes and missing slugs alone', async () => {
  const first = slug();
  const doc = await draft(first);
  expect(await routes(doc.id)).toMatchObject([
    { slug: first, everPublished: false, state: 'draft' },
  ]);
  await save(doc.id, { title: 'Different title', _status: 'draft' });
  expect((await routes(doc.id)).map((row) => row.slug)).toEqual([first]);
  await save(doc.id, { slug: '', _status: 'draft' });
  expect(await routes(doc.id)).toHaveLength(0);
  const empty = await draft();
  expect(await routes(empty.id)).toHaveLength(0);
});
it('the database chooses one concurrent owner, reports explicit conflict and rolls back loser content/head/versions', async () => {
  const docs = await Promise.all([draft(), draft()]);
  const target = slug();
  const requests = await Promise.all(
    docs.map(async (doc) => observedRequest('case-content', doc.id, await fixture.request())),
  );
  const before = await Promise.all(
    docs.map(async (doc) => ({
      head: await editorialHead('case-content', doc.id, await fixture.request()),
      versions: (
        await fixture.payload.findVersions({
          collection: 'case-content',
          where: { parent: { equals: doc.id } },
          overrideAccess: false,
          req: await fixture.request(),
        })
      ).totalDocs,
    })),
  );
  const results = await Promise.allSettled(
    docs.map((doc, i) =>
      fixture.payload.update({
        collection: 'case-content',
        id: doc.id,
        data: { slug: target, _status: 'draft' },
        draft: true,
        overrideAccess: false,
        req: requests[i],
      }),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const loser = results.findIndex((result) => result.status === 'rejected');
  expect(results[loser]).toMatchObject({
    status: 'rejected',
    reason: { code: 'slug-conflict', status: 409 },
  });
  expect(
    (await editorialHead('case-content', docs[loser].id, await fixture.request()))
      .editorialRevision,
  ).toBe(before[loser].head.editorialRevision);
  expect(
    (
      await fixture.payload.findVersions({
        collection: 'case-content',
        where: { parent: { equals: docs[loser].id } },
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).totalDocs,
  ).toBe(before[loser].versions);
  expect(await routes(docs[loser].id)).toHaveLength(0);
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: docs[loser].id,
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).slug,
  ).toBeFalsy();
  expect((await draft(target, 'en')).locale).toBe('en');
});
it('releases only never-public old drafts; publishes history, reuses its own history and treats effective draft=true publication as publication', async () => {
  const a = slug(),
    b = slug(),
    c = slug();
  const doc = await draft(a);
  await save(doc.id, { slug: b, _status: 'draft' });
  expect((await routes(doc.id)).map((row) => row.slug)).toEqual([b]);
  await publish(doc.id, b);
  await save(doc.id, { slug: c, _status: 'draft' });
  expect(await routes(doc.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ slug: b, state: 'current', everPublished: true }),
      expect.objectContaining({ slug: c, state: 'draft', everPublished: false }),
    ]),
  );
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: doc.id,
        draft: false,
        overrideAccess: false,
      })
    ).slug,
  ).toBe(b);
  await publish(doc.id, c, true);
  expect(await routes(doc.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ slug: b, state: 'historical', everPublished: true }),
      expect.objectContaining({ slug: c, state: 'current', everPublished: true }),
    ]),
  );
  await save(doc.id, { slug: b, _status: 'draft' });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: doc.id,
        draft: false,
        overrideAccess: false,
      })
    ).slug,
  ).toBe(c);
  await save(doc.id, { _status: 'published' }, false);
  expect(await routes(doc.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ slug: b, state: 'current' }),
      expect.objectContaining({ slug: c, state: 'historical' }),
    ]),
  );
});
it('denies raw privileged Local API registry creation without an internal transaction capability', async () => {
  const doc = await draft();
  await expect(
    fixture.payload.create({
      collection: 'case-routes',
      data: {
        locale: 'pt',
        slug: slug(),
        case: doc.case as string,
        content: doc.id,
        everPublished: true,
        state: 'current',
      },
      overrideAccess: true,
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 403 });
});

import { reserveCaseRoute } from '../../server/reserve-case-route';
import { restoreCaseDraft } from '../../server/restore-case-draft';
import { resolveCaseRoute } from '../../server/resolve-case-route';
it('explicit reservation command verifies identity and caller revision/lease, without inventing suffixes', async () => {
  const doc = await draft();
  const other = await draft(slug());
  const chosen = slug();
  const input = {
    caseId: doc.case as string,
    contentId: doc.id,
    locale: 'pt' as const,
    slug: chosen,
  };
  expect(
    await reserveCaseRoute(
      input,
      await observedRequest('case-content', doc.id, await fixture.request()),
    ),
  ).toEqual({ ok: true, value: { slug: chosen } });
  expect(
    await reserveCaseRoute(
      { ...input, caseId: other.case as string },
      await observedRequest('case-content', doc.id, await fixture.request()),
    ),
  ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  const request = await observedRequest('case-content', doc.id, await fixture.request());
  request.headers.set('x-editorial-revision', randomUUID());
  expect(await reserveCaseRoute({ ...input, slug: slug() }, request)).toMatchObject({
    ok: false,
    error: { code: 'stale-revision' },
  });
  const noLease = await observedRequest('case-content', doc.id, await fixture.request());
  noLease.headers.delete('x-editorial-lease');
  expect(await reserveCaseRoute({ ...input, slug: slug() }, noLease)).toMatchObject({
    ok: false,
    error: { code: 'locked' },
  });
  expect(
    await reserveCaseRoute(
      { caseId: other.case as string, contentId: other.id, locale: 'pt', slug: chosen },
      await observedRequest('case-content', other.id, await fixture.request()),
    ),
  ).toMatchObject({ ok: false, error: { code: 'slug-conflict', field: 'slug' } });
});
it('resolves current, private, unknown, direct history after repeated changes and withdrawn per locale', async () => {
  const a = slug(),
    b = slug(),
    c = slug();
  const doc = await draft(a);
  expect(await resolveCaseRoute('pt', a, fixture.payload)).toEqual({ status: 404 });
  expect(await resolveCaseRoute('pt', slug(), fixture.payload)).toEqual({ status: 404 });
  await publish(doc.id, a);
  expect(await resolveCaseRoute('pt', a, fixture.payload)).toMatchObject({
    status: 200,
    slug: a,
    case: { id: doc.case, title: 'Synthetic title' },
  });
  await save(doc.id, { slug: b, title: 'Private new title', _status: 'draft' });
  expect(await resolveCaseRoute('pt', a, fixture.payload)).toMatchObject({
    status: 200,
    slug: a,
    case: { title: 'Synthetic title' },
  });
  expect(await resolveCaseRoute('pt', b, fixture.payload)).toEqual({ status: 404 });
  await publish(doc.id, b);
  await publish(doc.id, c);
  for (const value of [a, b])
    expect(await resolveCaseRoute('pt', value, fixture.payload)).toMatchObject({
      status: 308,
      location: `/pt/cases/${c}`,
    });
  await publish(doc.id, a);
  expect(await resolveCaseRoute('pt', a, fixture.payload)).toMatchObject({ status: 200, slug: a });
  for (const value of [b, c])
    expect(await resolveCaseRoute('pt', value, fixture.payload)).toMatchObject({
      status: 308,
      location: `/pt/cases/${a}`,
    });
  const english = await draft(a, 'en', doc.case as string);
  await publish(english.id, a);
  await save(doc.id, { _status: 'draft' }, false);
  for (const value of [a, b, c])
    expect(await resolveCaseRoute('pt', value, fixture.payload)).toMatchObject({ status: 410 });
  expect(await resolveCaseRoute('en', a, fixture.payload)).toMatchObject({ status: 200, slug: a });
});
it('restore conflict rolls back and own historical restore never changes the public URL before publication', async () => {
  const a = slug(),
    b = slug();
  const doc = await draft(a);
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: doc.id } },
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const old = versions.docs[0];
  await save(doc.id, { slug: b, _status: 'draft' });
  await draft(a);
  const before = await editorialHead('case-content', doc.id, await fixture.request());
  const req = await observedRequest('case-content', doc.id, await fixture.request());
  expect(
    await restoreCaseDraft(
      {
        contentId: doc.id,
        versionId: old.id,
        expectedRevision: req.headers.get('x-editorial-revision')!,
      },
      req,
    ),
  ).toMatchObject({ ok: false, error: { code: 'slug-conflict' } });
  expect(
    (await editorialHead('case-content', doc.id, await fixture.request())).editorialRevision,
  ).toBe(before.editorialRevision);
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: doc.id,
        draft: true,
        depth: 0,
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).slug,
  ).toBe(b);
  await publish(doc.id, b);
  const published = (
    await fixture.payload.findVersions({
      collection: 'case-content',
      where: { parent: { equals: doc.id } },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    })
  ).docs.find((v) => v.version._status === 'published')!;
  const c = slug();
  await publish(doc.id, c);
  const restoreReq = await observedRequest('case-content', doc.id, await fixture.request());
  expect(
    await restoreCaseDraft(
      {
        contentId: doc.id,
        versionId: published.id,
        expectedRevision: restoreReq.headers.get('x-editorial-revision')!,
      },
      restoreReq,
    ),
  ).toMatchObject({ ok: true });
  expect(await resolveCaseRoute('pt', b, fixture.payload)).toMatchObject({
    status: 308,
    location: `/pt/cases/${c}`,
  });
  expect(await resolveCaseRoute('pt', c, fixture.payload)).toMatchObject({ status: 200, slug: c });
});
it('private deletion releases reservations and published deletion preserves ownership for withdrawal', async () => {
  const privateSlug = slug();
  const privateDoc = await draft(privateSlug);
  await fixture.payload.delete({
    collection: 'case-content',
    id: privateDoc.id,
    req: await observedRequest('case-content', privateDoc.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(await routes(privateDoc.id)).toHaveLength(0);
  expect((await draft(privateSlug)).slug).toBe(privateSlug);
  const current = slug();
  const publicDoc = await draft(current);
  await publish(publicDoc.id, current);
  await expect(
    fixture.payload.delete({
      collection: 'case-content',
      id: publicDoc.id,
      req: await observedRequest('case-content', publicDoc.id, await fixture.request()),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect((await routes(publicDoc.id))[0]).toMatchObject({ slug: current, everPublished: true });
  await save(publicDoc.id, { _status: 'draft' }, false);
  expect(await resolveCaseRoute('pt', current, fixture.payload)).toMatchObject({ status: 410 });
});
it.each(['old-current', 'new-private'] as const)(
  'a real publication commit between registry and content reads stays coherent: %s',
  async (interleaving) => {
    const a = slug(),
      b = slug();
    const doc = await draft(a);
    await publish(doc.id, a);
    await save(doc.id, { slug: b, _status: 'draft' });
    let release!: () => void;
    let read!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const registryRead = new Promise<void>((resolve) => {
      read = resolve;
    });
    const query = interleaving === 'old-current' ? a : b;
    const hooks = fixture.payload.collections['case-routes'].config.hooks.afterRead;
    const gate: (typeof hooks)[number] = async ({ doc, req }) => {
      if (!req.user && doc.slug === query) {
        read();
        await held;
      }
      return doc;
    };
    hooks.push(gate);
    try {
      const resolving = resolveCaseRoute('pt', query, fixture.payload);
      await Promise.race([
        registryRead,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Registry read did not reach real hook barrier')),
            5000,
          ),
        ),
      ]);
      await publish(doc.id, b);
      release();
      expect(await resolving).toMatchObject(
        interleaving === 'old-current'
          ? { status: 308, location: `/pt/cases/${b}` }
          : { status: 200, slug: b },
      );
    } finally {
      release();
      hooks.splice(hooks.indexOf(gate), 1);
    }
  },
);

import { sql } from '@payloadcms/db-postgres';
it('the real unique index blocks an invisible uncommitted reservation and rejects the losing transaction after commit', async () => {
  const [first, second] = await Promise.all([draft(), draft()]);
  const target = slug();
  const winnerReq = await observedRequest('case-content', first.id, await fixture.request());
  const transactionID = await fixture.payload.db.beginTransaction();
  if (!transactionID) throw new Error('Expected isolated PostgreSQL transaction');
  winnerReq.transactionID = transactionID;
  let committed = false;
  try {
    await fixture.payload.update({
      collection: 'case-content',
      id: first.id,
      data: { slug: target, _status: 'draft' },
      draft: true,
      req: winnerReq,
      overrideAccess: false,
    });
    const loserReq = await observedRequest('case-content', second.id, await fixture.request());
    const before = await editorialHead('case-content', second.id, await fixture.request());
    const pending = fixture.payload
      .update({
        collection: 'case-content',
        id: second.id,
        data: { slug: target, _status: 'draft' },
        draft: true,
        req: loserReq,
        overrideAccess: false,
      })
      .then(
        (value) => ({ ok: true as const, value }),
        (reason) => ({ ok: false as const, reason }),
      );
    const deadline = Date.now() + 5000;
    let blocked = false;
    while (Date.now() < deadline) {
      const result = await fixture.payload.db.execute({
        db: fixture.payload.db.drizzle,
        sql: sql`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'insert into "case_routes"%') AS blocked`,
      });
      if (result.rows[0]?.blocked === true) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(blocked).toBe(true);
    console.info('Observed real PostgreSQL unique-index wait for an uncommitted case route');
    await fixture.payload.db.commitTransaction(transactionID);
    committed = true;
    delete winnerReq.transactionID;
    expect(await pending).toMatchObject({
      ok: false,
      reason: { code: 'slug-conflict', status: 409 },
    });
    expect(
      (await editorialHead('case-content', second.id, await fixture.request())).editorialRevision,
    ).toBe(before.editorialRevision);
    expect(await routes(second.id)).toHaveLength(0);
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transactionID);
    delete winnerReq.transactionID;
  }
});
it('failed native publication preserves the original public URL and all route ownership', async () => {
  const a = slug(),
    b = slug();
  const first = await draft(a),
    other = await draft(b);
  await publish(first.id, a);
  await publish(other.id, b);
  const before = await editorialHead('case-content', first.id, await fixture.request());
  await expect(save(first.id, { slug: b, _status: 'published' }, false)).rejects.toMatchObject({
    code: 'slug-conflict',
    status: 409,
  });
  expect(
    (await editorialHead('case-content', first.id, await fixture.request())).editorialRevision,
  ).toBe(before.editorialRevision);
  expect(await routes(first.id)).toMatchObject([
    { slug: a, everPublished: true, state: 'current' },
  ]);
  expect(await resolveCaseRoute('pt', a, fixture.payload)).toMatchObject({ status: 200, slug: a });
  expect(await resolveCaseRoute('pt', b, fixture.payload)).toMatchObject({
    status: 200,
    case: { id: other.case },
  });
});
it('privileged Local API cannot rewrite, unpublish or delete permanent route ownership using forged string context', async () => {
  const a = slug();
  const doc = await draft(a);
  await publish(doc.id, a);
  const route = (await routes(doc.id))[0];
  const req = await fixture.request();
  req.context = {
    trustedRouteMutation: true,
    'case-route-content-lifecycle': { caseId: doc.case, contentId: doc.id, locale: 'pt' },
  };
  for (const data of [
    { slug: slug() },
    { everPublished: false },
    { state: 'draft' as const },
    { case: crypto.randomUUID() },
    { locale: 'en' as const },
  ]) {
    await expect(
      fixture.payload.update({
        collection: 'case-routes',
        id: route.id,
        data,
        req,
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
  }
  await expect(
    fixture.payload.delete({ collection: 'case-routes', id: route.id, req, overrideAccess: true }),
  ).rejects.toMatchObject({ status: 403 });
  expect((await routes(doc.id))[0]).toMatchObject({
    slug: a,
    everPublished: true,
    state: 'current',
  });
});

import { protectContentRouteDeletion } from '../hooks/case-routes';
it('delete and save claim the editorial head before changing routes, avoiding opposite lock order', async () => {
  const a = slug(),
    b = slug();
  const doc = await draft(a);
  const deleteReq = await observedRequest('case-content', doc.id, await fixture.request());
  const saveReq = await observedRequest('case-content', doc.id, await fixture.request());
  const hooks = fixture.payload.collections['case-content'].config.hooks.beforeDelete;
  const index = hooks.indexOf(protectContentRouteDeletion);
  expect(index).toBeGreaterThanOrEqual(0);
  let read!: () => void, release!: () => void;
  const reached = new Promise<void>((resolve) => {
    read = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const gate: (typeof hooks)[number] = async ({ id }) => {
    if (String(id) === doc.id) {
      read();
      await hold;
    }
  };
  hooks.splice(index + 1, 0, gate);
  try {
    const deleting = fixture.payload
      .delete({ collection: 'case-content', id: doc.id, req: deleteReq, overrideAccess: false })
      .then(
        (value) => ({ ok: true as const, value }),
        (reason) => ({ ok: false as const, reason }),
      );
    await Promise.race([
      reached,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Delete did not reach actual hook barrier')), 5000),
      ),
    ]);
    const saving = fixture.payload
      .update({
        collection: 'case-content',
        id: doc.id,
        data: { slug: b, _status: 'draft' },
        draft: true,
        req: saveReq,
        overrideAccess: false,
      })
      .then(
        (value) => ({ ok: true as const, value }),
        (reason) => ({ ok: false as const, reason }),
      );
    const deadline = Date.now() + 5000;
    let blocked = false;
    while (Date.now() < deadline) {
      const state = await fixture.payload.db.execute({
        db: fixture.payload.db.drizzle,
        sql: sql`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND (query LIKE 'update "case_content"%' OR query LIKE 'delete from "case_routes"%')) AS blocked`,
      });
      if (state.rows[0]?.blocked === true) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(blocked).toBe(true);
    release();
    const outcomes = await Promise.all([deleting, saving]);
    console.info(
      'Observed real delete/save lock ordering:',
      outcomes.map((outcome) =>
        outcome.ok
          ? 'success'
          : (outcome.reason.code ?? outcome.reason.cause?.code ?? 'unexpected-error'),
      ),
    );
    expect(outcomes[0].ok).toBe(true);
    expect(
      outcomes[1].ok ? 'success' : (outcomes[1].reason.code ?? outcomes[1].reason.cause?.code),
    ).toBe('stale-revision');
    expect(await routes(doc.id)).toHaveLength(0);
  } finally {
    release();
    hooks.splice(hooks.indexOf(gate), 1);
  }
});

it('native create draft=true reserves privately even when valid input requests published status', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Effective create draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const chosen = slug();
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug: chosen,
      _status: 'published',
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(doc._status).toBe('draft');
  expect(await routes(doc.id)).toMatchObject([
    { slug: chosen, state: 'draft', everPublished: false },
  ]);
  expect(await resolveCaseRoute('pt', chosen, fixture.payload)).toEqual({ status: 404 });
});
