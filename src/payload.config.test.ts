import { afterEach, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
afterEach(() => vi.unstubAllEnvs());

it('uses the built-in local avatar in the sanitized Payload admin configuration', async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('PAYLOAD_SECRET', 'synthetic-admin-avatar-configuration-test-only');
  vi.stubEnv('DATABASE_URI', 'postgres://synthetic:synthetic@127.0.0.1:9/adfl_test_admin_avatar');
  vi.stubEnv('SITE_ORIGIN', 'http://127.0.0.1:9');
  vi.stubEnv('MEDIA_BUCKET', 'adfl-test-admin-avatar');
  vi.stubEnv('MEDIA_STORAGE_DRIVER', 'local');
  vi.stubEnv('MEDIA_STORAGE_ROOT', undefined);
  vi.stubEnv('MEDIA_CHECKER_BINARY', undefined);
  vi.stubEnv('INTERNAL_HTTP_ORIGIN', undefined);
  vi.stubEnv('PUBLICATION_RETRIES_ENABLED', 'false');
  vi.stubEnv('PUBLICATION_RETRY_WORKER_ENABLED', 'false');
  vi.stubEnv('PUBLICATION_HTTP_VERIFICATION_ENABLED', 'false');
  vi.stubEnv('PUBLIC_SITE_ENABLED', 'false');
  vi.stubEnv('GA4_MEASUREMENT_ID', undefined);

  const config = await (await import('./payload.config')).default;
  expect(config.admin.avatar).toBe('default');
});
