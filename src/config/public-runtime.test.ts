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
