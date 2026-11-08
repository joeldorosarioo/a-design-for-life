import { readServerEnv } from '../../src/config/server-env';

export function configureTestEnvironment() {
  const env = readServerEnv({
    NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: 'synthetic-local-test-secret-for-isolated-payload-only',
    DATABASE_URI:
      process.env.TEST_DATABASE_URI ??
      'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55433/adfl_test_base',
    SITE_ORIGIN: process.env.TEST_SITE_ORIGIN ?? 'http://127.0.0.1:3100',
    MEDIA_BUCKET: process.env.TEST_MEDIA_BUCKET ?? 'adfl-test-files',
  });
  Object.assign(process.env, env);
  return env;
}
