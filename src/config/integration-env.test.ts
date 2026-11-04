import { expect, it } from 'vitest';
import { validServerEnv } from '../../testing/fixtures/content';
import { readIntegrationEnv } from './integration-env';

const remote = {
  R2_ENDPOINT: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'synthetic-r2-access-key',
  R2_SECRET_ACCESS_KEY: 'synthetic-r2-secret-key',
  RESEND_API_KEY: 're_synthetic_for_configuration_only',
  EDITORIAL_EMAIL_FROM_ADDRESS: 'a-design-for-life@mail.joeldorosarioo.dev',
  EDITORIAL_EMAIL_FROM_NAME: 'A Design for Life',
};
function deployed(environment: 'staging' | 'production') {
  return validServerEnv({
    NODE_ENV: 'production',
    APP_ENV: environment,
    MEDIA_BUCKET: 'synthetic-private-media',
  });
}
// A deployed application must never silently fall back to ephemeral local storage/capture.
it.each(['staging', 'production'] as const)(
  'selects isolated remote integration settings for %s at runtime',
  (environment) => {
    expect(readIntegrationEnv(remote, deployed(environment))).toEqual({
      storage: {
        driver: 'r2',
        bucket: 'synthetic-private-media',
        endpoint: remote.R2_ENDPOINT,
        accessKeyId: 'synthetic-r2-access-key',
        secretAccessKey: 'synthetic-r2-secret-key',
      },
      resend: {
        apiKey: 're_synthetic_for_configuration_only',
        fromAddress: 'a-design-for-life@mail.joeldorosarioo.dev',
        fromName: 'A Design for Life',
      },
    });
  },
);
it.each(['staging', 'production'] as const)(
  'refuses incomplete remote configuration for %s before startup',
  (environment) => {
    expect(() => readIntegrationEnv({}, deployed(environment))).toThrow(
      /integration configuration/i,
    );
    expect(() =>
      readIntegrationEnv({ ...remote, MEDIA_STORAGE_DRIVER: 'local' }, deployed(environment)),
    ).toThrow(/integration configuration/i);
  },
);
it.each([
  'http://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com.evil.invalid',
  'https://user:password@0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/path',
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com?key=secret',
])('rejects an endpoint that would expose storage credentials: %s', (endpoint) => {
  expect(() =>
    readIntegrationEnv({ ...remote, R2_ENDPOINT: endpoint }, deployed('staging')),
  ).toThrow(/integration configuration/i);
});
it.each(['eu', 'us', 'fedramp'])(
  'accepts the official %s jurisdiction endpoint',
  (jurisdiction) => {
    const endpoint =
      'https://0123456789abcdef0123456789abcdef.' + jurisdiction + '.r2.cloudflarestorage.com';
    expect(
      readIntegrationEnv({ ...remote, R2_ENDPOINT: endpoint }, deployed('staging')).storage,
    ).toMatchObject({ driver: 'r2', endpoint });
  },
);
it.each([
  { EDITORIAL_EMAIL_FROM_ADDRESS: 'editor@outside.example.invalid' },
  { EDITORIAL_EMAIL_FROM_NAME: 'Unsafe\r\nBcc: other@example.invalid' },
  { RESEND_API_KEY: '' },
  { R2_SECRET_ACCESS_KEY: '' },
  { MEDIA_STORAGE_DRIVER: 'unknown' },
])('rejects invalid project integration settings without echoing secrets: %j', (override) => {
  expect(() => readIntegrationEnv({ ...remote, ...override }, deployed('production'))).toThrow(
    /integration configuration/i,
  );
});
it('keeps captured email and local bytes in tests even if remote keys are inherited', () => {
  expect(readIntegrationEnv(remote, validServerEnv())).toEqual({ storage: { driver: 'local' } });
});
it('refuses a deliberate live storage driver in the test environment', () => {
  expect(() =>
    readIntegrationEnv({ ...remote, MEDIA_STORAGE_DRIVER: 'r2' }, validServerEnv()),
  ).toThrow(/integration configuration/i);
});
it('lets local development select R2 explicitly while preserving captured email', () => {
  const result = readIntegrationEnv(
    { ...remote, MEDIA_STORAGE_DRIVER: 'r2' },
    validServerEnv({ NODE_ENV: 'development', APP_ENV: 'local' }),
  );
  expect(result.storage).toMatchObject({ driver: 'r2' });
  expect(result.resend).toBeUndefined();
});
