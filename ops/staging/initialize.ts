import { createHash } from 'node:crypto';
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres';
import { createLocalReq, type Migration, type Payload } from 'payload';
import { migrations } from '../../src/migrations';
import { provisionStructuralDocuments } from '../../src/config/provision-structural-documents';
import { planStagingCatalog } from './initialize-config.mjs';

type StagingInitializationTarget = {
  databaseUri: string;
  database: string;
  role: string;
  origin: string;
};
export type EditorialStagingInitializationOptions = StagingInitializationTarget & {
  mode: 'initialize' | 'verify';
  editor: { email: string; password: string };
};
export type FirstAccessStagingInitializationOptions = StagingInitializationTarget & {
  mode: 'prepare-first-access';
  editor?: never;
};
export type StagingInitializationOptions =
  EditorialStagingInitializationOptions | FirstAccessStagingInitializationOptions;
type StructuralBaseline = {
  collection: 'professional-profiles' | 'site-navigation';
  locale: string;
  id: string;
  updatedAt: string;
};
type StagingReceiptBase = {
  version: 1;
  environment: 'staging';
  database: string;
  origin: string;
  migrations: number;
  migrationLedgerSha256: string;
  structural: StructuralBaseline[];
  completedAt: string;
};
export type InitializedStagingReceipt = StagingReceiptBase & {
  editorId: string;
  structuralDocuments: number;
  freshProvisioning: boolean;
  status: 'initialized' | 'verified';
};
export type PendingFirstAccessStagingReceipt = StagingReceiptBase & {
  editorId: null;
  structuralDocuments: 0;
  freshProvisioning: false;
  status: 'pending-first-access';
};
export type StagingInitializationReceipt =
  InitializedStagingReceipt | PendingFirstAccessStagingReceipt;
type CatalogObject = { schema: string; name: string; kind: string };
type Connection = InstanceType<NonNullable<Payload['db']['pg']>['Client']>;
const migrationNames = migrations.map(({ name }) => name);
const refused = () =>
  new Error(
    'Staging initialization refused or incomplete. Keep database-only mode enabled and review the target.',
  );

function assertTarget(payload: Payload, options: StagingInitializationOptions) {
  const target = new URL(options.databaseUri);
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    target.host !== '127.0.0.1:55435' ||
    decodeURIComponent(target.pathname.slice(1)) !== options.database ||
    decodeURIComponent(target.username) !== options.role ||
    !target.password ||
    target.search ||
    target.hash ||
    !/^[a-z_][a-z0-9_]{0,62}$/i.test(options.database) ||
    ['postgres', 'template0', 'template1', 'adfl_local'].includes(options.database.toLowerCase()) ||
    !['initialize', 'verify', 'prepare-first-access'].includes(options.mode) ||
    (options.mode === 'prepare-first-access' ? options.editor !== undefined : !options.editor) ||
    new URL(options.origin).protocol !== 'https:' ||
    payload.db.name !== 'postgres' ||
    !payload.db.pg ||
    payload.db.pool ||
    payload.db.poolOptions.connectionString !== options.databaseUri ||
    payload.db.push !== false ||
    payload.db.disableCreateDatabase !== true ||
    payload.db.prodMigrations !== undefined ||
    Object.keys(payload.db.extensions).length
  )
    throw refused();
}

async function catalog(client: Connection) {
  const objects = await client.query<CatalogObject>(`
    SELECT n.nspname AS schema, c.relname AS name,
      CASE c.relkind WHEN 'S' THEN 'sequence' WHEN 'r' THEN 'table' WHEN 'p' THEN 'table' ELSE 'foreign-relation' END AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','S','v','m','f','c')
    UNION ALL
    SELECT n.nspname, t.typname, CASE t.typtype WHEN 'e' THEN 'enum' ELSE 'foreign-type' END
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND t.typtype IN ('e','d','r','m')
    UNION ALL
    SELECT n.nspname, p.proname, 'function' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
    UNION ALL
    SELECT nspname, nspname, 'schema' FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')
    LIMIT 2001
  `);
  if (objects.rows.length > 2000) throw refused();
  const hasLedger = objects.rows.some(
    ({ schema, name, kind }) =>
      schema === 'public' && name === 'payload_migrations' && kind === 'table',
  );
  const history = hasLedger
    ? (
        await client.query<{ name: string; batch: number }>(
          'SELECT name, batch FROM public.payload_migrations',
        )
      ).rows
    : null;
  return { objects: objects.rows, migrations: history };
}

