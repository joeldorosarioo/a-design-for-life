import { expect, it } from 'vitest';
import { selectBackupJob } from './job-settings';

const id = '60aaee76-4e6f-4231-bb7e-1169e651d560';
const database = 'adfl_test_ops_' + id.replaceAll('-', '');
const local = {
  APP_ENV: 'test',
  DATABASE_URI: 'postgresql://adfl_test:synthetic@127.0.0.1:25434/' + database,
  OPS_TEST_RUN_ID: id,
  OPS_BACKUP_RECIPIENT: 'age1' + 'q'.repeat(58),
  OPS_SOURCE_REVISION: 'draft-uncommitted',
  OPS_SOURCE_SHA256: '1'.repeat(64),
};
const staging = {
  ...local,
  APP_ENV: 'staging',
  DATABASE_URI: 'postgresql://staging_ops:synthetic@staging-db:5432/adfl_staging?sslmode=require',
  OPS_BACKUP_SOURCE: 'portfolio-staging',
  OPS_STAGING_DATABASE_TARGET: 'staging-db:5432/adfl_staging',
  OPS_SOURCE_REVISION: '2'.repeat(40),
  OPS_SOURCE_SHA256: undefined,
  OPS_TEST_RUN_ID: undefined,
};

it('binds local backup to the exact disposable test database and source revision', () => {
  const job = selectBackupJob(local, ['backup']);
  expect(job).toMatchObject({
    command: 'backup',
    databaseUri: local.DATABASE_URI,
    namespace: { project: 'a-design-for-life', environment: 'test', source: 'ops-' + id },
  });
  expect(job.application('3'.repeat(64))).toEqual({
    revision: 'draft-uncommitted',
    sourceSha256: '1'.repeat(64),
    schemaSha256: '3'.repeat(64),
  });
});

it('binds the explicit staging migration to the checked database and a committed revision', () => {
  const job = selectBackupJob({ ...staging, OPS_ALLOW_REVIEWED_MIGRATION: 'true' }, ['migrate']);
  expect(job).toMatchObject({
    command: 'migrate',
    databaseUri: staging.DATABASE_URI,
    namespace: {
      project: 'a-design-for-life',
      environment: 'staging',
      source: 'portfolio-staging',
    },
  });
  expect(job.application('3'.repeat(64))).toEqual({
    revision: '2'.repeat(40),
    schemaSha256: '3'.repeat(64),
  });
});

it.each([
  [{ ...local, APP_ENV: 'production' }, ['backup']],
  [{ ...local, DATABASE_URI: local.DATABASE_URI.replace(':25434', ':55433') }, ['backup']],
  [{ ...local, DATABASE_URI: local.DATABASE_URI.replace(':25434', ':55434') }, ['backup']],
  [{ ...local, OPS_TEST_RUN_ID: id.replace('60a', '70a') }, ['backup']],
  [{ ...local, PAYLOAD_DROP_DATABASE: 'true' }, ['backup']],
  [{ ...local, PUBLIC_SITE_ENABLED: 'true' }, ['backup']],
  [{ ...local, PUBLICATION_RETRY_WORKER_ENABLED: 'true' }, ['backup']],
  [{ ...local, OPS_SOURCE_SHA256: undefined }, ['backup']],
  [
    { ...staging, DATABASE_URI: staging.DATABASE_URI.replace('/adfl_staging', '/adfl_production') },
    ['backup'],
  ],
  [
    { ...staging, OPS_SOURCE_REVISION: 'draft-uncommitted', OPS_SOURCE_SHA256: '2'.repeat(64) },
    ['backup'],
  ],
  [{ ...staging, OPS_ALLOW_REVIEWED_MIGRATION: 'false' }, ['migrate']],
  [local, ['restore']],
  [local, ['migrate', '--down']],
] as const)('rejects a protected, ambiguous or unauthorized job', (env, args) => {
  expect(() => selectBackupJob(env, args)).toThrow('Invalid operational backup job configuration.');
});

it.each(['127.0.0.1', '127.1', 'localhost', 'localhost.', '[::1]', '[::ffff:127.0.0.1]'])(
  'refuses staging on local address %s despite an exact target confirmation',
  (host) => {
    expect(() =>
      selectBackupJob(
        {
          ...staging,
          DATABASE_URI: staging.DATABASE_URI.replace('staging-db', host),
          OPS_STAGING_DATABASE_TARGET: staging.OPS_STAGING_DATABASE_TARGET.replace(
            'staging-db',
            host,
          ),
        },
        ['backup'],
      ),
    ).toThrow('Invalid operational backup job configuration.');
  },
);
