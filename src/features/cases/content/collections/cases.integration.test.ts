import { afterAll, beforeAll, expect, it } from 'vitest';
import { sql } from '@payloadcms/db-postgres';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-case-deletion');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
const createCase = () =>
  fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic referenced identity' },
    req: undefined,
    overrideAccess: true,
  });
it.each([false, true])(
  'rejeita exclusão da identidade referenciada e preserva tradução/versões, overrideAccess=%s',
  async (overrideAccess) => {
    const parent = await createCase();
    const content = await fixture.payload.create({
      collection: 'case-content',
      data: { case: parent.id, locale: 'pt' },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const versions = await fixture.payload.findVersions({
      collection: 'case-content',
      where: { parent: { equals: content.id } },
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(versions.totalDocs).toBeGreaterThan(0);
    await expect(
      fixture.payload.delete({
        collection: 'cases',
        id: parent.id,
        req: await fixture.request(),
        overrideAccess,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await fixture.payload.findByID({
        collection: 'cases',
        id: parent.id,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({ id: parent.id });
    expect(
      await fixture.payload.findByID({
        collection: 'case-content',
        id: content.id,
        depth: 0,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({ case: parent.id });
    const after = await fixture.payload.findVersions({
      collection: 'case-content',
      where: { parent: { equals: content.id } },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(after.docs.map((doc) => [doc.id, doc.version.case])).toEqual(
      versions.docs.map((doc) => [
        doc.id,
        typeof doc.version.case === 'object' ? doc.version.case.id : doc.version.case,
      ]),
    );
  },
);
it('permite excluir identidade vazia sem ampliar a política de exclusão', async () => {
  const parent = await createCase();
  await expect(
    fixture.payload.delete({
      collection: 'cases',
      id: parent.id,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ id: parent.id });
  await expect(
    fixture.payload.findByID({
      collection: 'cases',
      id: parent.id,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 404 });
});
async function waitForBlockedQuery(prefix: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await fixture.payload.db.execute({
      db: fixture.payload.db.drizzle,
      sql: sql`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE ${prefix + '%'}) AS blocked`,
    });
    if (result.rows[0]?.blocked === true) {
      console.info('Observed actual PostgreSQL FK lock wait:', prefix);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected real database lock wait: ${prefix}`);
}
it('a tradução não confirmada bloqueia DELETE no banco e preserva identidade quando vence a corrida', async () => {
  const parent = await createCase();
  const req = await fixture.request();
  const transactionID = await fixture.payload.db.beginTransaction();
  if (!transactionID) throw new Error('Expected PostgreSQL transaction');
  req.transactionID = transactionID;
  let committed = false;
  try {
    const content = await fixture.payload.create({
      collection: 'case-content',
      data: { case: parent.id, locale: 'pt' },
      draft: true,
      req,
      overrideAccess: false,
    });
    const deletion = fixture.payload.delete({
      collection: 'cases',
      id: parent.id,
      req: await fixture.request(),
      overrideAccess: true,
    });
    const result = deletion.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );
    await waitForBlockedQuery('delete from "cases"');
    await fixture.payload.db.commitTransaction(transactionID);
    committed = true;
    delete req.transactionID;
    expect((await result).status).toBe('rejected');
    expect(
      await fixture.payload.findByID({
        collection: 'case-content',
        id: content.id,
        depth: 0,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({ case: parent.id });
    expect(
      await fixture.payload.findByID({
        collection: 'cases',
        id: parent.id,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({ id: parent.id });
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transactionID);
    delete req.transactionID;
  }
});
it('DELETE não confirmado bloqueia INSERT e a tradução perde sem ficar órfã quando exclusão vence', async () => {
  const parent = await createCase();
  const req = await fixture.request();
  const transactionID = await fixture.payload.db.beginTransaction();
  if (!transactionID) throw new Error('Expected PostgreSQL transaction');
  req.transactionID = transactionID;
  let committed = false;
  try {
    await fixture.payload.delete({
      collection: 'cases',
      id: parent.id,
      req,
      overrideAccess: false,
    });
    const creation = fixture.payload.create({
      collection: 'case-content',
      data: { case: parent.id, locale: 'pt' },
      draft: true,
      req: await fixture.request(),
      overrideAccess: true,
    });
    const result = creation.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );
    await waitForBlockedQuery('insert into "case_content"');
    await fixture.payload.db.commitTransaction(transactionID);
    committed = true;
    delete req.transactionID;
    expect((await result).status).toBe('rejected');
    expect(
      (
        await fixture.payload.find({
          collection: 'case-content',
          where: { case: { equals: parent.id } },
          draft: true,
          req: await fixture.request(),
          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(0);
  } finally {
    if (!committed) await fixture.payload.db.rollbackTransaction(transactionID);
    delete req.transactionID;
  }
});
