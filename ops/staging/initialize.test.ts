import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mergeInitializationReceipt, validInitializationReceipt } from './initialize.cli.mjs';
import { stagingSeedSettings } from './seed-http.mjs';
import { initializeStaging } from './initialize';
import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import {
  planStagingCatalog,
  loadStagingInitialization,
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

it.each([
  {
    args: ['--input-type=module', '--eval', "await import('./ops/staging/initialize.ts')"],
    status: 0,
    stderr: '',
  },
  {
    args: ['ops/staging/initialize.ts'],
    status: 1,
    stderr: 'Staging initialization refused or incomplete.\n',
  },
])(
  'keeps imports passive and rejects unconfigured execution: $args',
  ({ args, status, stderr }) => {
    const result = spawnSync(
      process.execPath,
      ['--conditions=react-server', '--import', 'tsx', ...args],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15_000,
        env: { ...process.env, APP_ENV: 'invalid' },
      },
    );
    expect(result.status).toBe(status);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(stderr);
  },
  20_000,
);

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
    ['--database', 'template0', '--mode', 'initialize'],
    ['--database', 'portfolio_stage', '--database', 'portfolio_stage'],
  ].map((input) => ({ input })),
)('refuses missing, unsafe or ambiguous confirmations %j', ({ input }) =>
  expect(() => readInitializationArguments(input)).toThrow(),
);
it.each(['adfl_local', 'a_design_for_life_rebuild'])(
  'accepts the explicitly configured staging database name: %s',
  (database) => {
    const selected = prepareStagingInitialization(
      source().replaceAll('portfolio_stage', database),
      editor,
      ['--database', database, '--mode', 'initialize'],
    );
    expect(selected.database).toBe(database);
    expect(new URL(selected.databaseUri).host).toBe('127.0.0.1:55435');
  },
);
it.each(['adfl_local', 'a_design_for_life_rebuild'])(
  'validates the staging tunnel and adapter independently of its database name: %s',
  async (database) => {
    const databaseUri = `postgres://stage_role:synthetic@127.0.0.1:55435/${database}`;
    const Client = vi.fn(function () {
      throw new Error('Synthetic connection boundary');
    });
    const payload = {
      db: {
        name: 'postgres',
        pg: { Client },
        poolOptions: { connectionString: databaseUri },
        push: false,
        disableCreateDatabase: true,
        extensions: {},
      },
    } as unknown as Payload;
    const options = {
      databaseUri,
      database,
      role: 'stage_role',
      origin: 'https://staging.example.invalid',
      mode: 'prepare-first-access' as const,
    };
    await expect(initializeStaging(payload, options)).rejects.toThrow(
      'Synthetic connection boundary',
    );
    expect(Client).toHaveBeenCalledOnce();
    Client.mockClear();
    const directUri = databaseUri.replace(':55435/', ':5432/');
    payload.db.poolOptions.connectionString = directUri;
    await expect(
      initializeStaging(payload, { ...options, databaseUri: directUri }),
    ).rejects.toThrow('Staging initialization refused');
    expect(Client).not.toHaveBeenCalled();
  },
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
it('prepares browser-first access without reading or forwarding editorial credentials', async () => {
  const readEditorial = vi.fn(async () => {
    throw new Error('Editorial file must not be read');
  });
  const readRuntime = vi.fn(async () => source() + '\nEDITORIAL_FIRST_ACCESS_ENABLED=true');
  const selected = await loadStagingInitialization(
    ['--database', 'portfolio_stage', '--mode', 'prepare-first-access'],
    { readRuntime, readEditorial },
  );
  expect(readRuntime).toHaveBeenCalledOnce();
  expect(readEditorial).not.toHaveBeenCalled();
  expect(selected.mode).toBe('prepare-first-access');
  expect(selected.editor).toBeUndefined();
  expect(selected.environment).not.toHaveProperty('STAGING_EDITOR_EMAIL');
  expect(selected.environment).not.toHaveProperty('STAGING_EDITOR_PASSWORD');
  expect(selected.environment.EDITORIAL_FIRST_ACCESS_ENABLED).toBe('true');
});
it('retains the credential requirement in initialize and verify modes', async () => {
  const readEditorial = vi.fn(async () => '');
  await expect(
    loadStagingInitialization(['--database', 'portfolio_stage', '--mode', 'verify'], {
      readRuntime: async () => source(),
      readEditorial,
    }),
  ).rejects.toThrow();
  expect(readEditorial).toHaveBeenCalledOnce();
  expect(() => prepareStagingInitialization(source(), '', args)).toThrow();
});
it('does not parse even supplied editorial text in browser-first mode', () => {
  expect(
    prepareStagingInitialization(source(), undefined, [
      '--database',
      'portfolio_stage',
      '--mode',
      'prepare-first-access',
    ]).editor,
  ).toBeUndefined();
  expect(
    prepareStagingInitialization(source(), 'STAGING_EDITOR_EMAIL=invalid', [
      '--database',
      'portfolio_stage',
      '--mode',
      'prepare-first-access',
    ]).editor,
  ).toBeUndefined();
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

const selected = { database: 'portfolio_stage', origin: 'https://staging.example.invalid' };
const base = {
  version: 1,
  environment: 'staging',
  ...selected,
  migrations: 17,
  migrationLedgerSha256: 'a'.repeat(64),
  completedAt: '2026-11-05T00:00:00.000Z',
};
const pending = () => ({
  ...base,
  status: 'pending-first-access',
  editorId: null,
  structuralDocuments: 0,
  structural: [],
  freshProvisioning: false,
});
const complete = () => ({
  ...base,
  status: 'initialized',
  editorId: randomUUID(),
  structuralDocuments: 4,
  structural: ['professional-profiles', 'site-navigation'].flatMap((collection) =>
    ['pt', 'en'].map((locale) => ({
      collection,
      locale,
      id: randomUUID(),
      updatedAt: '2026-11-05T00:00:00.000Z',
    })),
  ),
  freshProvisioning: true,
});

it('accepts the pending discriminant only with no editorial account or structural documents', () => {
  expect(validInitializationReceipt(pending(), selected)).toBe(true);
  for (const override of [
    { editorId: randomUUID() },
    { structuralDocuments: 1 },
    { structural: complete().structural },
    { freshProvisioning: true },
  ])
    expect(validInitializationReceipt({ ...pending(), ...override }, selected)).toBe(false);
});
it('refuses receipts from the previous migration catalog instead of merging them into a current receipt', () => {
  const current = complete();
  const outdatedPending = { ...pending(), migrations: 16 };
  const outdatedComplete = { ...current, migrations: 16 };
  expect(validInitializationReceipt(outdatedPending, selected)).toBe(false);
  expect(validInitializationReceipt(outdatedComplete, selected)).toBe(false);
  expect(() => mergeInitializationReceipt(outdatedPending, current, selected)).toThrow();
  expect(() => mergeInitializationReceipt(outdatedComplete, current, selected)).toThrow();
});
it('preserves completed receipt validation and the original structural baseline', () => {
  const original = complete();
  const next = {
    ...original,
    status: 'verified',
    freshProvisioning: false,
    structural: original.structural.map((item) => ({
      ...item,
      updatedAt: '2026-11-06T00:00:00.000Z',
    })),
  };
  expect(validInitializationReceipt(original, selected)).toBe(true);
  expect(mergeInitializationReceipt(original, next, selected)).toMatchObject({
    structural: original.structural,
    freshProvisioning: true,
  });
});
it('allows a same-target pending receipt to advance while refusing a completed-state downgrade', () => {
  const ready = complete();
  expect(mergeInitializationReceipt(pending(), ready, selected)).toEqual(ready);
  expect(() => mergeInitializationReceipt(ready, pending(), selected)).toThrow('downgraded');
});
it('does not replace another target or migration ledger while pending', () => {
  expect(() =>
    mergeInitializationReceipt(
      { ...pending(), database: 'another_database' },
      complete(),
      selected,
    ),
  ).toThrow();
  expect(() =>
    mergeInitializationReceipt(
      { ...pending(), migrationLedgerSha256: 'b'.repeat(64) },
      complete(),
      selected,
    ),
  ).toThrow();
});
it('keeps pending browser-first receipts out of the authenticated HTTP seed', () => {
  const runtime = {
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    STAGING_DATABASE_ONLY: 'false',
    PUBLIC_SITE_ENABLED: 'false',
    PUBLICATION_RETRIES_ENABLED: 'false',
    PUBLICATION_RETRY_WORKER_ENABLED: 'false',
    PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
    SITE_ORIGIN: selected.origin,
    DATABASE_URI: 'postgres://synthetic:synthetic@127.0.0.1:5432/portfolio_stage',
    MEDIA_STORAGE_DRIVER: 'r2',
    MEDIA_BUCKET: 'adfl-test-stage',
    R2_BUCKET: 'adfl-test-stage',
    R2_MEDIA_PREFIX: 'portfolio/staging-proof',
  };
  expect(() => stagingSeedSettings(runtime, {}, pending(), selected.database)).toThrow(
    'initialization-receipt-required',
  );
});
