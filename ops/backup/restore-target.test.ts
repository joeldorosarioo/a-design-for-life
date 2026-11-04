import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createRestoreTargetBoundary } from './restore-target';

const now = new Date('2026-12-01T00:00:00.000Z');
const ownerId = '11111111-1111-4111-8111-111111111111';
const target = {
  environment: 'test',
  ownerId,
  database: {
    identity: 'a'.repeat(64),
    namespace: 'adfl_test_restore_11111111111141118111111111111111',
  },
  media: { identity: 'b'.repeat(64), namespace: `adfl-test-restore-${ownerId}` },
  publication: { identity: 'c'.repeat(64), namespace: `adfl-restore-${ownerId}` },
};
function observed() {
  return {
    target: structuredClone(target),
    preflightAbsentAt: '2026-11-30T23:59:40.000Z',
    acquiredAt: '2026-11-30T23:59:45.000Z',
    observedAt: now.toISOString(),
    expiresAt: '2026-12-01T00:04:45.000Z',
    createdByOwner: true,
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
    expect(await readFile(file, 'utf8')).toBe('adfl_test_restore_11111111111141118111111111111111');
  });
  expect(observations).toBe(2);
});
it.each([
  ['production', { ...target, environment: 'production' }],
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
  ['pre-existing resources', { createdByOwner: false }],
  ['lost ownership lease', { leaseActive: false }],
  ['nonempty database', { databaseEmpty: false }],
  ['nonempty media', { mediaEmpty: false }],
  ['nonempty publication', { publicationEmpty: false }],
  ['stale observation', { observedAt: '2026-11-30T23:59:00.000Z' }],
  ['expired ownership', { expiresAt: '2026-11-30T23:59:59.000Z' }],
  [
    'old acquisition',
    { acquiredAt: '2026-11-30T23:00:00.000Z', preflightAbsentAt: '2026-11-30T22:59:59.000Z' },
  ],
  ['absence checked after acquisition', { preflightAbsentAt: '2026-11-30T23:59:46.000Z' }],
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
    database: { ...target.database, namespace: `adfl_test_restore_${ownerId.replaceAll('-', '')}` },
    media: { ...target.media, namespace: `adfl-test-restore-${ownerId}` },
  };
  const env = readServerEnv({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: 'synthetic-restore-namespace-contract-only-secret',
    DATABASE_URI: `postgres://synthetic:synthetic@127.0.0.1:55434/${compatible.database.namespace}`,
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
    preflightAbsentAt: '2026-11-30T23:59:55.000Z',
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
