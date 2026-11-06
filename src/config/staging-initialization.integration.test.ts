import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, type Migration, type Payload } from 'payload';
import config from '@payload-config';
import { migrations } from '../migrations';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { isolatedTestDatabaseUri } from '../../testing/setup/test-environment';
import {
  closeStagingPayload,
  initializeStaging,
  type EditorialStagingInitializationOptions,
  type StagingInitializationOptions,
} from '../../ops/staging/initialize';

type NativeClient = InstanceType<NonNullable<Payload['db']['pg']>['Client']>;
let administrator: NativeClient;
let makeClient: NonNullable<Payload['db']['pg']>['Client'];
let driver: NonNullable<Payload['db']['pg']>;
const databases = new Set<string>();
const payloads = new Set<Payload>();
let acquired: ReturnType<typeof inspectOwnedTestDatabase>;

function assertOwned() {
  const current = inspectOwnedTestDatabase();
  if (current.containerId !== acquired.containerId || current.networkId !== acquired.networkId)
    throw new Error('Staging initializer proof lost its acquired PostgreSQL.');
}
// Test-only transport adaptation. Guard inputs still use logical port55435,
// but every actual socket goes to the acquired synthetic runner on55434.
// Never bind or connect to the user's real SSH forward on55435.
function ownedTransport() {
  function redirected(config: unknown) {
    assertOwned();
    if (
      !config ||
      typeof config !== 'object' ||
      !('connectionString' in config) ||
      typeof config.connectionString !== 'string'
    )
      throw new Error('Owned Native transport configuration required.');
    const url = new URL(config.connectionString);
    const fixture = new URL(isolatedTestDatabaseUri);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (
      url.host !== '127.0.0.1:55435' ||
      url.username !== fixture.username ||
      url.password !== fixture.password ||
      url.search ||
      url.hash ||
      !/^adfl_test_staging_[a-f0-9]{32}$/.test(database) ||
      !databases.has(database)
    )
      throw new Error('Owned Native transport refused a nonfixture target.');
    url.port = '55434';
    return { ...config, connectionString: url.href };
  }
  class OwnedClient extends driver.Client {
    constructor(config?: ConstructorParameters<typeof driver.Client>[0]) {
      super(redirected(config));
    }
  }
  class OwnedPool extends driver.Pool {
    constructor(config?: ConstructorParameters<typeof driver.Pool>[0]) {
      super(redirected(config));
    }
  }
  return { ...driver, Client: OwnedClient, Pool: OwnedPool } as typeof driver;
}

async function prepared(database: string) {
  assertOwned();
  const selected = new URL(isolatedTestDatabaseUri);
  selected.port = '55435';
  selected.pathname = `/${database}`;
  const nativeConfig = await config;
  const payload = await getPayload({
    config: {
      ...nativeConfig,
      logger: { options: { level: 'silent' } } as typeof nativeConfig.logger,
      typescript: { ...nativeConfig.typescript, autoGenerate: false },
    },
    disableDBConnect: true,
    disableOnInit: true,
    key: `staging-initialize-proof-${randomUUID()}`,
  });
  payload.db.poolOptions = { connectionString: selected.href };
  payload.db.pg = ownedTransport();
  payloads.add(payload);
  return payload;
}
async function close(payload: Payload) {
  await closeStagingPayload(payload);
  payloads.delete(payload);
}
async function target() {
  assertOwned();
  const database = `adfl_test_staging_${randomUUID().replaceAll('-', '')}`;
  await administrator.query(`CREATE DATABASE "${database}"`);
  databases.add(database);
  const uri = new URL(isolatedTestDatabaseUri);
  uri.port = '55435';
  uri.pathname = `/${database}`;
  const options: EditorialStagingInitializationOptions = {
    databaseUri: uri.href,
    database,
    role: 'adfl_test',
    origin: 'https://staging.example.invalid',
    mode: 'initialize',
    editor: {
      email: `staging-${randomUUID()}@example.invalid`,
      password: 'Synthetic-initial-staging-editor-123!',
    },
  };
  return options;
}
async function client(options: StagingInitializationOptions) {
  const connection = new (ownedTransport().Client)({ connectionString: options.databaseUri });
  await connection.connect();
  return connection;
}

beforeAll(async () => {
  acquired = inspectOwnedTestDatabase();
  const nativeConfig = await config;
  const base = await getPayload({
    config: {
      ...nativeConfig,
      logger: { options: { level: 'silent' } } as typeof nativeConfig.logger,
      typescript: { ...nativeConfig.typescript, autoGenerate: false },
    },
    disableDBConnect: true,
    disableOnInit: true,
    key: `staging-initialize-admin-${randomUUID()}`,
  });
  driver = base.db.pg!;
  makeClient = driver.Client;
  await base.destroy();
  administrator = new makeClient({ connectionString: isolatedTestDatabaseUri });
  await administrator.connect();
});
afterAll(async () => {
  if (acquired) assertOwned();
  for (const payload of payloads) await close(payload);
  if (administrator) {
    for (const database of databases) {
      assertOwned();
      await administrator.query(`DROP DATABASE "${database}"`);
    }
    await administrator.end();
  }
});

