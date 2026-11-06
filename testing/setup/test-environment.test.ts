import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { configureTestEnvironment } from './test-environment';

let original: NodeJS.ProcessEnv;
beforeEach(() => {
  original = { ...process.env };
  for (const key of Object.keys(process.env))
    if (key.startsWith('TEST_') || key.startsWith('ADFL_TEST_')) delete process.env[key];
});
afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, original);
});

it('allocates the dedicated runner namespace rather than the preserved visual database', () => {
  process.env.COMPOSE_PROJECT_NAME = 'a-design-for-life-local';
  const env = configureTestEnvironment();
  expect(new URL(env.DATABASE_URI).port).toBe('55434');
  expect(new URL(env.DATABASE_URI).pathname).toBe('/adfl_test_runner');
  expect(env.MEDIA_BUCKET).toBe('adfl-test-runner');
  expect(env.MEDIA_STORAGE_ROOT).toBe(
    path.resolve('.work/private-media/adfl-test-runner/adfl_test_runner'),
  );
});

it('opts retry metadata into only the exact owned Native test namespace', () => {
  process.env.PUBLICATION_RETRIES_ENABLED = 'false';
  const env = configureTestEnvironment();
  expect(env.PUBLICATION_RETRIES_ENABLED).toBe('true');
  expect(process.env.PUBLICATION_RETRIES_ENABLED).toBe('true');
  expect(new URL(env.DATABASE_URI).port).toBe('55434');
  expect(new URL(env.DATABASE_URI).pathname).toBe('/adfl_test_runner');
});
it('keeps the ordinary owned test runtime worker off despite an inherited opt-in', () => {
  process.env.PUBLICATION_RETRY_WORKER_ENABLED = 'true';
  const env = configureTestEnvironment();
  expect(env.PUBLICATION_RETRY_WORKER_ENABLED).toBe('false');
  expect(process.env.PUBLICATION_RETRY_WORKER_ENABLED).toBe('false');
});

it.each([
  'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55433/adfl_test_base',
  'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:5432/adfl_test_runner',
  'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_other',
])('rejects an inherited database outside the exact owned runner namespace', (uri) => {
  process.env.TEST_DATABASE_URI = uri;
  expect(() => configureTestEnvironment()).toThrow(/isolated test/i);
});

it('replaces inherited storage and internal origin and clears integration credentials', () => {
  process.env.MEDIA_STORAGE_ROOT = path.resolve('public/private-leak');
  process.env.INTERNAL_HTTP_ORIGIN = 'http://127.0.0.1:9999';
  process.env.R2_ACCESS_KEY_ID = 'synthetic-inherited';
  process.env.SMTP_PASSWORD = 'synthetic-inherited';
  process.env.AWS_SESSION_TOKEN = 'synthetic-inherited';
  process.env.MEDIA_STORAGE_DRIVER = 'r2';
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'synthetic-inherited';
  process.env.GA4_MEASUREMENT_ID = 'G-SYNTHETIC123';
  process.env.PUBLIC_SITE_ENABLED = 'true';
  const env = configureTestEnvironment();
  expect(process.env.MEDIA_STORAGE_ROOT).toBe(env.MEDIA_STORAGE_ROOT);
  expect(process.env.INTERNAL_HTTP_ORIGIN).toBe(env.SITE_ORIGIN);
  expect(process.env.R2_ACCESS_KEY_ID).toBeUndefined();
  expect(process.env.SMTP_PASSWORD).toBeUndefined();
  expect(process.env.AWS_SESSION_TOKEN).toBeUndefined();
  expect(process.env.MEDIA_STORAGE_DRIVER).toBeUndefined();
  expect(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID).toBeUndefined();
  expect(process.env.GA4_MEASUREMENT_ID).toBeUndefined();
  expect(process.env.PUBLIC_SITE_ENABLED).toBeUndefined();
});

