import { createHash } from 'node:crypto';
import path from 'node:path';
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres';
import type { Migration, Payload, PayloadRequest } from 'payload';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { withPublicationWriter } from '../../src/helpers/payload/publication-writer';
import { createLocalObjectStorage } from '../../src/helpers/storage/object-storage';
import { migrations } from '../../src/migrations';
import { createLocalBackupRepository } from '../backup/repository';
import { createNativeBackupSource } from '../backup/native-source';
import { runBackup, type RunBackupOptions } from '../backup/run';

type MigrationRecord = { name?: string | null; batch?: number | null };
const migrationName = '20261106_035830_cms_user_profile';
// SHA-256 of the sixteen ordered, newline-delimited migration names in 434ee5c.
const predecessorSha256 = 'd2923bddb2698729ede60e37703a6deac4eae5cdcd0e5a41dab6c5ee7a787735';

function reviewedMigration() {
  const current = migrations.at(-1);
  const predecessor = migrations.slice(0, -1).map(({ name }) => name);
  if (
    current?.name !== migrationName ||
    createHash('sha256').update(predecessor.join('\n')).digest('hex') !== predecessorSha256
  )
    throw new Error('The bundled migration history differs from the reviewed catalog.');
  return current;
}

/** The ledger may arrive in any order, but every reviewed migration appears exactly once. */
export function planControlledMigration(history: readonly MigrationRecord[]) {
  const current = reviewedMigration();
  const names = new Set<string>();
  for (const { name, batch } of history) {
    if (
      !name ||
      typeof batch !== 'number' ||
      !Number.isSafeInteger(batch) ||
      batch < 1 ||
      names.has(name)
    )
      throw new Error('The native migration history is invalid.');
    names.add(name);
  }
  const expected = names.size === migrations.length - 1 ? migrations.slice(0, -1) : migrations;
  if (names.size !== expected.length || expected.some(({ name }) => !names.has(name)))
    throw new Error(
      'The native migration history differs from the reviewed predecessor or current schema.',
    );
  return names.has(current.name) ? 'already-current' : 'pending';
}

export type ControlledMigrationOptions = {
  databaseUri: string;
  siteOrigin: string;
  /** Privileged composition re-inspects the currently acquired PostgreSQL owner. */
  assertOwned: (databaseName: string) => void;
  /** Supply a fresh Payload instance with DB connect, onInit and crons disabled. */
  initialize: () => Promise<Payload>;
  backup: Pick<RunBackupOptions, 'application' | 'recipient' | 'tools'> & {
    dump: (input: { snapshotId: string; destination: string }) => Promise<void>;
  };
};

export type ControlledMigrationResult =
  | { status: 'already-current' }
  | { status: 'applied'; backup: Awaited<ReturnType<typeof runBackup>>['marker'] };

function assertLocalRuntime() {
  if (
    process.env.APP_ENV !== 'test' ||
    [
      process.env.PAYLOAD_DROP_DATABASE,
      process.env.PUBLICATION_RETRIES_ENABLED,
      process.env.PUBLICATION_RETRY_WORKER_ENABLED,
      process.env.PUBLICATION_HTTP_VERIFICATION_ENABLED,
    ].some((value) => value !== undefined && value !== 'false')
  )
    throw new Error('Controlled local migration requires drop, retries and verification disabled.');
}

function localTarget(databaseUri: string, siteOrigin: string) {
  if (!URL.canParse(databaseUri) || !URL.canParse(siteOrigin))
    throw new Error('Controlled migration requires the owned local test target.');
  const database = new URL(databaseUri);
  const site = new URL(siteOrigin);
  const id = /^\/adfl_test_migration_([a-f0-9]{32})$/.exec(database.pathname)?.[1];
  if (
    !id ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    database.host !== '127.0.0.1:55434' ||
    database.username !== 'adfl_test' ||
    database.search ||
    database.hash ||
    site.protocol !== 'http:' ||
    site.hostname !== '127.0.0.1' ||
    !site.port ||
    siteOrigin !== site.origin
  )
    throw new Error('Controlled migration requires the owned local test target.');
  return { id, name: database.pathname.slice(1) };
}

export function assertUnconnectedMigrationAdapter(payload: Payload, databaseUri: string) {
  const db = payload.db;
  if (
    db.name !== 'postgres' ||
    db.pool ||
    !db.connect ||
    db.push !== false ||
    db.disableCreateDatabase !== true ||
    db.prodMigrations !== undefined ||
    Object.keys(db.extensions).length ||
    db.poolOptions.connectionString !== databaseUri ||
    Object.keys(db.poolOptions).length !== 1 ||
    payload.config.collections.some(({ slug }) => slug === 'publication-retries')
  )
    throw new Error(
      'Controlled migration refuses an already connected or automatic Native schema adapter.',
    );
}

