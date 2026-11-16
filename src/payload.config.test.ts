import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('PAYLOAD_SECRET', 'synthetic-admin-avatar-configuration-test-only');
  vi.stubEnv(
    'DATABASE_URI',
    'postgres://synthetic:synthetic@127.0.0.1:5432/a_design_for_life_rebuild',
  );
  vi.stubEnv('SITE_ORIGIN', 'http://127.0.0.1:9');
  vi.stubEnv('MEDIA_BUCKET', 'adfl-test-admin-avatar');
  vi.stubEnv('MEDIA_STORAGE_DRIVER', 'local');
  vi.stubEnv('MEDIA_STORAGE_ROOT', undefined);
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
    '8170cd08af2c0b5aba05f4cc6879839c25ae803ff0cc20f5f58904fe02bd106e',
  ],
  [
    'http://localhost:80',
    'http://localhost',
    'f896bbefabef0a6e5930635c53682f8191f248e60ab8b7d8560716b2da9a93ab',
  ],
  [
    'http://LOCALHOST:9',
    'http://localhost:9',
    '05c8b47b0efaab594e5d08e9d839c693e408ec7436256061bdfc727e3f2e6c58',
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
