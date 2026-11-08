import { describe, expect, it } from 'vitest';
import {
  planStagingCatalog,
  prepareStagingInitialization,
  readInitializationArguments,
  readStagingEditor,
} from './initialize-config.mjs';

const args = ['--database', 'portfolio_stage', '--mode', 'initialize'];
const source = () =>
  [
    'APP_ENV=staging',
    'STAGING_DATABASE_ONLY=true',
    'SITE_ORIGIN=https://eliana-staging.example.invalid',
    'DATABASE_URI=postgresql://stage_role:synthetic%40password@127.0.0.1:5432/portfolio_stage',
    'PUBLIC_SITE_ENABLED=false',
    'PUBLICATION_RETRIES_ENABLED=false',
    'PUBLICATION_RETRY_WORKER_ENABLED=false',
    'PUBLICATION_HTTP_VERIFICATION_ENABLED=false',
  ].join('\n');
const editor =
  'LOCAL_EDITOR_EMAIL=operator@example.invalid\nLOCAL_EDITOR_PASSWORD=synthetic-local-only';

it('rewrites only the database connection endpoint to the dedicated SSH forward', () => {
  const value = prepareStagingInitialization(source(), editor, args);
  const target = new URL(value.databaseUri);
  expect(target.host).toBe('127.0.0.1:55435');
  expect(target.username).toBe('stage_role');
  expect(target.password).toBe('synthetic%40password');
  expect(target.pathname).toBe('/portfolio_stage');
  expect(value.environment.APP_ENV).toBe('staging');
  expect(value.environment.PAYLOAD_DROP_DATABASE).toBe('false');
  expect(value.environment).not.toHaveProperty('LOCAL_EDITOR_PASSWORD');
  expect(value.environment).not.toHaveProperty('GHCR_READ_TOKEN');
});
it.each(
  [
    [],
    ['--database', 'portfolio_stage'],
    ['--database', 'portfolio_stage', '--mode', 'resume'],
    ['--database', 'postgres', '--mode', 'initialize'],
    ['--database', 'adfl_local', '--mode', 'initialize'],
    ['--database', 'portfolio_stage', '--database', 'portfolio_stage'],
  ].map((input) => ({ input })),
)('refuses missing, unsafe or ambiguous confirmations %j', ({ input }) =>
  expect(() => readInitializationArguments(input)).toThrow(),
);
it.each([
  ['APP_ENV=staging', 'APP_ENV=production'],
  ['STAGING_DATABASE_ONLY=true', 'STAGING_DATABASE_ONLY=false'],
  ['PUBLIC_SITE_ENABLED=false', 'PUBLIC_SITE_ENABLED=true'],
  ['PUBLICATION_RETRIES_ENABLED=false', 'PUBLICATION_RETRIES_ENABLED=true'],
  ['PUBLICATION_RETRY_WORKER_ENABLED=false', 'PUBLICATION_RETRY_WORKER_ENABLED=true'],
  ['PUBLICATION_HTTP_VERIFICATION_ENABLED=false', 'PUBLICATION_HTTP_VERIFICATION_ENABLED=true'],
  ['https://eliana-staging.example.invalid', 'http://eliana-staging.example.invalid'],
  ['@127.0.0.1:5432/', '@production.example.invalid:5432/'],
  ['/portfolio_stage', '/different_database'],
])('refuses a target outside the confirmed private staging phase: %s', (before, after) =>
  expect(() =>
    prepareStagingInitialization(source().replace(before, after), editor, args),
  ).toThrow(),
);
it('accepts the generated disabled-telemetry setting and rejects changing its static value', () => {
  expect(
    prepareStagingInitialization(source() + '\nNEXT_TELEMETRY_DISABLED=1', editor, args).environment
      .NEXT_TELEMETRY_DISABLED,
  ).toBe('1');
  expect(() =>
    prepareStagingInitialization(source() + '\nNEXT_TELEMETRY_DISABLED=0', editor, args),
  ).toThrow();
});
it('does not import unrelated .env values or expose private inputs in errors', () => {
  const secret = 'synthetic-never-echo-credential';
  const result = prepareStagingInitialization(
    source(),
    editor + '\nGHCR_READ_TOKEN=' + secret + '\nDATABASE_URI=postgres://foreign/foreign',
    args,
  );
  expect(result.environment).not.toHaveProperty('GHCR_READ_TOKEN');
  try {
    prepareStagingInitialization(source() + '\nGHCR_READ_TOKEN=' + secret, editor, args);
    throw new Error('Expected rejection');
  } catch (error) {
    expect(String(error)).not.toContain(secret);
  }
});
it('chooses an explicit staging credential pair without mixing it with local credentials', () => {
  expect(
    readStagingEditor({
      LOCAL_EDITOR_EMAIL: 'local@example.invalid',
      LOCAL_EDITOR_PASSWORD: 'local',
      STAGING_EDITOR_EMAIL: 'Stage@Example.invalid',
      STAGING_EDITOR_PASSWORD: 'stage',
    }),
  ).toEqual({ email: 'stage@example.invalid', password: 'stage' });
  expect(() =>
    readStagingEditor({
      LOCAL_EDITOR_EMAIL: 'local@example.invalid',
      LOCAL_EDITOR_PASSWORD: 'local',
      STAGING_EDITOR_EMAIL: 'stage@example.invalid',
    }),
  ).toThrow();
});
describe('catalog planning', () => {
  const expected = ['first', 'second'];
  const objects = [
    { schema: 'public', name: 'users', kind: 'table' },
    { schema: 'public', name: 'payload_migrations', kind: 'table' },
  ];
  const history = [
    { name: 'second', batch: 1 },
    { name: 'first', batch: 1 },
  ];
  const plan = (selected: unknown[], migrations: unknown) =>
    planStagingCatalog(
      { objects: selected, migrations },
      expected,
      ['users', 'payload_migrations'],
      [],
    );
  it('accepts canonical integer batch text returned by PostgreSQL numeric columns', () => {
    expect(
      plan(objects, [
        { name: 'first', batch: '1' },
        { name: 'second', batch: '1' },
      ]),
    ).toBe('current');
  });
  it.each(['1.5', '1e0', '0', '-1', '9007199254740992'])(
    'refuses noncanonical or unsafe PostgreSQL migration batches %s',
    (batch) =>
      expect(() =>
        plan(objects, [
          { name: 'first', batch },
          { name: 'second', batch: '1' },
        ]),
      ).toThrow(),
  );
  it('accepts an entirely empty target or the exact complete Native migration catalog', () => {
    expect(plan([], null)).toBe('empty');
    expect(plan(objects, history)).toBe('current');
  });
  it.each(
    [
      [],
      [{ name: 'first', batch: 1 }],
      [
        { name: 'first', batch: 1 },
        { name: 'first', batch: 1 },
      ],
      [
        { name: 'first', batch: 1 },
        { name: 'foreign', batch: 1 },
      ],
      [
        { name: 'first', batch: 0 },
        { name: 'second', batch: 1 },
      ],
    ].map((migrations) => ({ migrations })),
  )('refuses partial, duplicate or foreign migration history %j', ({ migrations }) =>
    expect(() => plan(objects, migrations)).toThrow(),
  );
  it.each([
    { schema: 'public', name: 'foreign', kind: 'table' },
    { schema: 'other', name: 'users', kind: 'table' },
    { schema: 'public', name: 'foreign', kind: 'function' },
  ])('refuses foreign objects before writes %j', (object) =>
    expect(() => plan([...objects, object], history)).toThrow(),
  );
});
