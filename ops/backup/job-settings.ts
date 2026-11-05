import { BlockList, isIP } from 'node:net';
import { z } from 'zod';
import {
  backupApplicationSchema,
  backupImageIdentitySchema,
  backupNamespaceSchema,
} from './contracts';
import { postgresDumpConnection } from './postgres-dump';

const stagedMigration = z.literal('true');
const runId = z.uuid().regex(/^[a-f0-9-]+$/);
const sourceRevision = /^[a-f0-9]{40}$/;
const sourceSha256 = /^[a-f0-9]{64}$/;

const localAddresses = new BlockList();
localAddresses.addSubnet('127.0.0.0', 8);
localAddresses.addAddress('0.0.0.0');
localAddresses.addAddress('::1', 'ipv6');
localAddresses.addAddress('::', 'ipv6');

function stagingDatabaseHost(host: string): boolean {
  if (/^localhost\.?$/i.test(host)) return false;
  const family = isIP(host);
  return family
    ? !localAddresses.check(host, family === 6 ? 'ipv6' : 'ipv4')
    : /^[a-z][a-z0-9.-]*$/i.test(host);
}

export function selectBackupJob(env: Partial<NodeJS.ProcessEnv>, args: readonly string[]) {
  const invalid = () => new Error('Invalid operational backup job configuration.');
  const [command] = args;
  const environment = env.APP_ENV;
  if (
    args.length !== 1 ||
    (command !== 'backup' && command !== 'migrate') ||
    (environment !== 'local' && environment !== 'test' && environment !== 'staging') ||
    !env.DATABASE_URI ||
    !/^age1[0-9a-z]{58}$/.test(env.OPS_BACKUP_RECIPIENT ?? '') ||
    [
      env.PAYLOAD_DROP_DATABASE,
      env.PUBLIC_SITE_ENABLED,
      env.PUBLICATION_RETRIES_ENABLED,
      env.PUBLICATION_RETRY_WORKER_ENABLED,
      env.PUBLICATION_HTTP_VERIFICATION_ENABLED,
    ].some((value) => value !== undefined && value !== 'false')
  )
    throw invalid();

  const databaseUri = env.DATABASE_URI;
  let connection: ReturnType<typeof postgresDumpConnection>;
  try {
    connection = postgresDumpConnection(databaseUri);
  } catch {
    throw invalid();
  }

  const revision = env.OPS_SOURCE_REVISION ?? '';
  const fingerprint = env.OPS_SOURCE_SHA256 || undefined;
  const applicationImage =
    environment === 'local'
      ? backupImageIdentitySchema.safeParse({
          imageId: env.OPS_APPLICATION_IMAGE_ID,
          revision: env.OPS_APPLICATION_REVISION,
        })
      : undefined;
  if (environment === 'local') {
    if (!applicationImage?.success) throw invalid();
  } else if (
    !(sourceRevision.test(revision) && fingerprint === undefined) &&
    !(
      environment === 'test' &&
      revision === 'draft-uncommitted' &&
      sourceSha256.test(fingerprint ?? '')
    )
  )
    throw invalid();

  let source = env.OPS_BACKUP_SOURCE;
  if (environment === 'test') {
    const ownership = runId.safeParse(env.OPS_TEST_RUN_ID);
    if (
      !ownership.success ||
      connection.PGHOST !== '127.0.0.1' ||
      connection.PGPORT !== '25434' ||
      connection.PGDATABASE !== 'adfl_test_ops_' + ownership.data.replaceAll('-', '') ||
      connection.PGUSER !== 'adfl_test'
    )
      throw invalid();
    source = 'ops-' + ownership.data;
  } else if (environment === 'local') {
    if (
      command !== 'backup' ||
      !['127.0.0.1', 'localhost', '::1'].includes(connection.PGHOST) ||
      env.OPS_LOCAL_DATABASE_TARGET !==
        new URL(databaseUri).hostname + ':' + connection.PGPORT + '/' + connection.PGDATABASE
    )
      throw invalid();
  } else if (
    !stagingDatabaseHost(connection.PGHOST) ||
    env.OPS_STAGING_DATABASE_TARGET !==
      new URL(databaseUri).hostname + ':' + connection.PGPORT + '/' + connection.PGDATABASE ||
    (command === 'migrate' && !stagedMigration.safeParse(env.OPS_ALLOW_REVIEWED_MIGRATION).success)
  )
    throw invalid();

  const namespace = backupNamespaceSchema.safeParse({
    project: 'a-design-for-life',
    environment,
    source,
  });
  if (!namespace.success) throw invalid();

  return {
    command,
    databaseUri,
    namespace: namespace.data,
    recipient: env.OPS_BACKUP_RECIPIENT!,
    application: (schemaSha256: string) =>
      backupApplicationSchema.parse(
        applicationImage?.success
          ? {
              ...applicationImage.data,
              schemaSha256,
            }
          : {
              revision,
              ...(fingerprint === undefined ? {} : { sourceSha256: fingerprint }),
              schemaSha256,
            },
      ),
  };
}
