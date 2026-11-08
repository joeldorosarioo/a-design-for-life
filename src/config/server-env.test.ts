import { describe, expect, it } from 'vitest';
import { readServerEnv } from './server-env';

const validInput = {
  PAYLOAD_SECRET: 'synthetic-test-secret-at-least-thirty-two-characters',
  DATABASE_URI: 'postgres://adfl:local@127.0.0.1:55433/adfl_test_base',
  NODE_ENV: 'test',
  APP_ENV: 'test',
  SITE_ORIGIN: 'http://127.0.0.1:3000',
  MEDIA_BUCKET: 'adfl-test-files',
} satisfies NodeJS.ProcessEnv;

describe('readServerEnv', () => {
  // Removing secret validation would permit an unsafe CMS startup.
  it('recusa iniciar sem segredo do Payload', () => {
    expect(() =>
      readServerEnv({
        NODE_ENV: 'test',
        DATABASE_URI: 'postgres://portfolio_test:local@localhost:5432/portfolio_test',
      }),
    ).toThrow(/PAYLOAD_SECRET/);
  });

  // A malformed/missing connection would otherwise reach the database adapter.
  it.each([undefined, '', 'https://database.example.com/adfl'])(
    'recusa conexão que não é PostgreSQL: %s',
    (database) => {
      expect(() => readServerEnv({ ...validInput, DATABASE_URI: database })).toThrow(
        /DATABASE_URI/,
      );
    },
  );

  it('entrega configuração tipada ao adaptador e descarta variáveis estranhas', () => {
    expect(readServerEnv({ ...validInput, UNRELATED: 'ignored' })).toEqual(validInput);
  });
});

describe('isolamento do ambiente de testes', () => {
  // Weakening these checks could run fixtures/cleanup against non-test resources.
  it.each([
    [{ APP_ENV: 'production' }, /APP_ENV/],
    [{ DATABASE_URI: 'postgres://test:local@db.example.com/adfl_test_base' }, /DATABASE_URI/],
    [{ DATABASE_URI: 'postgres://test:local@127.0.0.1:55433/adfl_production' }, /DATABASE_URI/],
    [{ MEDIA_BUCKET: 'adfl-production-media' }, /MEDIA_BUCKET/],
    [{ SITE_ORIGIN: 'https://production.example.com' }, /SITE_ORIGIN/],
    [{ SITE_ORIGIN: 'https://127.0.0.1:3100' }, /SITE_ORIGIN/],
  ])('recusa recurso de teste não isolado: %j', (override, field) => {
    expect(() => readServerEnv({ ...validInput, ...override })).toThrow(field);
  });

  it.each([
    'ftp://files.example.com',
    'https://site.example.com/path',
    'https://user:pass@site.example.com',
  ])('recusa origem não HTTP(S) ou com dados extras: %s', (origin) => {
    expect(() => readServerEnv({ ...validInput, SITE_ORIGIN: origin })).toThrow(/SITE_ORIGIN/);
  });
});
it('protege recursos no build de produção local usado pelo Playwright', () => {
  expect(() =>
    readServerEnv({
      ...validInput,
      NODE_ENV: 'production',
      DATABASE_URI: 'postgres://test:local@127.0.0.1:55433/adfl_production',
    }),
  ).toThrow(/DATABASE_URI/);
  expect(readServerEnv({ ...validInput, NODE_ENV: 'production' }).APP_ENV).toBe('test');
});
