import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { withPrivateBackupWorkspace } from './repository';
import {
  inspectOwnedLocalRestoreContext,
  restoreIntoOwnedLocalTarget,
  withOwnedLocalRestoreTarget,
  type LocalRestoreContext,
  type LocalRestoreTargetOptions,
} from './local-target';
const contexts: LocalRestoreContext[] = [];
function record(context: LocalRestoreContext) {
  expect(context).toMatchObject({
    databaseName: expect.stringMatching(/^adfl_test_restore_[a-f0-9]{32}$/),
    ownerId: expect.stringMatching(/^[a-f0-9-]{36}$/),
    mediaRoot: expect.any(String),
    publicationDirectory: expect.any(String),
  });
  contexts.push(context);
}
afterEach(async () => {
  for (const context of contexts.splice(0)) {
    const parent = path.dirname(context.mediaRoot);
    if (
      path.dirname(parent) !== path.resolve('.work/private-media') ||
      path.basename(parent) !== `adfl-test-restore-${context.ownerId}` ||
      path.dirname(context.publicationDirectory) !== path.resolve('.work/publication')
    )
      throw new Error('Unsafe owned target test cleanup');
    await rm(parent, { recursive: true, force: true });
    await rm(context.publicationDirectory, { recursive: true, force: true });
  }
});
function boundary() {
  let oid: string | undefined;
  let created = 0,
    restored = 0,
    dropped = 0;
  const calls: { tool: string; args: readonly string[]; inputFile?: string }[] = [];
  let forceExisting = false;
  let replaceOid = false;
  const options: LocalRestoreTargetOptions = {
    environment: 'test',
    sourceDatabaseUri:
      'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
    siteOrigin: 'http://127.0.0.1:3101',
    postgres: {
      async assertOwned() {
        return {
          containerId: 'a'.repeat(64),
          networkId: 'b'.repeat(64),
          runId: '11111111-1111-4111-8111-111111111111',
        };
      },
      async invoke(input) {
        calls.push(input);
        if (input.tool === 'createdb') {
          expect(input.args).toEqual([
            '--username=adfl_test',
            '--template=template0',
            expect.stringMatching(/^adfl_test_restore_[a-f0-9]{32}$/),
          ]);
          created++;
          oid = '12345';
          return '';
        }
        if (input.tool === 'dropdb') {
          dropped++;
          oid = undefined;
          return '';
        }
        if (input.tool === 'pg_restore') {
          expect(input.args).toEqual([
            '--username=adfl_test',
            expect.stringMatching(/^--dbname=adfl_test_restore_[a-f0-9]{32}$/),
            '--single-transaction',
            '--no-owner',
            '--no-acl',
          ]);
          expect(input.inputFile).toBeTruthy();
          restored++;
          return '';
        }
        if (input.tool === 'psql') {
          const query = input.args.at(-1)!;
          if (query.includes('FROM pg_database'))
            return forceExisting ? '900' : oid ? (replaceOid ? '54321' : oid) : '';
          if (query.includes('information_schema.tables')) return '0';
          throw new Error('Unexpected technical catalog query');
        }
        throw new Error('Unexpected tool');
      },
    },
  };
  return {
    options,
    calls,
    get created() {
      return created;
    },
    get restored() {
      return restored;
    },
    get dropped() {
      return dropped;
    },
    existing() {
      forceExisting = true;
    },
    replace() {
      replaceOid = true;
    },
  };
}
it.each(['production', 'staging', 'local'])(
  'refuses %s before any technical target command',
  async (environment) => {
    const fixture = boundary();
    await expect(
      withOwnedLocalRestoreTarget(
        { ...fixture.options, environment } as never,
        async () => undefined,
      ),
    ).rejects.toThrow();
    expect(fixture.calls).toEqual([]);
  },
);
it('refuses a pre-existing database instead of adopting it', async () => {
  const fixture = boundary();
  fixture.existing();
  await expect(
    withOwnedLocalRestoreTarget(fixture.options, async () => undefined),
  ).rejects.toThrow();
  expect(fixture.created).toBe(0);
  expect(fixture.dropped).toBe(0);
});
it('performs restore effects only under the actual fresh filesystem/lease guard and cleans only its new targets', async () => {
  const fixture = boundary();
  let observed: LocalRestoreContext | undefined;
  await withPrivateBackupWorkspace('restore', async (directory) => {
    const dumpPath = path.join(directory, 'database.dump');
    const objectPath = path.join(directory, 'object.bin');
    const bytes = Buffer.from('synthetic restored original');
    await writeFile(dumpPath, 'PGDMP process boundary fixture');
    await writeFile(objectPath, bytes);
    const reference = {
      key: 'c'.repeat(64),
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    const root = { generation: randomUUID(), subjects: {} };
    await withOwnedLocalRestoreTarget(fixture.options, async (target) => {
      observed = await inspectOwnedLocalRestoreContext(target);
      record(observed);
      expect(await readdir(observed.mediaRoot)).toEqual([]);
      await restoreIntoOwnedLocalTarget(target, {
        dumpPath,
        objects: [{ reference, path: objectPath }],
        root,
        async verifyRestored(context) {
          expect(await readFile(path.join(context.mediaRoot, reference.key))).toEqual(bytes);
          expect(
            JSON.parse(
              await readFile(path.join(context.publicationDirectory, 'current.json'), 'utf8'),
            ),
          ).toEqual(root);
        },
      });
    });
  });
  expect(fixture.created).toBe(1);
  expect(fixture.restored).toBe(1);
  expect(fixture.dropped).toBe(1);
  expect(observed).toBeTruthy();
  await expect(
    readFile(path.join(observed!.publicationDirectory, 'current.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
it('refuses a forged target token before any restore effect', async () => {
  await expect(
    restoreIntoOwnedLocalTarget({ verified: true } as never, {
      dumpPath: path.resolve('.work/backup-private/no-file'),
      objects: [],
      root: null,
      async verifyRestored() {
        throw new Error('unexpected');
      },
    }),
  ).rejects.toThrow();
});
it('rechecks actual media emptiness before invoking the database restore process', async () => {
  const fixture = boundary();
  await withOwnedLocalRestoreTarget(fixture.options, async (target) => {
    const context = await inspectOwnedLocalRestoreContext(target);
    record(context);
    await writeFile(path.join(context.mediaRoot, 'unexpected'), 'concurrent bytes');
    await expect(
      restoreIntoOwnedLocalTarget(target, {
        dumpPath: path.resolve('.work/backup-private/no-file'),
        objects: [],
        root: null,
        async verifyRestored() {},
      }),
    ).rejects.toThrow();
  });
  expect(fixture.restored).toBe(0);
});
it('refuses catalog identity replacement and leaves targets for review instead of dropping a different database', async () => {
  const fixture = boundary();
  let prepared = false;
  await expect(
    withOwnedLocalRestoreTarget(fixture.options, async (target) => {
      const context = await inspectOwnedLocalRestoreContext(target);
      record(context);
      prepared = true;
      fixture.replace();
      await restoreIntoOwnedLocalTarget(target, {
        dumpPath: path.resolve('.work/backup-private/no-file'),
        objects: [],
        root: null,
        async verifyRestored() {},
      });
    }),
  ).rejects.toThrow();
  expect(prepared).toBe(true);
  expect(fixture.dropped).toBe(0);
});
it('keeps a concrete target lease exclusive without TTL takeover', async () => {
  const fixture = boundary();
  await withOwnedLocalRestoreTarget(fixture.options, async () => {
    await expect(
      withOwnedLocalRestoreTarget(fixture.options, async () => undefined),
    ).rejects.toThrow(/busy/i);
  });
});
