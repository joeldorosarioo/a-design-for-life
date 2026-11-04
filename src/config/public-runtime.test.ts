import { expect, it } from 'vitest';
import { validServerEnv } from '../../testing/fixtures/content';
import { readPublicRuntime } from './public-runtime';

// Returning the environment would serialize a CMS credential into a browser DTO.
it('não entrega o segredo do CMS ao navegador', () => {
  const config = readPublicRuntime(
    validServerEnv({
      PAYLOAD_SECRET: 'synthetic-private-secret-never-for-public-runtime',
    }),
  );
  expect(JSON.stringify(config)).not.toContain('synthetic-private-secret-never-for-public-runtime');
});
it.each(['local', 'test', 'staging', 'production'] as const)(
  'seleciona somente configuração pública em %s',
  (environment) => {
    const config = readPublicRuntime(
      validServerEnv({
        NODE_ENV: environment === 'test' ? 'test' : 'production',
        APP_ENV: environment,
      }),
    );
    expect(config).toEqual({
      siteOrigin: 'http://127.0.0.1:3100',
      environment,
      analytics: null,
    });
  },
);

// Public release is an explicit operational gate; credentials or production mode alone cannot enable measurement.
it('provides only approved public analytics configuration after explicit public production release', () => {
  const runtime = readPublicRuntime(
    validServerEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      SITE_ORIGIN: 'https://portfolio.example.invalid',
      PUBLIC_SITE_ENABLED: 'true',
      GA4_MEASUREMENT_ID: 'G-SYNTHETIC123',
      RESEND_API_KEY: 'synthetic-private-resend-key',
      R2_SECRET_ACCESS_KEY: 'synthetic-private-storage-key',
    }),
  );
  expect(runtime).toEqual({
    siteOrigin: 'https://portfolio.example.invalid',
    environment: 'production',
    analytics: { measurementId: 'G-SYNTHETIC123', publicSiteEnabled: true },
  });
  expect(JSON.stringify(runtime)).not.toContain('synthetic-private-');
});
it.each(['local', 'test', 'staging'] as const)(
  'keeps analytics absent in %s even when release and ID are inherited',
  (environment) => {
    const runtime = readPublicRuntime(
      validServerEnv({
        NODE_ENV: environment === 'test' ? 'test' : 'production',
        APP_ENV: environment,
        PUBLIC_SITE_ENABLED: 'true',
        GA4_MEASUREMENT_ID: 'G-SYNTHETIC123',
      }),
    );
    expect(runtime.analytics).toBeNull();
  },
);
it.each([undefined, 'false'])(
  'keeps a private production candidate unmeasured with release=%s',
  (release) => {
    const runtime = readPublicRuntime(
      validServerEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        SITE_ORIGIN: 'https://portfolio.example.invalid',
        PUBLIC_SITE_ENABLED: release,
        GA4_MEASUREMENT_ID: 'G-SYNTHETIC123',
      }),
    );
    expect(runtime.analytics).toBeNull();
  },
);
it('refuses public release with an absent measurement ID or insecure origin', () => {
  expect(() =>
    validServerEnv({ NODE_ENV: 'production', APP_ENV: 'production', PUBLIC_SITE_ENABLED: 'true' }),
  ).toThrow(/GA4_MEASUREMENT_ID/);
  expect(() =>
    validServerEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      PUBLIC_SITE_ENABLED: 'true',
      GA4_MEASUREMENT_ID: 'G-SYNTHETIC123',
      SITE_ORIGIN: 'http://portfolio.example.invalid',
    }),
  ).toThrow(/SITE_ORIGIN/);
});
