import { afterAll, beforeAll, expect, it } from 'vitest';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import * as publication from '../migrations/20261030_124550_publication_coordination';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('publication-migration');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('reverses and reapplies the additive publication migration in a real owned transaction', async () => {
  const req = await fixture.request();
  const id = await fixture.payload.db.beginTransaction();
  if (!id) throw new Error('Native transaction required');
  req.transactionID = id;
  const db = (fixture.payload.db as unknown as PostgresAdapter).sessions[String(id)]!.db;
  try {
    const args = { db, payload: fixture.payload, req };
    await publication.down(args);
    const absent = await db.execute(
      sql`SELECT to_regclass('public.publication_updates') AS relation`,
    );
    expect(absent.rows[0]).toMatchObject({ relation: null });
    await publication.up(args);
    const restored = await db.execute(
      sql`SELECT to_regclass('public.publication_updates') AS relation`,
    );
    expect(restored.rows[0]).toMatchObject({ relation: 'publication_updates' });
  } finally {
    await fixture.payload.db.rollbackTransaction(id);
    delete req.transactionID;
  }
});