async function structuralDocuments(payload: Payload) {
  const structural: StagingInitializationReceipt['structural'] = [];
  for (const collection of ['professional-profiles', 'site-navigation'] as const) {
    const result = await payload.find({ collection, limit: 3, draft: true, overrideAccess: true });
    if (
      result.totalDocs !== 2 ||
      new Set(result.docs.map(({ locale }) => locale)).size !== 2 ||
      result.docs.some(({ locale }) => !['pt', 'en'].includes(locale))
    )
      return null;
    structural.push(
      ...result.docs.map(({ id, locale, updatedAt }) => ({ collection, locale, id, updatedAt })),
    );
  }
  return structural.sort((left, right) =>
    `${left.collection}/${left.locale}`.localeCompare(`${right.collection}/${right.locale}`),
  );
}

async function assertEmptyApplicationData(client: Connection, expectedTables: string[]) {
  for (const table of expectedTables) {
    if (table === 'payload_migrations') continue;
    if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw refused();
    if (
      (
        await client.query<{ present: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM public."${table}" LIMIT 1) AS present`,
        )
      ).rows[0]?.present !== false
    )
      throw refused();
  }
}

async function provision(
  payload: Payload,
  client: Connection,
  options: EditorialStagingInitializationOptions,
  expectedTables: string[],
) {
  const users = await payload.find({
    collection: 'users',
    limit: 2,
    depth: 0,
    overrideAccess: true,
    where: { email: { equals: options.editor.email } },
  });
  const structural = await structuralDocuments(payload);
  if (users.totalDocs === 1 && structural)
    return { user: users.docs[0], structural, freshProvisioning: false };
  if (options.mode === 'verify' || users.totalDocs !== 0) throw refused();
  // A complete migration catalog without an account is recoverable only while every
  // application table is empty. No partial or foreign editorial data is adopted.
  await assertEmptyApplicationData(client, expectedTables);
  const req = await createLocalReq(
    { context: { trustedAccountProvisioning: true, trustedStructuralProvisioning: true } },
    payload,
  );
  const transaction = await payload.db.beginTransaction();
  if (!transaction) throw refused();
  req.transactionID = transaction;
  try {
    const user = await payload.create({
      collection: 'users',
      data: options.editor,
      overrideAccess: true,
      req,
    });
    req.user = { ...user, collection: 'users' };
    await provisionStructuralDocuments(req);
    await payload.db.commitTransaction(transaction);
    delete req.transactionID;
    const ready = await structuralDocuments(payload);
    if (!ready) throw refused();
    return { user, structural: ready, freshProvisioning: true };
  } catch (error) {
    if (req.transactionID) await payload.db.rollbackTransaction(transaction);
    throw error;
  }
}

/** Explicit operator action, never imported by application startup or an HTTP route. */
export function initializeStaging(
  payload: Payload,
  options: EditorialStagingInitializationOptions,
): Promise<InitializedStagingReceipt>;
export function initializeStaging(
  payload: Payload,
  options: FirstAccessStagingInitializationOptions,
): Promise<PendingFirstAccessStagingReceipt>;
export function initializeStaging(
  payload: Payload,
  options: StagingInitializationOptions,
): Promise<StagingInitializationReceipt>;
export async function initializeStaging(
  payload: Payload,
  options: StagingInitializationOptions,
): Promise<StagingInitializationReceipt> {
  assertTarget(payload, options);
  const client = new payload.db.pg!.Client({
    connectionString: options.databaseUri,
    application_name: 'adfl-staging-initialize-lock',
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  const expectedTables = [...new Set([...Object.keys(payload.db.tables), 'publication_retries'])];
  const expectedEnums = Object.keys(payload.db.enums);
  await client.connect();
  try {
    const identity = (
      await client.query<{ database: string; role: string; version: number }>(
        "SELECT current_database() AS database, current_user AS role, current_setting('server_version_num')::int AS version",
      )
    ).rows[0];
    if (
      identity?.database !== options.database ||
      identity.role !== options.role ||
      identity.version < 170000 ||
      identity.version >= 180000
    )
      throw refused();
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',
      [`adfl:staging-initialize:${options.database}`],
    );
    if (lock.rows[0]?.acquired !== true)
      throw new Error('Staging initialization is already active.');
    const activity = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'",
    );
    if (activity.rows[0]?.count !== '0')
      throw new Error(
        'Staging initialization requires database-only mode without other database clients.',
      );
    const phase = planStagingCatalog(
      await catalog(client),
      migrationNames,
      expectedTables,
      expectedEnums,
    );
    if (phase === 'empty' && options.mode === 'verify') throw refused();
    await payload.db.connect!();
    if (phase === 'empty') {
      const guarded = migrations.map((migration, index) => ({
        name: migration.name,
        async up(input: unknown) {
          const args = input as MigrateUpArgs;
          if (
            args.payload !== payload ||
            !args.req?.transactionID ||
            payload.db.sessions?.[String(await args.req.transactionID)]?.db !== args.db
          )
            throw refused();
          const acquired = await args.db.execute(
            sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`adfl:staging-initialize-ddl:${options.database}`},0)) AS acquired`,
          );
          if (acquired.rows[0]?.acquired !== true) throw refused();
          if (index > 0) {
            const before = await payload.find({
              collection: 'payload-migrations',
              limit: 0,
              overrideAccess: true,
              req: args.req,
            });
            const actual = before.docs.map(({ name }) => name);
            if (
              actual.length !== index ||
              migrationNames.slice(0, index).some((name) => !actual.includes(name))
            )
              throw refused();
          }
          await migration.up(args);
        },
        async down() {
          throw refused();
        },
      }));
      await payload.db.migrate({ migrations: guarded as Migration[] });
    }
    if (
      planStagingCatalog(await catalog(client), migrationNames, expectedTables, expectedEnums) !==
      'current'
    )
      throw refused();
    if (options.mode === 'prepare-first-access') {
      await assertEmptyApplicationData(client, expectedTables);
      return {
        version: 1,
        environment: 'staging',
        database: options.database,
        origin: options.origin,
        editorId: null,
        migrations: migrationNames.length,
        migrationLedgerSha256: createHash('sha256').update(migrationNames.join('\n')).digest('hex'),
        structuralDocuments: 0,
        structural: [],
        freshProvisioning: false,
        status: 'pending-first-access',
        completedAt: new Date().toISOString(),
      };
    }
    const result = await provision(payload, client, options, expectedTables);
    return {
      version: 1,
      environment: 'staging',
      database: options.database,
      origin: options.origin,
      editorId: result.user.id,
      migrations: migrationNames.length,
      migrationLedgerSha256: createHash('sha256').update(migrationNames.join('\n')).digest('hex'),
      structuralDocuments: result.structural.length,
      structural: result.structural,
      freshProvisioning: result.freshProvisioning,
      status: result.freshProvisioning || phase === 'empty' ? 'initialized' : 'verified',
      completedAt: new Date().toISOString(),
    };
  } finally {
    // Ending this connection releases the exclusive session lock even after failure.
    await client.end();
  }
}

/** The pinned Native connector owns one bootstrap checkout; this operator owns the whole pool. */
export async function closeStagingPayload(payload: Payload) {
  const pool = payload.db.pool as
    | (Payload['db']['pool'] & { _clients: { release: () => void }[]; _idle: { client: object }[] })
    | undefined;
  if (!pool) return payload.destroy();
  if (pool.waitingCount || Object.keys(payload.db.sessions ?? {}).length) throw refused();
  const borrowed = pool._clients.filter(
    (client) => !pool._idle.some(({ client: idle }) => idle === client),
  );
  if (borrowed.length > 1) throw refused();
  await payload.destroy();
  for (const client of borrowed) client.release();
  await pool.end();
}
