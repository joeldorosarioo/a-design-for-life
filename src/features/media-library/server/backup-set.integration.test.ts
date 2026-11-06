import { existsSync, constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile, lstat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres';
import config from '@payload-config';
import type { Media } from '@/payload-types';
import { captureBackupMediaInventory } from './backup-inventory';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
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
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { withNativeBackupSnapshot } from '@/helpers/payload/backup-snapshot';
import { runBackup, type BackupSource } from '../../../../ops/backup/run';
import { restoreBackup } from '../../../../ops/backup/restore';
import {
  createLocalBackupRepository,
  localBackupRepositoryDirectory,
} from '../../../../ops/backup/repository';
import {
  assertPrivateBackupOutput,
  hashBackupFile,
  runBackupTool,
} from '../../../../ops/backup/tools';
import type { StoredObject } from '@/helpers/storage/object-storage';
import type {
  LocalRestoreContext,
  OwnedPostgresBoundary,
} from '../../../../ops/backup/local-target';

const configured = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
const toolConfig = configured
  ? (JSON.parse(await readFile(configured, 'utf8')) as {
      ageBinary: string;
      tarBinary: string;
      recipient: string;
      identityPath: string;
    })
  : undefined;
const nativeProof = toolConfig ? it : it.skip;
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  if (toolConfig) {
    fixture = await createEditorialPayloadFixture('default');
    await registerOwnedPayload(fixture.payload);
  }
});
async function persistProofMetadata(value: unknown) {
  const runId = process.env.ADFL_TEST_RUN_ID;
  if (!/^[a-f0-9-]{36}$/.test(runId ?? ''))
    throw new Error('Owned encrypted proof run unavailable');
  const directory = path.resolve('docs/verification/artifacts/E3-backup');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `encrypted-native-events-${runId}.jsonl`);
  const { appendFile } = await import('node:fs/promises');
  await appendFile(file, JSON.stringify(value) + '\n', { mode: 0o600 });
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
async function registerOwnedPayload(payload: Payload) {
  const owned = inspectOwnedTestDatabase();
  await persistProofMetadata({
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
  await persistProofMetadata({
    event: 'backup-proof-owned-pool-closed',
    containerId: owned.containerId,
    sessions: 0,
    poolEnded: owned.pool.ended,
  });
}
afterAll(async () => {
  if (fixture) await closeOwnedPayload(fixture.payload);
});

async function sourceFingerprint(roots: string[]) {
  const files: string[] = [];
  async function collect(selected: string) {
    const info = await lstat(selected);
    if (info.isSymbolicLink()) throw new Error('Source fingerprint refuses linked source');
    if (info.isDirectory()) {
      for (const name of (await readdir(selected)).sort()) await collect(path.join(selected, name));
    } else if (info.isFile()) files.push(selected);
  }
  for (const root of roots) await collect(path.resolve(root));
  const fingerprint = createHash('sha256');
  for (const file of files.sort())
    fingerprint.update(
      path.relative(process.cwd(), file).split(path.sep).join('/') +
        '\0' +
        (await hashBackupFile(file)).sha256 +
        '\n',
    );
  return fingerprint.digest('hex');
}
function dockerExecutable() {
  const name = process.platform === 'win32' ? 'docker.exe' : 'docker';
  const resolved = (process.env.PATH ?? '')
    .split(path.delimiter)
    .map((directory) => path.resolve(directory, name))
    .find((selected) => existsSync(selected));
  if (!resolved) throw new Error('Docker tool setup unavailable; not a feature RED');
  return resolved;
}
nativeProof(
  'creates and restores a real encrypted native snapshot A after source B without changing original files',
  async () => {
    const tools = toolConfig!;
    const owned = inspectOwnedTestDatabase();
    const binary = dockerExecutable();
    const id = randomUUID();
    const namespace = {
      project: 'a-design-for-life' as const,
      environment: 'test' as const,
      source: `native-${id}`,
    };
    const repository = await createLocalBackupRepository({ namespace });
    const repositoryRoot = localBackupRepositoryDirectory(namespace);
    async function execOwned(input: {
      tool: string;
      args: readonly string[];
      inputFile?: string;
      outputFile?: string;
    }) {
      const current = inspectOwnedTestDatabase();
      if (current.containerId !== owned.containerId || current.networkId !== owned.networkId)
        throw new Error('Encrypted proof owned PostgreSQL changed');
      const result = await runBackupTool({
        binary,
        args: [
          'exec',
          ...(input.inputFile ? ['--interactive'] : []),
          owned.containerId,
          input.tool,
          ...input.args,
        ],
        ...(input.inputFile ? { inputFile: input.inputFile } : {}),
        ...(input.outputFile ? { outputFile: input.outputFile } : {}),
      });
      await persistProofMetadata({
        event: 'encrypted-proof-tool',
        containerId: owned.containerId,
        networkId: owned.networkId,
        tool: input.tool,
        args: input.args,
        streamedInput: Boolean(input.inputFile),
        streamedOutput: Boolean(input.outputFile),
        stdout: result.stdout,
        exitCode: result.exitCode,
      });
      return result.stdout;
    }
    const postgres: OwnedPostgresBoundary = {
      async assertOwned() {
        const current = inspectOwnedTestDatabase();
        if (current.containerId !== owned.containerId || current.networkId !== owned.networkId)
          throw new Error('Owned encrypted restore host changed');
        return {
          containerId: current.containerId,
          networkId: current.networkId,
          runId: process.env.ADFL_TEST_RUN_ID!,
        };
      },
      invoke: (input) => execOwned(input),
    };
    let expectedObjects: StoredObject[] = [];
    let expectedRoot: PublicRoot | null = null;
    let lateMedia = '';
    let captures = 0;
    let targetSummary:
      { databaseName: string; mediaBucket: string; publicationNamespace: string } | undefined;
    try {
      expect((await execOwned({ tool: 'pg_dump', args: ['--version'] })).trim()).toBe(
        'pg_dump (PostgreSQL) 17.11',
      );
      expect((await execOwned({ tool: 'pg_restore', args: ['--version'] })).trim()).toBe(
        'pg_restore (PostgreSQL) 17.11',
      );
      const image = await mediaMetadataFixture(fixture.payload);
      const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
      await fixture.payload.update({
        collection: 'media',
        id: pdf.id,
        data: { deletedAt: new Date().toISOString() },
        req: await fixture.request(),
        overrideAccess: false,
      });
      const imageRaw = await fixture.payload.db.findOne<Media>({
        collection: 'media',
        where: { id: { equals: image.id } },
      });
      const imageReference = mediaManifestSchema.parse(imageRaw?.manifest).original.object;
      const identity = await fixture.payload.create({
        collection: 'cases',
        data: { internalTitle: 'Synthetic encrypted snapshot A' },
        req: await fixture.request(),
        overrideAccess: false,
      });
      const translations: { id: string; locale: 'pt' | 'en'; slug: string }[] = [];
      for (const locale of ['pt', 'en'] as const) {
        const content = await fixture.payload.create({
          collection: 'case-content',
          data: {
            ...casePublicationFixture(image.id),
            case: identity.id,
            locale,
            title: `Synthetic encrypted ${locale} A`,
            _status: 'published',
          },
          req: await fixture.request(),
          overrideAccess: false,
        });
        await confirmTestPublication(content, await fixture.request());
        translations.push({ id: content.id, locale, slug: content.slug! });
      }
      const storage = createLocalObjectStorage(
        process.env.MEDIA_STORAGE_ROOT ??
          path.resolve(
            '.work/private-media',
            process.env.MEDIA_BUCKET!,
            new URL(process.env.DATABASE_URI!).pathname.slice(1),
          ),
      );
      const originalBytes = await storage.get(imageReference);
      const sourceSha256 = await sourceFingerprint([
        'src',
        'ops',
        'scripts',
        'public',
        'package.json',
        'pnpm-lock.yaml',
        'next.config.ts',
        'Dockerfile',
      ]);
      const schemaSha256 = await sourceFingerprint(['src/migrations']);
      const source: BackupSource = {
        storage,
        async capture(consume) {
          captures++;
          return withNativeBackupSnapshot(
            {
              payload: fixture.payload,
              directory: runtimePublication().directory,
              capture: (context) => captureBackupMediaInventory(context),
            },
            async (snapshot) => {
              expectedObjects = snapshot.captured.objects;
              expectedRoot = snapshot.root;
              await fixture.payload.update({
                collection: 'cases',
                id: identity.id,
                data: { internalTitle: 'Synthetic encrypted snapshot B' },
                req: await observedRequest('cases', identity.id, await fixture.request()),
                overrideAccess: false,
              });
              lateMedia = (await mediaMetadataFixture(fixture.payload)).id;
              expect(snapshot.captured.mediaIds).toContain(pdf.id);
              expect(snapshot.captured.mediaIds).not.toContain(lateMedia);
              return consume({
                root: snapshot.root,
                objects: snapshot.captured.objects,
                async dump(destination) {
                  await expect(storage.delete(imageReference)).rejects.toThrow(/busy/i);
                  await execOwned({
                    tool: 'pg_dump',
                    args: [
                      '--username=adfl_test',
                      '--dbname=adfl_test_runner',
                      '--format=custom',
                      `--snapshot=${snapshot.snapshotId}`,
                      '--no-owner',
                      '--no-acl',
                    ],
                    outputFile: destination,
                  });
                },
              });
            },
          );
        },
      };
      const backup = await runBackup({
        namespace,
        repository,
        source,
        application: { revision: 'draft-uncommitted', sourceSha256, schemaSha256 },
        recipient: tools.recipient,
        tools: { ageBinary: tools.ageBinary, tarBinary: tools.tarBinary },
      });
      expect(captures).toBe(1);
      expect(backup.marker.complete).toBe(true);
      expect(expectedObjects.length).toBeGreaterThanOrEqual(3);
      let verified = false;
      const restored = await restoreBackup({
        backupId: backup.marker.id,
        repository,
        identityPath: tools.identityPath,
        ageBinary: tools.ageBinary,
        target: {
          environment: 'test',
          sourceDatabaseUri: process.env.DATABASE_URI!,
          siteOrigin: process.env.SITE_ORIGIN!,
          postgres,
        },
        async verifyRestored(context: LocalRestoreContext) {
          targetSummary = {
            databaseName: context.databaseName,
            mediaBucket: context.mediaBucket,
            publicationNamespace: path.basename(context.publicationDirectory),
          };
          const prepared = await config;
          const target = await getPayload({
            key: `encrypted-native-${context.ownerId}`,
            config: {
              ...prepared,
              db: {
                name: 'postgres',
                allowIDOnCreate: false,
                ...postgresAdapter({
                  pool: { connectionString: context.databaseUri },
                  idType: 'uuid',
                  push: false,
                  disableCreateDatabase: true,
                }),
              },
            },
          });
          await registerOwnedPayload(target);
          try {
            expect(
              await target.db.findOne({
                collection: 'cases',
                where: { id: { equals: identity.id } },
              }),
            ).toMatchObject({ internalTitle: 'Synthetic encrypted snapshot A' });
            for (const translation of translations) {
              expect(
                await target.db.findOne({
                  collection: 'case-content',
                  where: { id: { equals: translation.id } },
                }),
              ).toMatchObject({
                locale: translation.locale,
                title: `Synthetic encrypted ${translation.locale} A`,
              });
              const versions = await target.db.findVersions({
                collection: 'case-content',
                where: { parent: { equals: translation.id } },
                pagination: false,
                limit: 0,
              });
              expect(versions.docs).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    version: expect.objectContaining({
                      title: `Synthetic encrypted ${translation.locale} A`,
                    }),
                  }),
                ]),
              );
              const routes = await target.db.find({
                collection: 'case-routes',
                where: { case: { equals: identity.id } },
                pagination: false,
                limit: 0,
              });
              expect(routes.docs).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ locale: translation.locale, slug: translation.slug }),
                ]),
              );
            }
            expect(
              await target.db.findOne({
                collection: 'media',
                where: { id: { equals: lateMedia } },
              }),
            ).toBeNull();
            expect(
              await target.db.findOne({ collection: 'media', where: { id: { equals: pdf.id } } }),
            ).toMatchObject({ state: 'deleted', deletedAt: expect.any(String) });
            const targetStorage = createLocalObjectStorage(context.mediaRoot);
            for (const object of expectedObjects)
              expect(await targetStorage.get(object)).toEqual(await storage.get(object));
            expect(await readPublicRoot(context.publicationDirectory)).toEqual(expectedRoot);
            verified = true;
          } finally {
            await closeOwnedPayload(target);
          }
        },
      });
      expect(verified).toBe(true);
      expect(restored.restoredObjectCount).toBe(expectedObjects.length);
      expect(await storage.get(imageReference)).toEqual(originalBytes);
      expect(
        await fixture.payload.db.findOne({
          collection: 'cases',
          where: { id: { equals: identity.id } },
        }),
      ).toMatchObject({ internalTitle: 'Synthetic encrypted snapshot B' });
      expect(
        await sourceFingerprint([
          'src',
          'ops',
          'scripts',
          'public',
          'package.json',
          'pnpm-lock.yaml',
          'next.config.ts',
          'Dockerfile',
        ]),
      ).toBe(sourceSha256);
      const evidenceDirectory = process.env.ADFL_TEST_ENCRYPTED_BACKUP_EVIDENCE_DIR;
      if (evidenceDirectory) {
        const destination = path.resolve(evidenceDirectory, backup.marker.id + '.age');
        if (!path.isAbsolute(evidenceDirectory))
          throw new Error('Private encrypted evidence path must be absolute');
        await assertPrivateBackupOutput(destination);
        await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
        await copyFile(
          path.join(repository.root, 'sets', backup.marker.id, 'payload.age'),
          destination,
          constants.COPYFILE_EXCL,
        );
        expect(await hashBackupFile(destination)).toEqual({
          byteLength: backup.marker.ciphertext.byteLength,
          sha256: backup.marker.ciphertext.sha256,
        });
        await writeFile(
          path.join(evidenceDirectory, backup.marker.id + '.marker.json'),
          JSON.stringify(backup.marker, null, 2),
          { flag: 'wx', mode: 0o600 },
        );
      }
      await persistProofMetadata({
        event: 'encrypted-native-proof-complete',
        containerId: owned.containerId,
        networkId: owned.networkId,
        runId: process.env.ADFL_TEST_RUN_ID,
        backupId: backup.marker.id,
        sourceRevision: 'draft-uncommitted',
        sourceSha256,
        schemaSha256,
        ciphertextByteLength: backup.marker.ciphertext.byteLength,
        ciphertextSha256: backup.marker.ciphertext.sha256,
        backupDurationMs: backup.durationMs,
        restoreDurationMs: restored.durationMs,
        restoredObjectCount: restored.restoredObjectCount,
        target: targetSummary,
        originalSourcePreserved: true,
        restoredAAfterConcurrentB: true,
        ptEnVersionsRoutesTrashObjectsRootVerified: true,
        actualAgeExecuted: true,
        privateIdentityContentLogged: false,
        realR2Executed: false,
        httpAuthRestoreExecuted: false,
      });
    } finally {
      if (
        path.dirname(repositoryRoot) !== path.resolve('.work/backup-sets') ||
        !/^[a-f0-9]{64}$/.test(path.basename(repositoryRoot))
      )
        throw new Error('Unsafe encrypted native repository cleanup');
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  },
  90_000,
);
