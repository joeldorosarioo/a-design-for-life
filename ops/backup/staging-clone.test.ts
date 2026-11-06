import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { withPrivateBackupWorkspace } from './repository';
import {
  inspectStagingClone,
  inspectStagingClonePermissions,
  restoreStagingClone,
  withStagingDatabaseClone,
  type StagingCloneOptions,
  type StagingCloneContext,
} from './staging-clone';
const contexts: StagingCloneContext[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) {
    expect(path.dirname(context.publicationDirectory)).toBe(path.resolve('.work/publication'));
    await rm(context.publicationDirectory, { force: true, recursive: true });
  }
});
function fixture() {
  let oid: number | undefined,
    name = '',
    tables = 0,
    canCreate = true,
    existing = false;
  let adminMarker = 'owned-staging-server';
  const calls: { database: string; sql: string; values?: readonly unknown[] }[] = [];
  const restoreDump = vi.fn(async () => {});
  const options: StagingCloneOptions = {
    sourceDatabaseUri:
      'postgres://joeldorosarioo_local:synthetic@127.0.0.1:55435/a_design_for_life_rebuild',
    siteOrigin: 'http://127.0.0.1:3087',
    restoreDump,
    async connect(uri) {
      const database = new URL(uri).pathname.slice(1);
      return {
        end: vi.fn(async () => {}),
        async query(sql, values) {
          calls.push({ database, sql, values });
          if (/^(BEGIN READ ONLY|ROLLBACK)$/.test(sql)) return { rows: [] };
          if (sql.includes('FROM pg_roles WHERE'))
            return {
              rows: [
                {
                  database,
                  role: 'joeldorosarioo_local',
                  version: 170011,
                  server_marker: 'owned-staging-server',
                  readonly: 'on',
                  can_create: canCreate,
                },
              ],
            };
          if (sql.startsWith('SELECT current_database()'))
            return {
              rows: [
                {
                  database,
                  role: 'joeldorosarioo_local',
                  version: 170011,
                  server_marker: adminMarker,
                  tables,
                },
              ],
            };
          if (sql.includes('FROM pg_database d'))
            return {
              rows: existing
                ? [{ oid: 987, owner: 'joeldorosarioo_local' }]
                : oid
                  ? [{ oid, owner: 'joeldorosarioo_local' }]
                  : [],
            };
          if (sql.startsWith('CREATE DATABASE')) {
            expect(database).toBe('postgres');
            name = sql.match(/"(a_design_for_life_restore_[a-f0-9]{32})"/)![1];
            oid = 1234;
            return { rows: [] };
          }
          if (sql.startsWith('DROP DATABASE')) {
            expect(sql).toBe(`DROP DATABASE "${name}"`);
            expect(database).toBe('postgres');
            oid = undefined;
            return { rows: [] };
          }
          throw new Error('Unexpected technical catalog SQL');
        },
      };
    },
  };
  return {
    options,
    calls,
    restoreDump,
    setTables(value: number) {
      tables = value;
    },
    noPermission() {
      canCreate = false;
    },
    existing() {
      existing = true;
    },
    replaceOid() {
      oid = 4321;
    },
    wrongServer() {
      adminMarker = 'different-staging-server';
    },
  };
}
it('preflights role capability using a read-only source transaction without database effects', async () => {
  const f = fixture();
  expect(await inspectStagingClonePermissions(f.options)).toMatchObject({
    postgresqlMajor: 17,
    canCreateDatabase: true,
    sourceReadOnly: true,
  });
  expect(f.calls.map((x) => x.sql)[0]).toBe('BEGIN READ ONLY');
  expect(f.calls.at(-1)?.sql).toBe('ROLLBACK');
  expect(f.calls.every((x) => !/CREATE|DROP|UPDATE|INSERT|DELETE/.test(x.sql))).toBe(true);
});
it.each([
  ['host', 'postgres://joeldorosarioo_local:synthetic@remote.test:55435/a_design_for_life_rebuild'],
  ['port', 'postgres://joeldorosarioo_local:synthetic@127.0.0.1:5432/a_design_for_life_rebuild'],
  ['database', 'postgres://joeldorosarioo_local:synthetic@127.0.0.1:55435/production'],
  ['role', 'postgres://root:synthetic@127.0.0.1:55435/a_design_for_life_rebuild'],
])('refuses ambiguous source %s before connecting', async (_, uri) => {
  const f = fixture();
  await expect(
    withStagingDatabaseClone({ ...f.options, sourceDatabaseUri: uri }, async () => {}),
  ).rejects.toThrow(/authorized staging/);
  expect(f.calls).toEqual([]);
});
it('refuses a public HTTP origin before connecting', async () => {
  const f = fixture();
  await expect(
    withStagingDatabaseClone({ ...f.options, siteOrigin: 'https://example.test' }, async () => {}),
  ).rejects.toThrow(/authorized staging/);
  expect(f.calls).toEqual([]);
});
it('refuses insufficient role permission and an existing database without adopting or deleting it', async () => {
  const f = fixture();
  f.noPermission();
  await expect(withStagingDatabaseClone(f.options, async () => {})).rejects.toThrow(
    /cannot create/,
  );
  const g = fixture();
  g.existing();
  await expect(withStagingDatabaseClone(g.options, async () => {})).rejects.toThrow(/pre-existing/);
  expect([...f.calls, ...g.calls].some((x) => /^(CREATE|DROP) DATABASE/.test(x.sql))).toBe(false);
});
it('restores only the fresh UUID database and own publication directory, then removes both', async () => {
  const f = fixture();
  let closed: object;
  await withPrivateBackupWorkspace('restore', async (directory) => {
    const dumpPath = path.join(directory, 'database.dump');
    await writeFile(dumpPath, 'PGDMP synthetic');
    await withStagingDatabaseClone(f.options, async (clone) => {
      closed = clone;
      const context = await inspectStagingClone(clone);
      contexts.push(context);
      expect(context.databaseName).toMatch(/^a_design_for_life_restore_[a-f0-9]{32}$/);
      expect(context.databaseUri).not.toBe(f.options.sourceDatabaseUri);
      expect(context).toMatchObject({
        appEnvironment: 'local',
        mediaMode: 'existing-source-read-only',
      });
      const root = { generation: randomUUID(), subjects: {} };
      const verify = vi.fn(async (restored: StagingCloneContext) => {
        expect(restored).toEqual(context);
        expect(
          JSON.parse(
            await readFile(path.join(restored.publicationDirectory, 'current.json'), 'utf8'),
          ),
        ).toEqual(root);
      });
      await restoreStagingClone(clone, { dumpPath, root }, verify);
      expect(f.restoreDump).toHaveBeenCalledExactlyOnceWith({
        databaseUri: context.databaseUri,
        dumpPath,
      });
      expect(verify).toHaveBeenCalledOnce();
      await expect(restoreStagingClone(clone, { dumpPath, root }, verify)).rejects.toThrow(
        /only once/,
      );
    });
  });
  expect(f.calls.filter((x) => x.sql.startsWith('DROP DATABASE'))).toHaveLength(1);
  expect(
    f.calls
      .filter((x) => x.database === 'a_design_for_life_rebuild')
      .every((x) => /^(BEGIN READ ONLY|ROLLBACK|SELECT)/.test(x.sql)),
  ).toBe(true);
  await expect(inspectStagingClone(closed! as never)).rejects.toThrow(/active acquired/);
});
it('refuses a nonempty new database before restoring any dump', async () => {
  const f = fixture();
  await withPrivateBackupWorkspace('restore', async (directory) => {
    const dumpPath = path.join(directory, 'database.dump');
    await writeFile(dumpPath, 'PGDMP synthetic');
    await withStagingDatabaseClone(f.options, async (clone) => {
      contexts.push(await inspectStagingClone(clone));
      f.setTables(1);
      await expect(
        restoreStagingClone(
          clone,
          { dumpPath, root: { generation: randomUUID(), subjects: {} } },
          async () => {},
        ),
      ).rejects.toThrow(/fresh empty/);
    });
  });
  expect(f.restoreDump).not.toHaveBeenCalled();
});
it('preserves a database whose catalog OID changed rather than dropping it', async () => {
  const f = fixture();
  await expect(
    withStagingDatabaseClone(f.options, async (clone) => {
      contexts.push(await inspectStagingClone(clone));
      f.replaceOid();
    }),
  ).rejects.toThrow(/identity changed/);
  expect(f.calls.some((x) => x.sql.startsWith('DROP DATABASE'))).toBe(false);
});
it('never accepts forged targets', async () => {
  await expect(inspectStagingClone({} as never)).rejects.toThrow(/active acquired/);
});

it('refuses a catalog connection to a different PostgreSQL server before CREATE DATABASE', async () => {
  const f = fixture();
  f.wrongServer();
  await expect(withStagingDatabaseClone(f.options, async () => {})).rejects.toThrow(
    /catalog connection identity/,
  );
  expect(f.calls.some((x) => /^(CREATE|DROP) DATABASE/.test(x.sql))).toBe(false);
});
