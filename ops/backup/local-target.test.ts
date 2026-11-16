import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { withPrivateBackupWorkspace } from './repository';
import {
  createRestoreTargetBoundary,
  inspectOwnedLocalRestoreContext,
  restoreIntoOwnedLocalTarget,
  withOwnedLocalRestoreTarget,
  type LocalRestoreContext,
  type LocalRestoreTargetOptions,
} from './local-target';
const contexts: LocalRestoreContext[] = [];
function record(context: LocalRestoreContext) {
  expect(context).toMatchObject({
    databaseName: 'a_design_for_life_rebuild',
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
  const oid = '12345';
  let checkpoints = 0,
    restored = 0,
    recovered = 0;
  const calls: { tool: string; args: readonly string[]; inputFile?: string }[] = [];
  let missing = false;
  let replaceOid = false;
  const options: LocalRestoreTargetOptions = {
    environment: 'test',
    sourceDatabaseUri:
      'postgres://synthetic:synthetic-local-test-only@127.0.0.1:5432/a_design_for_life_rebuild',
    siteOrigin: 'http://127.0.0.1:3101',
    postgres: {
      async checkpoint() {
        checkpoints++;
        return async () => {
          recovered++;
        };
      },
      async reset() {},
      async assertOwned() {
        return {
          containerId: 'a'.repeat(64),
          networkId: 'b'.repeat(64),
          runId: '11111111-1111-4111-8111-111111111111',
        };
      },
      async invoke(input) {
        calls.push(input);
        if (input.tool === 'pg_restore') {
          expect(input.args).toEqual([
            '--username=synthetic',
            '--dbname=a_design_for_life_rebuild',
            '--single-transaction',
            '--clean',
            '--if-exists',
            '--no-owner',
            '--no-acl',
          ]);
          expect(input.inputFile).toBeTruthy();
          restored++;
          return '';
        }
        if (input.tool === 'psql') {
          const query = input.args.at(-1)!;
          if (query.includes('FROM pg_database')) return missing ? '' : replaceOid ? '54321' : oid;
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
    get checkpoints() {
      return checkpoints;
    },
    get restored() {
      return restored;
    },
    get recovered() {
      return recovered;
    },
    missing() {
      missing = true;
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
it('refuses a missing fixed database before acquiring a checkpoint', async () => {
  const fixture = boundary();
  fixture.missing();
  await expect(
    withOwnedLocalRestoreTarget(fixture.options, async () => undefined),
  ).rejects.toThrow();
  expect(fixture.checkpoints).toBe(0);
  expect(fixture.recovered).toBe(0);
});
it('restores under the prepared schema/filesystem guard and recovers the shared database afterward', async () => {
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
  expect(fixture.checkpoints).toBe(1);
  expect(fixture.restored).toBe(1);
  expect(fixture.recovered).toBe(1);
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
it('recovers the shared database checkpoint even when verification fails', async () => {
  const fixture = boundary();
  await expect(
    withOwnedLocalRestoreTarget(fixture.options, async () => {
      throw new Error('Synthetic restore verification failure');
    }),
  ).rejects.toThrow('Synthetic restore verification failure');
  expect(fixture.recovered).toBe(1);
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
it('refuses catalog identity replacement and leaves targets for review instead of writing to another database', async () => {
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
  expect(fixture.recovered).toBe(0);
});
it('keeps a concrete target lease exclusive without TTL takeover', async () => {
  const fixture = boundary();
  await withOwnedLocalRestoreTarget(fixture.options, async () => {
    await expect(
      withOwnedLocalRestoreTarget(fixture.options, async () => undefined),
    ).rejects.toThrow(/busy/i);
  });
});

const now = new Date('2026-12-01T00:00:00.000Z');
const ownerId = '11111111-1111-4111-8111-111111111111';
const target = {
  environment: 'test',
  ownerId,
  database: {
    identity: 'a'.repeat(64),
    namespace: 'a_design_for_life_rebuild',
  },
  media: { identity: 'b'.repeat(64), namespace: `adfl-test-restore-${ownerId}` },
  publication: { identity: 'c'.repeat(64), namespace: `adfl-restore-${ownerId}` },
};
function observed() {
  return {
    target: structuredClone(target),
    checkpointedAt: '2026-11-30T23:59:40.000Z',
    acquiredAt: '2026-11-30T23:59:45.000Z',
    observedAt: now.toISOString(),
    expiresAt: '2026-12-01T00:04:45.000Z',
    preparedByOwner: true,
    leaseActive: true,
    databaseEmpty: true,
    mediaEmpty: true,
    publicationEmpty: true,
  };
}

// The filesystem effect proves an invalid guard cannot reach a destructive consumer.
async function withOutput(run: (file: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'adfl-backup-guard-'));
  try {
    await run(path.join(directory, `${randomUUID()}.txt`));
  } finally {
    if (
      path.dirname(directory) !== tmpdir() ||
      !path.basename(directory).startsWith('adfl-backup-guard-')
    )
      throw new Error('Invalid owned scratch target');
    await rm(directory, { recursive: true });
  }
}
it('runs a restore effect only after acquiring and rechecking owned empty resources', async () => {
  let observations = 0;
  const boundary = createRestoreTargetBoundary(async () => {
    observations++;
    return observed();
  });
  const permit = await boundary.acquire(target, now);
  await withOutput(async (file) => {
    await boundary.run(permit, now, async (selected) => {
      await writeFile(file, selected.database.namespace, { flag: 'wx' });
    });
    expect(await readFile(file, 'utf8')).toBe('a_design_for_life_rebuild');
  });
  expect(observations).toBe(2);
});
it.each([
  ['production', { ...target, environment: 'production' }],
  ['staging', { ...target, environment: 'staging' }],
  ['ambiguous environment', { ...target, environment: 'local' }],
  ['name-only database', { ...target, database: { namespace: target.database.namespace } }],
  ['foreign namespace', { ...target, media: { ...target.media, namespace: 'existing-bucket' } }],
  [
    'reused identity across destinations',
    { ...target, media: { ...target.media, identity: target.database.identity } },
  ],
])('refuses %s before inspecting resources', async (_name, candidate) => {
  const boundary = createRestoreTargetBoundary(async () => {
    throw new Error('Inspection should not run');
  });
  await expect(boundary.acquire(candidate, now)).rejects.not.toThrow('Inspection should not run');
});
it.each([
  ['schema not prepared', { preparedByOwner: false }],
  ['lost ownership lease', { leaseActive: false }],
  ['nonempty database', { databaseEmpty: false }],
  ['nonempty media', { mediaEmpty: false }],
  ['nonempty publication', { publicationEmpty: false }],
  ['stale observation', { observedAt: '2026-11-30T23:59:00.000Z' }],
  ['expired ownership', { expiresAt: '2026-11-30T23:59:59.000Z' }],
  [
    'old acquisition',
    { acquiredAt: '2026-11-30T23:00:00.000Z', checkpointedAt: '2026-11-30T22:59:59.000Z' },
  ],
  ['checkpoint captured after acquisition', { checkpointedAt: '2026-11-30T23:59:46.000Z' }],
  ['future observation', { observedAt: '2026-12-01T00:00:01.000Z' }],
  ['extra bypass field', { bypass: true }],
])('refuses %s without issuing a permit', async (_name, changed) => {
  const boundary = createRestoreTargetBoundary(async () => ({ ...observed(), ...changed }));
  await expect(boundary.acquire(target, now)).rejects.toThrow();
});
it('refuses ownership claimed for a different resource', async () => {
  const observation = observed();
  observation.target.database.identity = 'f'.repeat(64);
  const boundary = createRestoreTargetBoundary(async () => observation);
  await expect(boundary.acquire(target, now)).rejects.toThrow();
});
it.each(['identity', 'nonempty', 'lease'] as const)(
  'rechecks %s before any restore effect',
  async (failure) => {
    let count = 0;
    const boundary = createRestoreTargetBoundary(async () => {
      const value = observed();
      if (count++) {
        if (failure === 'identity') value.target.database.identity = 'f'.repeat(64);
        if (failure === 'nonempty') value.mediaEmpty = false;
        if (failure === 'lease') value.leaseActive = false;
      }
      return value;
    });
    const permit = await boundary.acquire(target, now);
    await withOutput(async (file) => {
      await expect(
        boundary.run(permit, now, async () => {
          await writeFile(file, 'unsafe');
        }),
      ).rejects.toThrow();
      await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  },
);
it('rejects a forged permit with no restore effect', async () => {
  const boundary = createRestoreTargetBoundary(async () => observed());
  await withOutput(async (file) => {
    await expect(
      boundary.run({ verified: true, target }, now, async () => {
        await writeFile(file, 'unsafe');
      }),
    ).rejects.toThrow();
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
it('refuses a permit issued by another resource boundary', async () => {
  const first = createRestoreTargetBoundary(async () => observed());
  const second = createRestoreTargetBoundary(async () => observed());
  await expect(
    second.run(await first.acquire(target, now), now, async () => 'unsafe'),
  ).rejects.toThrow();
});
it('consumes the permit even if the restore effect fails', async () => {
  const boundary = createRestoreTargetBoundary(async () => observed());
  const permit = await boundary.acquire(target, now);
  await expect(
    boundary.run(permit, now, async () => {
      throw new Error('restore failed');
    }),
  ).rejects.toThrow('restore failed');
  await expect(boundary.run(permit, now, async () => 'unsafe')).rejects.toThrow();
});
it('refuses a permit once its freshness window expires', async () => {
  const boundary = createRestoreTargetBoundary(async () => observed());
  const permit = await boundary.acquire(target, now);
  await expect(
    boundary.run(permit, new Date('2026-12-01T00:01:01.000Z'), async () => 'unsafe'),
  ).rejects.toThrow();
});
it('accepts a fresh owned restore target compatible with the validated test server environment', async () => {
  const { readServerEnv } = await import('../../src/config/server-env');
  const compatible = {
    ...structuredClone(target),
    database: { ...target.database, namespace: 'a_design_for_life_rebuild' },
    media: { ...target.media, namespace: `adfl-test-restore-${ownerId}` },
  };
  const env = readServerEnv({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: 'synthetic-restore-namespace-contract-only-secret',
    DATABASE_URI: `postgres://synthetic:synthetic@127.0.0.1:5432/${compatible.database.namespace}`,
    SITE_ORIGIN: 'http://127.0.0.1:3101',
    MEDIA_BUCKET: compatible.media.namespace,
  });
  expect(new URL(env.DATABASE_URI).pathname).toBe(`/${compatible.database.namespace}`);
  const boundary = createRestoreTargetBoundary(async () => ({ ...observed(), target: compatible }));
  await expect(boundary.acquire(compatible, now)).resolves.toBeDefined();
});
it('refuses an ownership observation that predates resource acquisition before any restore effect', async () => {
  const boundary = createRestoreTargetBoundary(async () => ({
    ...observed(),
    checkpointedAt: '2026-11-30T23:59:55.000Z',
    acquiredAt: '2026-11-30T23:59:59.000Z',
    observedAt: '2026-11-30T23:59:58.000Z',
    expiresAt: '2026-12-01T00:04:59.000Z',
  }));
  await withOutput(async (file) => {
    await expect(
      (async () => {
        const permit = await boundary.acquire(target, now);
        return boundary.run(permit, now, async () => writeFile(file, 'unsafe', { flag: 'wx' }));
      })(),
    ).rejects.toThrow();
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
