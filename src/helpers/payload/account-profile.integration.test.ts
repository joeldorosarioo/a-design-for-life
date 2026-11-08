import { afterAll, beforeAll, expect, it } from 'vitest';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../../testing/fixtures/editorial-auth';
import { mediaMetadataFixture } from '../../../testing/fixtures/editorial-lifecycle';
import { inspectOwnedTestDatabase } from '../../../testing/setup/owned-test-database';
import { assertIsolatedTestEnvironment } from '../../../testing/setup/test-environment';
import * as profileMigration from '../../migrations/20261106_035830_cms_user_profile';

const key = 'account-profile-migration';
const password = 'Synthetic-editorial-test-password-123!';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let acquired: ReturnType<typeof inspectOwnedTestDatabase>;
let cookie: string;

function sessionHeaders() {
  const origin = fixture.payload.config.serverURL;
  if (!origin) throw new Error('Native cookie proof requires the configured origin.');
  // Payload rejects cookie-only non-browser requests when a CSRF allowlist exists.
  return new Headers({ cookie, origin });
}

function assertOwned() {
  assertIsolatedTestEnvironment(process.env);
  const current = inspectOwnedTestDatabase();
  if (current.containerId !== acquired.containerId || current.networkId !== acquired.networkId)
    throw new Error('Account migration proof lost its acquired PostgreSQL.');
}

beforeAll(async () => {
  assertIsolatedTestEnvironment(process.env);
  acquired = inspectOwnedTestDatabase();
  fixture = await createEditorialPayloadFixture(key);
  const login = await authHTTP('login', { email: fixture.user.email, password }, undefined, key);
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  expect(cookie).toMatch(/^payload-token=.+/);
});

afterAll(async () => {
  await fixture?.payload.destroy();
});

it('preserves the existing account, password credentials and active session across the additive migration', async () => {
  assertOwned();
  const { payload, user } = fixture;
  const authenticatedBefore = await payload.auth({ headers: sessionHeaders() });
  expect(authenticatedBefore.user?.id).toBe(user.id);
  const req = await fixture.request();
  const transaction = await payload.db.beginTransaction();
  if (!transaction) throw new Error('Native migration transaction required.');
  req.transactionID = transaction;
  const db = (payload.db as unknown as PostgresAdapter).sessions[String(transaction)]!.db;
  try {
    const args = { db, payload, req };
    const credentialsBefore = await db.execute(sql`
      SELECT id, email, hash, salt, created_at, updated_at FROM users WHERE id = ${user.id}
    `);
    const sessionsBefore = await db.execute(sql`
      SELECT * FROM users_sessions WHERE _parent_id = ${user.id} ORDER BY _order
    `);
    expect(credentialsBefore.rows).toHaveLength(1);
    expect(credentialsBefore.rows[0]?.hash).toBeTruthy();
    expect(credentialsBefore.rows[0]?.salt).toBeTruthy();
    expect(sessionsBefore.rows.length).toBeGreaterThan(0);

    // Roll back the entire proof afterwards: no other fixture loses profile data.
    // Between down/up the account genuinely has the preceding schema.
    await profileMigration.down(args);
    const removed = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('name', 'avatar_id')
    `);
    expect(removed.rows).toEqual([]);
    const precedingAccount = await db.execute(sql`
      SELECT id, email, hash, salt, created_at, updated_at FROM users WHERE id = ${user.id}
    `);
    expect(precedingAccount.rows).toEqual(credentialsBefore.rows);

    await profileMigration.up(args);
    const credentialsAfter = await db.execute(sql`
      SELECT id, email, hash, salt, created_at, updated_at FROM users WHERE id = ${user.id}
    `);
    const sessionsAfter = await db.execute(sql`
      SELECT * FROM users_sessions WHERE _parent_id = ${user.id} ORDER BY _order
    `);
    expect(credentialsAfter.rows).toEqual(credentialsBefore.rows);
    expect(sessionsAfter.rows).toEqual(sessionsBefore.rows);
    const migrated = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      req,
      overrideAccess: false,
    });
    expect(migrated).toMatchObject({ id: user.id, email: user.email });
    expect(migrated).not.toHaveProperty('name');
    expect(migrated).not.toHaveProperty('avatar');
    const legacyFields = await db.execute(sql`
      SELECT name, avatar_id FROM users WHERE id = ${user.id}
    `);
    expect(legacyFields.rows).toEqual([{ name: null, avatar_id: null }]);
    const authenticatedAfter = await payload.auth({ headers: sessionHeaders(), req });
    expect(authenticatedAfter.user?.id).toBe(user.id);
  } finally {
    await payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
});

it('keeps previously stored account profile data while omitting it from native account operations', async () => {
  assertOwned();
  const { payload, user } = fixture;
  const image = await mediaMetadataFixture(payload);
  const pool = payload.db.pool;
  await pool.query('UPDATE users SET name = $1, avatar_id = $2 WHERE id = $3', [
    'Previously saved name',
    image.id,
    user.id,
  ]);

  const attemptedProfileUpdate = { email: user.email, name: 'New name', avatar: null };
  const saved = await payload.update({
    collection: 'users',
    id: user.id,
    data: attemptedProfileUpdate,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(saved).toMatchObject({ id: user.id, email: user.email });
  expect(saved).not.toHaveProperty('name');
  expect(saved).not.toHaveProperty('avatar');

  const { rows } = await pool.query('SELECT name, avatar_id FROM users WHERE id = $1', [user.id]);
  expect(rows).toEqual([{ name: 'Previously saved name', avatar_id: image.id }]);
  const { user: authenticated } = await payload.auth({ headers: sessionHeaders() });
  expect(authenticated?.id).toBe(user.id);
  expect(authenticated).not.toHaveProperty('name');
  expect(authenticated).not.toHaveProperty('avatar');
});
