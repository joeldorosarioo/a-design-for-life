import { afterEach, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
afterEach(() => vi.unstubAllEnvs());

// This test includes a cold import of the full Payload application configuration.
it(
  'uses the native account icon and Portuguese admin with English available',
  { timeout: 30_000 },
  async () => {
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
    expect(config.i18n.fallbackLanguage).toBe('pt');
    expect(Object.keys(config.i18n.supportedLanguages).sort()).toEqual(['en', 'pt']);
  },
);
