import { getPayload } from 'payload';
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
import { dumpPostgresSnapshot } from './postgres-dump';
import { withOperationalBackupLock, type OperationalBackupLockPermit } from './r2-retention-lock';
import { createR2BackupRepository } from './r2-repository';
import { createLocalBackupRepository } from './repository';
import { runBackup } from './run';
import { runBackupTool } from './tools';

function stagingBackupRepository(
  settings: ReturnType<typeof selectBackupJob>,
  env: ReturnType<typeof readServerEnv>,
  retentionLock: OperationalBackupLockPermit,
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
    retentionLock,
  });
}

export type OperationalBackupJobOptions = {
  args?: readonly string[];
  tools?: { ageBinary: string; tarBinary: string };
  pgDumpBinary?: string;
};

export async function runOperationalBackupJob(options: OperationalBackupJobOptions = {}) {
  const tools = options.tools ?? {
    ageBinary: '/opt/adfl-age/age',
    tarBinary: '/usr/bin/tar',
  };
  const pgDumpBinary = options.pgDumpBinary ?? '/usr/lib/postgresql/17/bin/pg_dump';
  const settings = selectBackupJob(process.env, options.args ?? process.argv.slice(2));
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
    const integration = readIntegrationEnv(process.env, env);
    if (env.APP_ENV === 'staging' && integration.storage.driver !== 'r2')
      throw new Error('Remote backup storage configuration is required.');
    const backupStorage =
      env.APP_ENV === 'staging' && integration.storage.driver === 'r2'
        ? { endpoint: integration.storage.endpoint, bucket: process.env.OPS_BACKUP_BUCKET ?? '' }
        : undefined;
    return await withOperationalBackupLock(
      { payload, databaseUri: settings.databaseUri, namespace: settings.namespace, backupStorage },
      async (retentionLock) => {
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
          if (
            settings.namespace.environment === 'local' ||
            settings.namespace.environment === 'test'
          )
            return runBackup({
              ...options,
              repository: await createLocalBackupRepository({ namespace: settings.namespace }),
            });
          return runBackup({
            ...options,
            repository: stagingBackupRepository(settings, env, retentionLock),
          });
        };
        if (settings.command === 'migrate')
          return applyReviewedMigration(payload, async () => (await createVerifiedBackup()).marker);
        const result = await createVerifiedBackup();
        return {
          status: 'backed-up',
          marker: result.marker,
          durationMs: result.durationMs,
          retention: 'retention' in result ? result.retention : 'filesystem',
          removedBackupCount: result.removedBackupIds.length,
        };
      },
    );
  } finally {
    await payload.destroy();
  }
}
