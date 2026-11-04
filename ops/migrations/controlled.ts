import { createHash } from 'node:crypto';
import path from 'node:path';
import type { MigrateUpArgs } from '@payloadcms/db-postgres';
import type { Migration, Payload } from 'payload';
import { captureBackupMediaInventory } from '../../src/features/media-library/server/backup-inventory';
import { withNativeBackupSnapshot } from '../../src/helpers/payload/backup-snapshot';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { withPublicationWriter } from '../../src/helpers/payload/publication-writer';
import { createLocalObjectStorage } from '../../src/helpers/storage/object-storage';
import { migrations } from '../../src/migrations';
import { createLocalBackupRepository } from '../backup/repository';
import { runBackup, type RunBackupOptions } from '../backup/run';

type MigrationRecord = { name?: string | null; batch?: number | null };
const migrationName = '20261104_012603_publication_retry_metadata';
// SHA-256 of the ordered, newline-delimited migration names in 60314d2.
const predecessorSha256 = 'a7caa3319f3ea3c4290c54f6a64e621ee239d7d3396f18f3c65e6ea28b9e25d2';

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

function assertNativeAdapter(payload: Payload, databaseUri: string) {
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

async function readHistory(payload: Payload) {
  return (await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }))
    .docs;
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
      await migration.up(input as MigrateUpArgs);
    },
    async down() {
      throw new Error('Controlled migration only supports the reviewed up operation.');
    },
  };
}

export async function runControlledMigration(
  options: ControlledMigrationOptions,
): Promise<ControlledMigrationResult> {
  assertLocalRuntime();
  const target = localTarget(options.databaseUri, options.siteOrigin);
  const migration = reviewedMigration();
  return withPublicationWriter('a-design-for-life:controlled-local-migration:55434', async () => {
    options.assertOwned(target.name);
    const payload = await options.initialize();
    assertLocalRuntime();
    assertNativeAdapter(payload, options.databaseUri);
    options.assertOwned(target.name);
    await payload.db.connect!();
    if (planControlledMigration(await readHistory(payload)) === 'already-current')
      return { status: 'already-current' };

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
      source: {
        storage,
        capture: (consume) =>
          withNativeBackupSnapshot(
            { payload, directory, capture: captureBackupMediaInventory },
            ({ snapshotId, root, captured }) =>
              consume({
                root,
                objects: captured.objects,
                async dump(destination) {
                  options.assertOwned(target.name);
                  await options.backup.dump({ snapshotId, destination });
                },
              }),
          ),
      },
    });
    assertLocalRuntime();
    options.assertOwned(target.name);
    if (planControlledMigration(await readHistory(payload)) !== 'pending')
      throw new Error('The native migration history changed after the pre-migration backup.');
    await payload.db.migrate({ migrations: [upwardOnly(payload, migration)] });
    if (planControlledMigration(await readHistory(payload)) !== 'already-current')
      throw new Error('Native migration finished without the reviewed current history.');
    return { status: 'applied', backup: backup.marker };
  });
}
