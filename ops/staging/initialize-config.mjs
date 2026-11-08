import { parse } from 'dotenv';
import { z } from 'zod';

const databaseName = /^[a-z_][a-z0-9_]{0,62}$/i;
const credentialSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});
const runtimeKeys = new Set([
  'NODE_ENV',
  'NEXT_TELEMETRY_DISABLED',
  'APP_ENV',
  'SITE_ORIGIN',
  'INTERNAL_HTTP_ORIGIN',
  'DATABASE_URI',
  'PAYLOAD_SECRET',
  'MEDIA_BUCKET',
  'MEDIA_STORAGE_DRIVER',
  'MEDIA_STORAGE_ROOT',
  'MEDIA_CHECKER_BINARY',
  'R2_ENDPOINT',
  'R2_BUCKET',
  'R2_MEDIA_PREFIX',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'RESEND_API_KEY',
  'EDITORIAL_EMAIL_FROM_ADDRESS',
  'EDITORIAL_EMAIL_FROM_NAME',
  'PUBLIC_SITE_ENABLED',
  'PUBLICATION_RETRIES_ENABLED',
  'PUBLICATION_RETRY_WORKER_ENABLED',
  'PUBLICATION_HTTP_VERIFICATION_ENABLED',
  'STAGING_DATABASE_ONLY',
  'PGDATA',
  'PORT',
  'HOSTNAME',
]);
const offFlags = [
  'PUBLIC_SITE_ENABLED',
  'PUBLICATION_RETRIES_ENABLED',
  'PUBLICATION_RETRY_WORKER_ENABLED',
  'PUBLICATION_HTTP_VERIFICATION_ENABLED',
];
const invalid = () =>
  new Error(
    'Staging initialization requires explicit private staging settings, a confirmed database and an initialization mode.',
  );

export function readInitializationArguments(args) {
  if (!Array.isArray(args) || args.length !== 4) throw invalid();
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index],
      value = args[index + 1];
    if (!['--database', '--mode'].includes(key) || values.has(key) || typeof value !== 'string')
      throw invalid();
    values.set(key, value);
  }
  const database = values.get('--database');
  const mode = values.get('--mode');
  if (
    !databaseName.test(database ?? '') ||
    ['postgres', 'template0', 'template1', 'adfl_local'].includes(database.toLowerCase()) ||
    !['initialize', 'verify'].includes(mode)
  )
    throw invalid();
  return { database, mode };
}

export function readStagingEditor(input) {
  const explicit =
    input.STAGING_EDITOR_EMAIL !== undefined || input.STAGING_EDITOR_PASSWORD !== undefined;
  const value = credentialSchema.safeParse({
    email: explicit ? input.STAGING_EDITOR_EMAIL : input.LOCAL_EDITOR_EMAIL,
    password: explicit ? input.STAGING_EDITOR_PASSWORD : input.LOCAL_EDITOR_PASSWORD,
  });
  if (!value.success)
    throw new Error('Private staging editorial credentials are incomplete or invalid.');
  return value.data;
}

export function prepareStagingInitialization(importText, editorialText, args) {
  const selection = readInitializationArguments(args);
  const runtime = parse(importText);
  if (
    Object.keys(runtime).some((key) => !runtimeKeys.has(key)) ||
    runtime.APP_ENV !== 'staging' ||
    (runtime.NODE_ENV !== undefined && runtime.NODE_ENV !== 'production') ||
    (runtime.NEXT_TELEMETRY_DISABLED !== undefined && runtime.NEXT_TELEMETRY_DISABLED !== '1') ||
    runtime.STAGING_DATABASE_ONLY !== 'true' ||
    offFlags.some((key) => runtime[key] !== 'false')
  )
    throw invalid();
  let origin, database;
  try {
    origin = new URL(runtime.SITE_ORIGIN);
    database = new URL(runtime.DATABASE_URI);
  } catch {
    throw invalid();
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.hostname === 'localhost' ||
    origin.hostname === '127.0.0.1' ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1'].includes(database.hostname) ||
    (database.port && database.port !== '5432') ||
    database.search ||
    database.hash ||
    !databaseName.test(decodeURIComponent(database.username)) ||
    !database.password ||
    decodeURIComponent(database.pathname.slice(1)) !== selection.database
  )
    throw invalid();
  const editor = readStagingEditor(parse(editorialText));
  const runtimeDatabaseUri = database.href;
  database.hostname = '127.0.0.1';
  database.port = '55435';
  return {
    ...selection,
    origin: origin.origin,
    role: decodeURIComponent(database.username),
    databaseUri: database.href,
    runtimeDatabaseUri,
    editor,
    environment: /** @type {Record<string, string>} */ ({
      ...runtime,
      NODE_ENV: 'production',
      DATABASE_URI: database.href,
      SITE_ORIGIN: origin.origin,
      PAYLOAD_DROP_DATABASE: 'false',
      PAYLOAD_MIGRATING: 'true',
    }),
  };
}

export function planStagingCatalog(
  { objects, migrations: history },
  expectedNames,
  expectedTables,
  expectedEnums,
) {
  if (!Array.isArray(objects) || !Array.isArray(expectedNames) || !expectedNames.length)
    throw invalid();
  if (objects.length === 0 && history === null) return 'empty';
  const tables = new Set(expectedTables);
  const enums = new Set(expectedEnums);
  if (
    !Array.isArray(history) ||
    history.length !== expectedNames.length ||
    objects.some(
      ({ schema, name, kind }) =>
        schema !== 'public' ||
        !(
          (kind === 'table' && tables.has(name)) ||
          (kind === 'sequence' && name.endsWith('_id_seq') && tables.has(name.slice(0, -7))) ||
          (kind === 'enum' && enums.has(name))
        ),
    )
  )
    throw new Error(
      'The staging catalog is foreign or incomplete; no automatic recovery is permitted.',
    );
  const actualTables = objects.filter(({ kind }) => kind === 'table').map(({ name }) => name);
  if (
    actualTables.length !== tables.size ||
    actualTables.some((name) => !tables.has(name)) ||
    new Set(history.map(({ name }) => name)).size !== expectedNames.length ||
    history.some(({ name, batch }) => {
      // PostgreSQL numeric values arrive as text through the low-level driver.
      const numeric =
        typeof batch === 'string' && /^[1-9][0-9]*$/.test(batch) ? Number(batch) : batch;
      return !expectedNames.includes(name) || !Number.isSafeInteger(numeric) || numeric < 1;
    })
  )
    throw new Error(
      'The staging catalog is foreign or incomplete; no automatic recovery is permitted.',
    );
  return 'current';
}