it('rejects inherited bucket mismatches before configuring the runtime', () => {
  process.env.TEST_MEDIA_BUCKET = 'adfl-test-visual';
  expect(() => configureTestEnvironment()).toThrow(/isolated test/i);
});
it('keeps an absent optional checker absent across repeated configuration and child process environment', () => {
  delete process.env.MEDIA_CHECKER_BINARY;
  configureTestEnvironment();
  expect(process.env.MEDIA_CHECKER_BINARY).toBeUndefined();
  configureTestEnvironment();
  expect(process.env.MEDIA_CHECKER_BINARY).toBeUndefined();
});
it('preserves an explicitly configured PDF checker executable', () => {
  const checker = path.resolve('.toolchain/synthetic-checker/qpdf.exe');
  process.env.MEDIA_CHECKER_BINARY = checker;
  const env = configureTestEnvironment();
  expect(env.MEDIA_CHECKER_BINARY).toBe(checker);
  expect(process.env.MEDIA_CHECKER_BINARY).toBe(checker);
});
it('normalizes a supported localhost test origin only for the literal internal HTTP transport', () => {
  process.env.TEST_SITE_ORIGIN = 'http://localhost:3101';
  const env = configureTestEnvironment();
  expect(env.SITE_ORIGIN).toBe('http://localhost:3101');
  expect(env.INTERNAL_HTTP_ORIGIN).toBe('http://127.0.0.1:3101');
  expect(process.env.INTERNAL_HTTP_ORIGIN).toBe('http://127.0.0.1:3101');
});

it('clears an inherited first-access window unless the dedicated runner opts in', () => {
  process.env.EDITORIAL_FIRST_ACCESS_ENABLED = 'true';
  const env = configureTestEnvironment();
  expect(process.env.EDITORIAL_FIRST_ACCESS_ENABLED).toBeUndefined();
  expect(env).not.toHaveProperty('EDITORIAL_FIRST_ACCESS_ENABLED');
  expect(env).not.toHaveProperty('PUBLIC_SITE_ENABLED');
});

it('opens first access only for the explicit private owned test runner and keeps it on repeated setup', () => {
  process.env.ADFL_TEST_FIRST_ACCESS_ENABLED = 'true';
  process.env.EDITORIAL_FIRST_ACCESS_ENABLED = 'false';
  process.env.PUBLIC_SITE_ENABLED = 'true';
  const env = configureTestEnvironment();
  expect(env).toMatchObject({
    APP_ENV: 'test',
    EDITORIAL_FIRST_ACCESS_ENABLED: 'true',
    PUBLIC_SITE_ENABLED: 'false',
    DATABASE_URI: 'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
    MEDIA_BUCKET: 'adfl-test-runner',
  });
  expect(process.env.EDITORIAL_FIRST_ACCESS_ENABLED).toBe('true');
  expect(process.env.PUBLIC_SITE_ENABLED).toBe('false');
  expect(configureTestEnvironment()).toEqual(env);
});

it.each(['false', 'TRUE', '1'])(
  'does not open first access for a nonliteral opt-in %s',
  (marker) => {
    process.env.ADFL_TEST_FIRST_ACCESS_ENABLED = marker;
    process.env.EDITORIAL_FIRST_ACCESS_ENABLED = 'true';
    const env = configureTestEnvironment();
    expect(process.env.EDITORIAL_FIRST_ACCESS_ENABLED).toBeUndefined();
    expect(env).not.toHaveProperty('EDITORIAL_FIRST_ACCESS_ENABLED');
    expect(env).not.toHaveProperty('PUBLIC_SITE_ENABLED');
  },
);

it('closes the first-access window again when the dedicated opt-in is removed', () => {
  process.env.ADFL_TEST_FIRST_ACCESS_ENABLED = 'true';
  configureTestEnvironment();
  delete process.env.ADFL_TEST_FIRST_ACCESS_ENABLED;
  const env = configureTestEnvironment();
  expect(process.env.EDITORIAL_FIRST_ACCESS_ENABLED).toBeUndefined();
  expect(process.env.PUBLIC_SITE_ENABLED).toBeUndefined();
  expect(env).not.toHaveProperty('EDITORIAL_FIRST_ACCESS_ENABLED');
  expect(env).not.toHaveProperty('PUBLIC_SITE_ENABLED');
});
