import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readServerEnv } from '../../src/config/server-env';

export const isolatedTestDatabaseUri =
  'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner';
export const isolatedTestBucket = 'adfl-test-runner';

export function assertIsolatedTestEnvironment(input: NodeJS.ProcessEnv) {
  if (
    input.APP_ENV !== 'test' ||
    input.DATABASE_URI !== isolatedTestDatabaseUri ||
    input.MEDIA_BUCKET !== isolatedTestBucket ||
    input.MEDIA_STORAGE_ROOT !==
      path.resolve('.work/private-media', isolatedTestBucket, 'adfl_test_runner') ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      input.ADFL_TEST_RUN_ID ?? '',
    )
  )
    throw new Error('Exact isolated test runtime namespace required.');
  assertUnlinkedWorkspacePath(input.MEDIA_STORAGE_ROOT!);
}

export function configureTestEnvironment() {
  if (
    (process.env.TEST_DATABASE_URI && process.env.TEST_DATABASE_URI !== isolatedTestDatabaseUri) ||
    (process.env.TEST_MEDIA_BUCKET && process.env.TEST_MEDIA_BUCKET !== isolatedTestBucket)
  )
    throw new Error('Inherited override does not match the isolated test namespace.');
  const runId = process.env.ADFL_TEST_RUN_ID ?? randomUUID();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId))
    throw new Error('Invalid isolated test run identity.');
  const siteOrigin = process.env.TEST_SITE_ORIGIN ?? 'http://127.0.0.1:3101';
  const internalOrigin = new URL(siteOrigin);
  if (internalOrigin.hostname === 'localhost') internalOrigin.hostname = '127.0.0.1';
  const env = readServerEnv({
    NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    APP_ENV: 'test',
    // The owned migration lifecycle applies this additive schema before fixtures run.
    PUBLICATION_RETRIES_ENABLED: 'true',
    PUBLICATION_RETRY_WORKER_ENABLED: 'false',
    PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
    PAYLOAD_SECRET: 'synthetic-local-test-secret-for-isolated-payload-only',
    DATABASE_URI: isolatedTestDatabaseUri,
    SITE_ORIGIN: siteOrigin,
    INTERNAL_HTTP_ORIGIN: internalOrigin.origin,
    MEDIA_BUCKET: isolatedTestBucket,
    MEDIA_STORAGE_ROOT: path.resolve('.work/private-media', isolatedTestBucket, 'adfl_test_runner'),
    MEDIA_CHECKER_BINARY: process.env.MEDIA_CHECKER_BINARY,
  });
  // Tests never inherit future external storage, e-mail or analytics integrations.
  for (const key of Object.keys(process.env))
    if (
      key !== 'MEDIA_CHECKER_BINARY' &&
      /^(?:MEDIA_|R2_|CLOUDFLARE_|AWS_|S3_|OBJECT_STORAGE_|SMTP_|MAIL_|EMAIL_|RESEND_|POSTMARK_|SENDGRID_|ANALYTICS_|GA_|GA4_|PUBLIC_SITE_ENABLED$|GOOGLE_ANALYTICS_|NEXT_PUBLIC_(?:GA_|ANALYTICS_|GOOGLE_ANALYTICS_))/i.test(
        key,
      )
    )
      delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  Object.assign(process.env, {
    ADFL_TEST_RUN_ID: runId,
    NEXT_TEST_DIST_DIR: `.work/next-tests/${runId}`,
  });
  assertIsolatedTestEnvironment(process.env);
  return env;
}