async function readHistory(payload: Payload, req?: PayloadRequest) {
  return (
    await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true, req })
  ).docs;
}

function upwardOnly(payload: Payload, migration: ReturnType<typeof reviewedMigration>): Migration {
  return {
    name: migration.name,
    async up(input) {
      if (
        !input ||
        typeof input !== 'object' ||
        !('db' in input) ||
        !('payload' in input) ||
        input.payload !== payload ||
        !('req' in input) ||
        !input.req ||
        typeof input.req !== 'object' ||
        !('payload' in input.req) ||
        input.req.payload !== payload ||
        !('transactionID' in input.req)
      )
        throw new Error('Controlled migration requires the Native transaction request.');
      const id = input.req.transactionID;
      const session =
        typeof id === 'string' || typeof id === 'number' ? payload.db.sessions?.[id] : undefined;
      if (!session?.db || session.db !== input.db)
        throw new Error('Controlled migration requires the Native transaction database.');
      const { db, req } = input as MigrateUpArgs;
      // Keep exclusion in the actual DDL transaction even if the job's
      // separate advisory-lock session disconnects after the backup.
      const lock = await db.execute(sql`
        SELECT pg_try_advisory_xact_lock(hashtextextended('adfl:reviewed-migration-up', 0)) AS acquired
      `);
      if (lock.rows[0]?.acquired !== true)
        throw new Error('Reviewed migration transaction is busy.');
      if (planControlledMigration(await readHistory(payload, req)) !== 'pending')
        throw new Error('Reviewed migration transaction no longer has the expected predecessor.');
      await migration.up({ db, req, payload });
    },
    async down() {
      throw new Error('Controlled migration only supports the reviewed up operation.');
    },
  };
}

export async function inspectReviewedMigration(payload: Payload) {
  const history = await readHistory(payload);
  return {
    status: planControlledMigration(history),
    schemaSha256: createHash('sha256')
      .update(
        history
          .map(({ name }) => name)
          .sort()
          .join('\n'),
      )
      .digest('hex'),
  };
}

/** The caller holds an exclusive job lock and has already stopped application writers. */
export async function applyReviewedMigration(
  payload: Payload,
  createVerifiedBackup: () => Promise<Awaited<ReturnType<typeof runBackup>>['marker']>,
): Promise<ControlledMigrationResult> {
  if ((await inspectReviewedMigration(payload)).status === 'already-current')
    return { status: 'already-current' };
  const backup = await createVerifiedBackup();
  if ((await inspectReviewedMigration(payload)).status !== 'pending')
    throw new Error('The native migration history changed after the pre-migration backup.');
  await payload.db.migrate({ migrations: [upwardOnly(payload, reviewedMigration())] });
  if ((await inspectReviewedMigration(payload)).status !== 'already-current')
    throw new Error('Native migration finished without the reviewed current history.');
  return { status: 'applied', backup };
}

export async function runControlledMigration(
  options: ControlledMigrationOptions,
): Promise<ControlledMigrationResult> {
  assertLocalRuntime();
  const target = localTarget(options.databaseUri, options.siteOrigin);
  reviewedMigration();
  return withPublicationWriter('a-design-for-life:controlled-local-migration:55434', async () => {
    options.assertOwned(target.name);
    const payload = await options.initialize();
    assertLocalRuntime();
    assertUnconnectedMigrationAdapter(payload, options.databaseUri);
    options.assertOwned(target.name);
    await payload.db.connect!();
    return applyReviewedMigration(payload, async () => {
      const namespace = {
        project: 'a-design-for-life',
        environment: 'test',
        source: `migration-${target.id}`,
      } as const;
      const repository = await createLocalBackupRepository({ namespace });
      const directory = publicRootDirectory({
        APP_ENV: 'test',
        SITE_ORIGIN: options.siteOrigin,
        DATABASE_URI: options.databaseUri,
      });
      const storage = createLocalObjectStorage(
        path.resolve('.work/private-media', `adfl-test-migration-${target.id}`, target.name),
      );
      const backup = await runBackup({
        namespace,
        repository,
        application: options.backup.application,
        recipient: options.backup.recipient,
        tools: options.backup.tools,
        source: createNativeBackupSource({
          payload,
          directory,
          storage,
          async dump(input) {
            options.assertOwned(target.name);
            await options.backup.dump(input);
          },
        }),
      });
      assertLocalRuntime();
      options.assertOwned(target.name);
      return backup.marker;
    });
  });
}
