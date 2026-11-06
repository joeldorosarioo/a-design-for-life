import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import {
  publicRootSchema,
  withPublicRootWriter,
  type PublicRoot,
} from '../../src/helpers/payload/public-root';
import { assertPrivateBackupWorkPath, inspectPrivateBackupFile } from './repository';

export type CloneConnection = {
  query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};
export type StagingCloneOptions = {
  sourceDatabaseUri: string;
  siteOrigin: string;
  connect: (uri: string) => Promise<CloneConnection>;
  restoreDump: (input: { databaseUri: string; dumpPath: string }) => Promise<void>;
};
export type StagingCloneContext = {
  ownerId: string;
  databaseName: string;
  databaseUri: string;
  publicationDirectory: string;
  siteOrigin: string;
  appEnvironment: 'local';
  mediaMode: 'existing-source-read-only';
};
declare const brand: unique symbol;
export type AcquiredStagingClone = { readonly [brand]: true };
type State = {
  context: StagingCloneContext;
  assertOwned: () => Promise<void>;
  connect: StagingCloneOptions['connect'];
  restoreDump: StagingCloneOptions['restoreDump'];
  restored: boolean;
};
const acquired = new WeakMap<object, State>();
const sourceName = 'a_design_for_life_rebuild';
const sourceRole = 'joeldorosarioo_local';
const serverMarker = `concat_ws('|', inet_server_addr()::text, inet_server_port()::text,
  extract(epoch FROM pg_postmaster_start_time())::text, current_setting('server_version_num')) AS server_marker`;
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function validateOptions(options: StagingCloneOptions) {
  if (!URL.canParse(options.sourceDatabaseUri) || !URL.canParse(options.siteOrigin))
    throw new Error('An explicit staging tunnel and private local site are required');
  const database = new URL(options.sourceDatabaseUri);
  const origin = new URL(options.siteOrigin);
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    database.hostname !== '127.0.0.1' ||
    database.port !== '55435' ||
    database.pathname !== '/' + sourceName ||
    decodeURIComponent(database.username) !== sourceRole ||
    !database.password ||
    database.search ||
    database.hash ||
    origin.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    !origin.port ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Only the authorized staging source and a private loopback clone are allowed');
  return { database, origin };
}
async function directoryIdentity(directory: string) {
  assertUnlinkedWorkspacePath(directory);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('Clone publication directory changed');
  return digest(JSON.stringify([await realpath(directory), info.dev, info.ino, info.birthtimeMs]));
}
async function assertAbsent(directory: string) {
  assertUnlinkedWorkspacePath(directory);
  const info = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (info) throw new Error('Clone refuses an existing publication directory');
}
export async function inspectStagingClonePermissions(options: StagingCloneOptions) {
  const { database } = validateOptions(options);
  const client = await options.connect(database.toString());
  try {
    await client.query('BEGIN READ ONLY');
    const row = (
      await client.query(`SELECT current_database() AS database, current_user AS role,
      current_setting('server_version_num')::int AS version,
      current_setting('transaction_read_only') AS readonly,
      (SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user) AS can_create, ${serverMarker}
    `)
    ).rows[0];
    if (
      row?.database !== sourceName ||
      row.role !== sourceRole ||
      row.readonly !== 'on' ||
      typeof row.version !== 'number' ||
      Math.floor(row.version / 10000) !== 17 ||
      typeof row.server_marker !== 'string' ||
      row.server_marker.length < 5
    )
      throw new Error('The existing staging server identity did not match');
    return {
      postgresqlMajor: 17,
      canCreateDatabase: row.can_create === true,
      sourceReadOnly: true,
      serverIdentitySha256: digest(row.server_marker as string),
    };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

// This creates a fresh database on the authorized staging server. It never
// restores into the source database and does not import, delete or write R2 objects.
export async function withStagingDatabaseClone<T>(
  options: StagingCloneOptions,
  operation: (clone: AcquiredStagingClone) => Promise<T>,
): Promise<T> {
  const { database, origin } = validateOptions(options);
  const permissions = await inspectStagingClonePermissions(options);
  if (!permissions.canCreateDatabase)
    throw new Error('Staging role cannot create a separate restore database');
  const ownerId = randomUUID();
  const name = 'a_design_for_life_restore_' + ownerId.replaceAll('-', '');
  const uri = new URL(database);
  uri.pathname = '/' + name;
  const context: StagingCloneContext = {
    ownerId,
    databaseName: name,
    databaseUri: uri.toString(),
    publicationDirectory: publicRootDirectory({
      APP_ENV: 'local',
      SITE_ORIGIN: origin.origin,
      DATABASE_URI: uri.toString(),
    }),
    siteOrigin: origin.origin,
    appEnvironment: 'local',
    mediaMode: 'existing-source-read-only',
  };
  const adminUri = new URL(database);
  adminUri.pathname = '/postgres';
  const admin = await options.connect(adminUri.toString());
  let created = false;
  let oid: number | undefined;
  let directoryId: string | undefined;
  let token: AcquiredStagingClone | undefined;
  let active = true;
  let failure: unknown;
  async function catalog() {
    const identity = (
      await admin.query(`SELECT current_database() AS database, current_user AS role,
      current_setting('server_version_num')::int AS version, ${serverMarker}`)
    ).rows[0];
    if (
      identity?.database !== 'postgres' ||
      identity.role !== sourceRole ||
      typeof identity.version !== 'number' ||
      Math.floor(identity.version / 10000) !== 17 ||
      typeof identity.server_marker !== 'string' ||
      digest(identity.server_marker) !== permissions.serverIdentitySha256
    )
      throw new Error('Staging catalog connection identity changed');
    return (
      await admin.query(
        `SELECT d.oid::int AS oid, r.rolname AS owner
      FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = $1`,
        [name],
      )
    ).rows[0];
  }
  async function assertOwned() {
    if (!active || !created || !oid) throw new Error('An active owned staging clone is required');
    const row = await catalog();
    if (
      row?.oid !== oid ||
      row.owner !== sourceRole ||
      (directoryId && (await directoryIdentity(context.publicationDirectory)) !== directoryId)
    )
      throw new Error('Clone database or publication identity changed');
  }
  try {
    await assertAbsent(context.publicationDirectory);
    if (await catalog()) throw new Error('Clone refuses a pre-existing database');
    // name and role are generated/fixed identifiers, never caller-controlled SQL.
    await admin.query(
      `CREATE DATABASE ${quote(name)} WITH TEMPLATE template0 OWNER ${quote(sourceRole)}`,
    );
    created = true;
    const row = await catalog();
    if (
      !row ||
      !Number.isSafeInteger(row.oid) ||
      (row.oid as number) <= 0 ||
      row.owner !== sourceRole
    )
      throw new Error('New clone catalog identity unavailable; cleanup requires review');
    oid = row.oid as number;
    await mkdir(path.dirname(context.publicationDirectory), { recursive: true, mode: 0o700 });
    await mkdir(context.publicationDirectory, { mode: 0o700 });
    directoryId = await directoryIdentity(context.publicationDirectory);
    token = Object.freeze({}) as AcquiredStagingClone;
    acquired.set(token, {
      context,
      assertOwned,
      connect: options.connect,
      restoreDump: options.restoreDump,
      restored: false,
    });
    return await operation(token);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (token) acquired.delete(token);
    try {
      if (created) {
        await assertOwned();
        // No FORCE: a still-running copy must be stopped before cleanup.
        await admin.query(`DROP DATABASE ${quote(name)}`);
        if (directoryId) {
          if (path.dirname(context.publicationDirectory) !== path.resolve('.work/publication'))
            throw new Error('Clone publication cleanup refused');
          assertUnlinkedWorkspacePath(context.publicationDirectory);
          await rm(context.publicationDirectory, { recursive: true });
        }
      }
    } catch (cleanupError) {
      if (failure !== undefined)
        throw new AggregateError(
          [failure, cleanupError],
          'Clone failed; changed targets were preserved for review',
        );
      throw cleanupError;
    } finally {
      active = false;
      await admin.end();
    }
  }
}
function state(clone: AcquiredStagingClone) {
  const result = acquired.get(clone);
  if (!result) throw new Error('An active acquired staging clone is required');
  return result;
}
export async function inspectStagingClone(clone: AcquiredStagingClone) {
  const current = state(clone);
  await current.assertOwned();
  return structuredClone(current.context);
}
export async function restoreStagingClone(
  clone: AcquiredStagingClone,
  input: { dumpPath: string; root: PublicRoot },
  verifyRestored: (context: StagingCloneContext) => Promise<void>,
) {
  const current = state(clone);
  await current.assertOwned();
  if (current.restored) throw new Error('A staging clone restore can run only once');
  assertPrivateBackupWorkPath(input.dumpPath);
  await inspectPrivateBackupFile(input.dumpPath);
  const root = publicRootSchema.parse(input.root);
  const client = await current.connect(current.context.databaseUri);
  try {
    const identity = (
      await client.query(`SELECT current_database() AS database, current_user AS role,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')) AS tables`)
    ).rows[0];
    if (
      identity?.database !== current.context.databaseName ||
      identity.role !== sourceRole ||
      identity.tables !== 0 ||
      (await readdir(current.context.publicationDirectory)).length !== 0
    )
      throw new Error('Restore requires the fresh empty database and publication directory');
  } finally {
    await client.end();
  }
  await current.assertOwned();
  current.restored = true;
  await current.restoreDump({ databaseUri: current.context.databaseUri, dumpPath: input.dumpPath });
  await withPublicRootWriter(current.context.publicationDirectory, async (before, commit) => {
    if (before !== null) throw new Error('Clone publication target changed');
    await commit(root);
  });
  await current.assertOwned();
  await verifyRestored(await inspectStagingClone(clone));
}