it('initializes sixteen Native migrations and one editor/four drafts, then preserves credentials/content on rerun', async () => {
  const options = await target();
  const first = await prepared(options.database);
  const created = await initializeStaging(first, options);
  expect(created).toMatchObject({
    status: 'initialized',
    migrations: 16,
    structuralDocuments: 4,
    freshProvisioning: true,
  });
  const before = await Promise.all(
    (['professional-profiles', 'site-navigation'] as const).map(
      async (collection) =>
        (
          await first.find({
            collection,
            limit: 0,
            draft: true,
            overrideAccess: true,
            sort: 'locale',
          })
        ).docs,
    ),
  );
  const originalUser = await first.findByID({
    collection: 'users',
    id: created.editorId,
    overrideAccess: true,
  });
  await close(first);
  const repeated = await prepared(options.database);
  expect(
    await initializeStaging(repeated, {
      ...options,
      editor: { ...options.editor, password: 'Synthetic-ignored-replacement-456!' },
    }),
  ).toMatchObject({ status: 'verified', editorId: created.editorId, freshProvisioning: false });
  const after = await Promise.all(
    (['professional-profiles', 'site-navigation'] as const).map(
      async (collection) =>
        (
          await repeated.find({
            collection,
            limit: 0,
            draft: true,
            overrideAccess: true,
            sort: 'locale',
          })
        ).docs,
    ),
  );
  expect(after).toEqual(before);
  expect(
    (await repeated.findByID({ collection: 'users', id: created.editorId, overrideAccess: true }))
      .updatedAt,
  ).toBe(originalUser.updatedAt);
  expect(
    (await repeated.login({ collection: 'users', data: options.editor, overrideAccess: false }))
      .user?.id,
  ).toBe(created.editorId);
  await close(repeated);
  const verified = await prepared(options.database);
  expect(await initializeStaging(verified, { ...options, mode: 'verify' })).toMatchObject({
    status: 'verified',
    editorId: created.editorId,
  });
  await close(verified);
}, 90000);

it('refuses an empty verify, foreign tables and partial migration ledgers without modifying them', async () => {
  for (const kind of ['empty', 'foreign', 'partial'] as const) {
    const options = await target();
    const connection = await client(options);
    if (kind === 'foreign')
      await connection.query(
        "CREATE TABLE foreign_owner (value text); INSERT INTO foreign_owner VALUES ('preserve')",
      );
    if (kind === 'partial') {
      await connection.query('CREATE TABLE payload_migrations (name varchar, batch integer)');
      await connection.query('INSERT INTO payload_migrations VALUES ($1,1)', [migrations[0].name]);
    }
    await connection.end();
    const payload = await prepared(options.database);
    await expect(
      initializeStaging(payload, { ...options, mode: kind === 'empty' ? 'verify' : 'initialize' }),
    ).rejects.toThrow();
    expect(payload.db.pool).toBeUndefined();
    await close(payload);
    const inspected = await client(options);
    if (kind === 'foreign')
      expect((await inspected.query('SELECT value FROM foreign_owner')).rows).toEqual([
        { value: 'preserve' },
      ]);
    if (kind === 'partial')
      expect((await inspected.query('SELECT name FROM payload_migrations')).rows).toEqual([
        { name: migrations[0].name },
      ]);
    await inspected.end();
  }
}, 90000);

it('refuses a concurrent initialization owner before running schema changes', async () => {
  const options = await target();
  const held = await client(options);
  await held.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
    `adfl:staging-initialize:${options.database}`,
  ]);
  const payload = await prepared(options.database);
  try {
    await expect(initializeStaging(payload, options)).rejects.toThrow('already active');
    expect(payload.db.pool).toBeUndefined();
  } finally {
    await held.end();
    await close(payload);
  }
});

it('rolls back the first editor and all structural drafts together after a real PostgreSQL constraint failure', async () => {
  const options = await target();
  const schema = await prepared(options.database);
  await schema.db.connect!();
  await schema.db.migrate({ migrations: migrations as Migration[] });
  await close(schema);
  const restriction = await client(options);
  await restriction.query(
    "ALTER TABLE profiles ADD CONSTRAINT staging_fixture_refusal CHECK (locale::text <> 'en')",
  );
  await restriction.end();
  const payload = await prepared(options.database);
  await expect(initializeStaging(payload, options)).rejects.toThrow();
  expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(0);
  expect(
    (
      await payload.find({
        collection: 'site-navigation',
        draft: true,
        limit: 0,
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  expect(
    (
      await payload.find({
        collection: 'professional-profiles',
        draft: true,
        limit: 0,
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  await close(payload);
  const recovered = await client(options);
  await recovered.query('ALTER TABLE profiles DROP CONSTRAINT staging_fixture_refusal');
  await recovered.end();
  const retry = await prepared(options.database);
  expect(await initializeStaging(retry, options)).toMatchObject({
    status: 'initialized',
    freshProvisioning: true,
  });
  await close(retry);
}, 90000);

it('prepares only the schema for browser-first access without accepting editor credentials or adopting existing accounts', async () => {
  const source = await target();
  const options = {
    databaseUri: source.databaseUri,
    database: source.database,
    role: source.role,
    origin: source.origin,
    mode: 'prepare-first-access' as const,
  };
  const first = await prepared(options.database);
  const ready = await initializeStaging(first, options);
  expect(ready).toMatchObject({
    status: 'pending-first-access',
    migrations: 16,
    editorId: null,
    structuralDocuments: 0,
    structural: [],
    freshProvisioning: false,
  });
  expect((await first.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(0);
  expect(
    (
      await first.find({
        collection: 'site-navigation',
        draft: true,
        limit: 0,
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  expect(
    (
      await first.find({
        collection: 'professional-profiles',
        draft: true,
        limit: 0,
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  await close(first);
  const repeated = await prepared(options.database);
  expect(await initializeStaging(repeated, options)).toMatchObject({
    status: 'pending-first-access',
    editorId: null,
    structuralDocuments: 0,
  });
  await repeated.create({
    collection: 'users',
    data: source.editor,
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  await close(repeated);
  const occupied = await prepared(options.database);
  await expect(initializeStaging(occupied, options)).rejects.toThrow();
  expect((await occupied.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1);
  expect(
    (
      await occupied.find({
        collection: 'professional-profiles',
        draft: true,
        limit: 0,
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  await close(occupied);
}, 90000);
