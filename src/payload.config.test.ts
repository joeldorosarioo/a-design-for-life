import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetModules();
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
});

// These tests include a cold import of the full Payload application configuration.
it(
  'uses the native account icon and Portuguese admin with English available',
  { timeout: 30_000 },
  async () => {
    const config = await (await import('./payload.config')).default;
    expect(config.admin.avatar).toBe('default');
    expect(config.i18n.fallbackLanguage).toBe('pt');
    expect(Object.keys(config.i18n.supportedLanguages).sort()).toEqual(['en', 'pt']);
  },
);

it.each([
  [
    'http://127.0.0.1:9/',
    'http://127.0.0.1:9',
    'a5fb04ac7dc7dc990eaa008ca73fb56af5de98b8b8af8b46887c1b21c66d54a8',
  ],
  [
    'http://localhost:80',
    'http://localhost',
    '159086d2944c22eb586dff2abf4525bf2f0ca843bfd3699b927e2049ddb200d7',
  ],
  [
    'http://LOCALHOST:9',
    'http://localhost:9',
    'a16b73db6338bd695810eec028ad05c08fa2b15eaff42d353d6e6c93794546c0',
  ],
])(
  'matches browser origins for %s without moving the existing publication directory',
  { timeout: 30_000 },
  async (configured, origin, namespace) => {
    vi.stubEnv('SITE_ORIGIN', configured);
    const config = await (await import('./payload.config')).default;
    const { runtimePublication } = await import('./helpers/payload/publication-runtime');
    expect(config.serverURL).toBe(origin);
    expect(config.cors).toEqual([origin]);
    expect(new Set(config.csrf)).toEqual(new Set([origin]));
    expect(runtimePublication().directory).toBe(path.resolve('.work/publication', namespace));
  },
);
