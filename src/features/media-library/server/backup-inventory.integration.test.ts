import { appendFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres';
import config from '@payload-config';
import type { Media } from '@/payload-types';
import { captureBackupMediaInventory } from './backup-inventory';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
import { createLocalRestoreObjectWriter } from '@/helpers/storage/restore-object';
import { createLocalObjectStorage } from '@/helpers/storage/object-storage';
import { inspectOwnedTestDatabase } from '../../../../testing/setup/owned-test-database';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import { withNativeBackupSnapshot } from '@/helpers/payload/backup-snapshot';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('default');
  registerOwnedPayload(fixture.payload);
});
function persistProofMetadata(value: unknown) {
  const directory = path.resolve('docs/verification/artifacts/E3-backup');
  mkdirSync(directory, { recursive: true });
  const runId = process.env.ADFL_TEST_RUN_ID;
  if (!/^[a-f0-9-]{36}$/.test(runId ?? '')) throw new Error('Owned proof run identity unavailable');
  appendFileSync(
    path.join(directory, `native-foundations-proof-${runId}.jsonl`),
    JSON.stringify(value) + '\n',
    { mode: 0o600 },
  );
}
type OwnedClient = { release: () => void };
type OwnedPool = PostgresAdapter['pool'] & {
  _clients: OwnedClient[];
  _idle: { client: OwnedClient }[];
  _pendingQueue: unknown[];
};
const ownedPools = new Map<
  Payload,
  { pool: OwnedPool; bootstrap: OwnedClient; containerId: string }
>();
function registerOwnedPayload(payload: Payload) {
  const owned = inspectOwnedTestDatabase();
  persistProofMetadata({
    event: 'backup-proof-owned-resource',
    containerId: owned.containerId,
    networkId: owned.networkId,
    runId: process.env.ADFL_TEST_RUN_ID,
  });
  const pool = payload.db.pool as OwnedPool;
  if (!pool._clients?.[0] || pool._pendingQueue?.length !== 0)
    throw new Error('Unexpected owned native fixture pool initialization');
  ownedPools.set(payload, { pool, bootstrap: pool._clients[0], containerId: owned.containerId });
}
async function closeOwnedPayload(payload: Payload) {
  const owned = ownedPools.get(payload);
  if (
    !owned ||
    payload.db.pool !== owned.pool ||
    inspectOwnedTestDatabase().containerId !== owned.containerId ||
    Object.keys(payload.db.sessions ?? {}).length !== 0 ||
    owned.pool.waitingCount !== 0 ||
    owned.pool._pendingQueue.length !== 0
  )
    throw new Error('Refusing cleanup of an unowned or active native fixture pool');
  const borrowed = owned.pool._clients.filter(
    (client) => !owned.pool._idle.some((item) => item.client === client),
  );
  if (
    borrowed.length !== 1 ||
    borrowed[0] !== owned.bootstrap ||
    typeof owned.bootstrap.release !== 'function'
  )
    throw new Error('Expected only the owned adapter3.92.1 bootstrap checkout');
  await payload.destroy();
  // No outstanding SQL/session remains. Recheck exact owned identity synchronously
  // before returning the adapter connect.js bootstrap client and ending its pool.
  if (
    payload.db.pool !== owned.pool ||
    Object.keys(payload.db.sessions ?? {}).length !== 0 ||
    owned.pool.waitingCount !== 0 ||
    owned.pool._pendingQueue.length !== 0 ||
    owned.pool._clients.filter((client) => !owned.pool._idle.some((item) => item.client === client))
      .length !== 1 ||
    !owned.pool._clients.includes(owned.bootstrap) ||
    owned.pool._idle.some((item) => item.client === owned.bootstrap)
  )
    throw new Error('Owned native fixture pool changed before release');
  owned.bootstrap.release();
  await owned.pool.end();
  ownedPools.delete(payload);
  persistProofMetadata({
    event: 'backup-proof-owned-pool-closed',
    containerId: owned.containerId,
    sessions: 0,
    poolEnded: owned.pool.ended,
  });
}
afterAll(async () => {
  if (fixture) await closeOwnedPayload(fixture.payload);
});

