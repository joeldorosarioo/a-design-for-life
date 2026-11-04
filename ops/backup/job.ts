import { writeSync } from 'node:fs';
import { getPayload, type Payload } from 'payload';
import { readIntegrationEnv } from '../../src/config/integration-env';
import { readServerEnv } from '../../src/config/server-env';
import { mediaRuntime } from '../../src/features/media-library/server/media-runtime';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import {
  applyReviewedMigration,
  assertUnconnectedMigrationAdapter,
  inspectReviewedMigration,
} from '../migrations/controlled';
import { selectBackupJob } from './job-settings';
import { createNativeBackupSource } from './native-source';
import { dumpPostgresSnapshot, postgresDumpConnection } from './postgres-dump';
import { createR2BackupRepository } from './r2-repository';
import { createLocalBackupRepository } from './repository';
import { runBackup } from './run';
import { runBackupTool } from './tools';

const tools = {
  ageBinary: '/opt/adfl-age/age',
  tarBinary: '/usr/bin/tar',
};
const pgDumpBinary = '/usr/lib/postgresql/17/bin/pg_dump';

async function withOperationalLock<T>(
  payload: Payload,
  databaseUri: string,
  operation: () => Promise<T>,
) {
  // Session-scoped PostgreSQL lock is shared by jobs even across network namespaces.
  // PostgreSQL releases it when the dedicated client disconnects after process failure.
  const client = await payload.db.pool.connect();
  try {
    const actual = await client.query<{ database: string; version: number }>(
      "SELECT current_database() AS database, current_setting('server_version_num')::int AS version",
    );
    if (
      actual.rows[0]?.database !== postgresDumpConnection(databaseUri).PGDATABASE ||
      actual.rows[0].version < 170000 ||
      actual.rows[0].version >= 180000
    )
      throw new Error('Operational job PostgreSQL target mismatch.');
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended('adfl:operational-backup-job', 0)) AS acquired",
    );
    if (lock.rows[0]?.acquired !== true) throw new Error('Operational job already active.');
    return await operation();
  } finally {
    // Destroy the client so an advisory lock can never return to the pool.
    client.release(true);
  }
}

function stagingBackupRepository(
  settings: ReturnType<typeof selectBackupJob>,
  env: ReturnType<typeof readServerEnv>,
) {
  const { storage } = readIntegrationEnv(process.env, env);
  if (storage.driver !== 'r2') throw new Error('Remote source storage configuration is required.');
  const { OPS_BACKUP_BUCKET, OPS_BACKUP_ACCESS_KEY_ID, OPS_BACKUP_SECRET_ACCESS_KEY } = process.env;
  if (
    !OPS_BACKUP_BUCKET ||
    !OPS_BACKUP_ACCESS_KEY_ID ||
    !OPS_BACKUP_SECRET_ACCESS_KEY ||
    OPS_BACKUP_ACCESS_KEY_ID === storage.accessKeyId ||
    OPS_BACKUP_SECRET_ACCESS_KEY === storage.secretAccessKey
  )
    throw new Error('Dedicated backup storage credentials are required.');
  return createR2BackupRepository({
    namespace: settings.namespace,
    endpoint: storage.endpoint,
    bucket: OPS_BACKUP_BUCKET,
    sourceMediaBucket: storage.bucket,
    accessKeyId: OPS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: OPS_BACKUP_SECRET_ACCESS_KEY,
  });
}

async function main() {
  const settings = selectBackupJob(process.env, process.argv.slice(2));
  const env = readServerEnv(process.env);
  if (env.DATABASE_URI !== settings.databaseUri)
    throw new Error('Operational job changed database configuration.');
  // This process uses the application config to read Native inventory. It neither
  // owns nor needs the actual Resend credentials, and no approved migration calls mail.
  if (env.APP_ENV === 'staging') {
    process.env.RESEND_API_KEY = 'inert-backup-job';
    process.env.EDITORIAL_EMAIL_FROM_ADDRESS = 'ops@mail.joeldorosarioo.dev';
    process.env.EDITORIAL_EMAIL_FROM_NAME = 'Operational backup';
  }
  const version = (await runBackupTool({ binary: pgDumpBinary, args: ['--version'] })).stdout;
  if (!/^pg_dump \(PostgreSQL\) 17\.\d+\b/.test(version))
    throw new Error('Expected PostgreSQL 17 dump tool.');

  const { default: config } = await import('../../src/payload.config');
  const payload = await getPayload({ config, disableDBConnect: true, disableOnInit: true });
  try {
    assertUnconnectedMigrationAdapter(payload, settings.databaseUri);
    await payload.db.connect!();
    return await withOperationalLock(payload, settings.databaseUri, async () => {
      const source = createNativeBackupSource({
        payload,
        directory: publicRootDirectory(env),
        storage: mediaRuntime().storage,
        dump: (input) =>
          dumpPostgresSnapshot({
            ...input,
            databaseUri: settings.databaseUri,
            binary: pgDumpBinary,
          }),
      });
      const createVerifiedBackup = async () => {
        const { schemaSha256 } = await inspectReviewedMigration(payload);
        const options = {
          namespace: settings.namespace,
          application: settings.application(schemaSha256),
          recipient: settings.recipient,
          source,
          tools,
        };
        if (settings.namespace.environment === 'test')
          return runBackup({
            ...options,
            repository: await createLocalBackupRepository({ namespace: settings.namespace }),
          });
        return runBackup({ ...options, repository: stagingBackupRepository(settings, env) });
      };
      if (settings.command === 'migrate')
        return applyReviewedMigration(payload, async () => (await createVerifiedBackup()).marker);
      const { marker, durationMs } = await createVerifiedBackup();
      return { status: 'backed-up', marker, durationMs };
    });
  } finally {
    await payload.destroy();
  }
}

const exit = await main().then(
  (result) => {
    writeSync(1, JSON.stringify(result) + '\n');
    return 0;
  },
  () => {
    writeSync(2, 'Operational backup job failed.\n');
    return 1;
  },
);
// Every tool, database operation and output above was awaited. End the isolated
// CLI even if the Native adapter kept its startup pool checkout alive.
process.exit(exit);
