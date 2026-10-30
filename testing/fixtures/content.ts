import { readServerEnv, type ServerEnv } from '../../src/config/server-env';

export function validServerEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): ServerEnv {
  return readServerEnv({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: 'synthetic-private-payload-secret-for-tests-only',
    DATABASE_URI: 'postgres://synthetic:local-only@127.0.0.1:55433/adfl_test_fixture',
    SITE_ORIGIN: 'http://127.0.0.1:3100',
    MEDIA_BUCKET: 'adfl-test-fixture',
    ...overrides,
  });
}