it('exports the same native read-only snapshot as the complete media inventory and restores A after concurrent B', async () => {
  const started = performance.now();
  const owned = inspectOwnedTestDatabase();
  const ownerId = randomUUID();
  const restoreName = `adfl_test_restore_${ownerId.replaceAll('-', '')}`;
  const dumpPath = `/tmp/adfl-backup-${ownerId}.dump`;
  const mediaParent = path.resolve('.work/private-media', `adfl-test-restore-${ownerId}`);
  const mediaRoot = path.join(mediaParent, restoreName);
  let databaseCreated = false;
  let restored: Payload | undefined;
  function postgresTool(tool: string, args: string[]) {
    const current = inspectOwnedTestDatabase();
    if (current.containerId !== owned.containerId || current.networkId !== owned.networkId)
      throw new Error('Owned backup proof database changed');
    const result = spawnSync('docker', ['exec', owned.containerId, tool, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    });
    persistProofMetadata({
      event: 'backup-proof-tool',
      containerId: owned.containerId,
      networkId: owned.networkId,
      runId: process.env.ADFL_TEST_RUN_ID,
      tool,
      args,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      spawnError: result.error?.message,
    });
    if (result.error || result.status !== 0)
      throw new Error(`Owned ${tool} proof failed (exit ${result.status})`);
    return result.stdout.trim();
  }
  try {
    const image = await mediaMetadataFixture(fixture.payload);
    const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
    await fixture.payload.update({
      collection: 'media',
      id: pdf.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const raw = await fixture.payload.db.findOne<Media>({
      collection: 'media',
      where: { id: { equals: image.id } },
    });
    const imageManifest = mediaManifestSchema.parse(raw?.manifest);
    // Technical synthetic fixture through the native adapter: enough valid rows
    // to cross a full inventory page, without repeating heavy image processing.
    const pagingIds: string[] = [];
    for (let index = 0; index < 101; index++) {
      const created = await fixture.payload.db.create({
        collection: 'media',
        data: {
          label: `Synthetic inventory ${index}`,
          manifest: imageManifest,
          usages: [],
          guardRevision: randomUUID(),
          state: 'ready',
        },
      });
      pagingIds.push(created.id);
    }
    const identity = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic snapshot A' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    for (const locale of ['pt', 'en'] as const) {
      const content = await fixture.payload.create({
        collection: 'case-content',
        data: {
          ...casePublicationFixture(image.id),
          case: identity.id,
          locale,
          title: `Synthetic snapshot ${locale} A`,
          _status: 'published',
        },
        req: await fixture.request(),
        overrideAccess: false,
      });
      await confirmTestPublication(content, await fixture.request());
    }
    const directory = runtimePublication().directory;
    const confirmedA = await readPublicRoot(directory);
    const sessionsBefore = Object.keys(fixture.payload.db.sessions ?? {});
    let lateId = '';
    await withNativeBackupSnapshot(
      {
        payload: fixture.payload,
        directory,
        capture: (context) => captureBackupMediaInventory(context),
      },
      async (snapshot) => {
        expect(snapshot.snapshotId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{8}-[0-9]+$/i);
        expect(snapshot.root).toEqual(confirmedA);
        expect(snapshot.captured.mediaIds).toEqual(
          expect.arrayContaining([image.id, pdf.id, ...pagingIds]),
        );
        expect(snapshot.captured.objects.length).toBeGreaterThanOrEqual(3);
        await fixture.payload.update({
          collection: 'cases',
          id: identity.id,
          data: { internalTitle: 'Synthetic snapshot B' },
          req: await observedRequest('cases', identity.id, await fixture.request()),
          overrideAccess: false,
        });
        lateId = (await mediaMetadataFixture(fixture.payload)).id;
        expect(snapshot.captured.mediaIds).not.toContain(lateId);
        // The short publication capture lock has been released while the exporter
        // transaction remains open for pg_dump; a concurrent writer can proceed.
        await withPublicRootWriter(directory, async (root, commit) => {
          if (!root) throw new Error('Confirmed fixture root missing');
          await commit({ ...root, generation: randomUUID() });
        });
        expect((await readPublicRoot(directory))?.generation).not.toBe(snapshot.root?.generation);
        postgresTool('pg_dump', ['--version']);
        postgresTool('pg_restore', ['--version']);
        postgresTool('pg_dump', [
          '--username=adfl_test',
          '--dbname=adfl_test_runner',
          '--format=custom',
          `--snapshot=${snapshot.snapshotId}`,
          '--no-owner',
          '--no-acl',
          `--file=${dumpPath}`,
        ]);
        postgresTool('createdb', ['--username=adfl_test', '--template=template0', restoreName]);
        databaseCreated = true;
        postgresTool('pg_restore', [
          '--username=adfl_test',
          `--dbname=${restoreName}`,
          '--single-transaction',
          '--no-owner',
          '--no-acl',
          dumpPath,
        ]);
        const restoredURI = new URL(process.env.DATABASE_URI!);
        restoredURI.pathname = `/${restoreName}`;
        const prepared = await config;
        restored = await getPayload({
          key: `backup-restored-${ownerId}`,
          config: {
            ...prepared,
            db: {
              name: 'postgres',
              allowIDOnCreate: false,
              ...postgresAdapter({
                pool: { connectionString: restoredURI.toString() },
                idType: 'uuid',
                push: false,
                disableCreateDatabase: true,
              }),
            },
          },
        });
        registerOwnedPayload(restored);
        const restoredIdentity = await restored.db.findOne({
          collection: 'cases',
          where: { id: { equals: identity.id } },
        });
        expect(restoredIdentity).toMatchObject({ internalTitle: 'Synthetic snapshot A' });
        const translations = await restored.db.find({
          collection: 'case-content',
          where: { case: { equals: identity.id } },
          pagination: false,
          limit: 0,
        });
        expect(translations.docs).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ locale: 'pt', title: 'Synthetic snapshot pt A' }),
            expect.objectContaining({ locale: 'en', title: 'Synthetic snapshot en A' }),
          ]),
        );
        expect(
          await restored.db.findOne({ collection: 'media', where: { id: { equals: lateId } } }),
        ).toBeNull();
        expect(
          await restored.db.findOne({ collection: 'media', where: { id: { equals: pdf.id } } }),
        ).toMatchObject({ state: 'deleted', deletedAt: expect.any(String) });
        const writer = await createLocalRestoreObjectWriter({ root: mediaRoot, ownerId });
        const source = createLocalObjectStorage(
          process.env.MEDIA_STORAGE_ROOT ??
            path.resolve(
              '.work/private-media',
              process.env.MEDIA_BUCKET!,
              new URL(process.env.DATABASE_URI!).pathname.slice(1),
            ),
        );
        for (const object of snapshot.captured.objects)
          await writer.restore(object, await source.get(object));
        const target = createLocalObjectStorage(mediaRoot);
        for (const object of snapshot.captured.objects)
          expect(await target.get(object)).toEqual(await source.get(object));
      },
    );
    expect(Object.keys(fixture.payload.db.sessions ?? {})).toEqual(sessionsBefore);
    expect(
      await fixture.payload.db.findOne({
        collection: 'cases',
        where: { id: { equals: identity.id } },
      }),
    ).toMatchObject({ internalTitle: 'Synthetic snapshot B' });
    const receiptDirectory = path.resolve('docs/verification/artifacts/E3-backup');
    await mkdir(receiptDirectory, { recursive: true });
    await writeFile(
      path.join(receiptDirectory, `native-snapshot-restore-${ownerId}.json`),
      JSON.stringify(
        {
          source: 'owned disposable runner',
          database: restoreName,
          containerId: owned.containerId,
          networkId: owned.networkId,
          runId: process.env.ADFL_TEST_RUN_ID,
          observation:
            'dump+inventory A; source changed to B; restored A; PT/EN, trashed PDF, immutable object bytes and >100 media records verified',
          durationMs: Math.round(performance.now() - started),
          ageExecuted: false,
          remoteR2Executed: false,
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
  } finally {
    if (restored) await closeOwnedPayload(restored);
    if (databaseCreated) postgresTool('dropdb', ['--username=adfl_test', restoreName]);
    postgresTool('rm', ['-f', dumpPath]);
    if (
      path.dirname(mediaParent) !== path.resolve('.work/private-media') ||
      path.basename(mediaParent) !== `adfl-test-restore-${ownerId}`
    )
      throw new Error('Unsafe owned media proof cleanup');
    await rm(mediaParent, { recursive: true, force: true });
  }
}, 60_000);

it('refuses an inventory read outside the owned native backup snapshot', async () => {
  await expect(
    captureBackupMediaInventory({ req: await fixture.request(), root: null }),
  ).rejects.toThrow();
});
