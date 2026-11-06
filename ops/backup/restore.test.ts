import { createHash, randomUUID } from 'node:crypto';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createLocalObjectStorage } from '../../src/helpers/storage/object-storage';
import {
  createLocalBackupRepository,
  localBackupRepositoryDirectory,
  withPrivateBackupWorkspace,
} from './repository';
import { runBackup, type BackupSource } from './run';
import { restoreBackup } from './restore';
import { createBackupArchive } from './archive';
import { encryptBackupArchive } from './age';
import type { LocalRestoreTargetOptions } from './local-target';
const fixturePath = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
const config = fixturePath
  ? (JSON.parse(await readFile(fixturePath, 'utf8')) as {
      ageBinary: string;
      tarBinary: string;
      recipient: string;
      identityPath: string;
      wrongIdentityPath: string;
    })
  : undefined;
const toolProof = config ? it : it.skip;
const repositories: string[] = [];
const sourceParents: string[] = [];
const now = new Date('2026-12-01T00:00:00.000Z');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
afterEach(async () => {
  for (const root of repositories.splice(0)) {
    if (
      path.dirname(root) !== path.resolve('.work/backup-sets') ||
      !/^[a-f0-9]{64}$/.test(path.basename(root))
    )
      throw new Error('Unsafe repo cleanup');
    await rm(root, { recursive: true, force: true });
  }
  for (const parent of sourceParents.splice(0)) {
    if (
      path.dirname(parent) !== path.resolve('.work/private-media') ||
      !path.basename(parent).startsWith('adfl-test-backup-restore-source-')
    )
      throw new Error('Unsafe source cleanup');
    await rm(parent, { recursive: true, force: true });
  }
});
async function setup() {
  const id = randomUUID();
  const namespace = {
    project: 'a-design-for-life' as const,
    environment: 'test' as const,
    source: `restore-${id}`,
  };
  const repository = await createLocalBackupRepository({ namespace });
  repositories.push(localBackupRepositoryDirectory(namespace));
  const parent = path.resolve('.work/private-media', `adfl-test-backup-restore-source-${id}`);
  sourceParents.push(parent);
  const storage = createLocalObjectStorage(path.join(parent, 'adfl_test_source'));
  const bytes = Buffer.from('synthetic original to restore');
  const reference = await storage.put(bytes);
  const root = {
    generation: id,
    subjects: {
      synthetic: {
        operationId: 'confirmed-A',
        targetRevision: 'revision-A',
        value: { label: 'Synthetic snapshot A' },
      },
    },
  };
  const source: BackupSource = {
    storage,
    async capture(consume) {
      return consume({
        root,
        objects: [reference],
        dump: (destination) =>
          writeFile(destination, 'PGDMP\u0001synthetic unit process boundary', { flag: 'wx' }),
      });
    },
  };
  return { namespace, repository, source, reference, bytes, root };
}
function targetBoundary() {
  let oid = '';
  let calls = 0,
    restores = 0;
  const target: LocalRestoreTargetOptions = {
    environment: 'test',
    sourceDatabaseUri:
      'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
    siteOrigin: 'http://127.0.0.1:3101',
    postgres: {
      async assertOwned() {
        calls++;
        return {
          containerId: 'd'.repeat(64),
          networkId: 'e'.repeat(64),
          runId: '11111111-1111-4111-8111-111111111111',
        };
      },
      async invoke(input) {
        calls++;
        if (input.tool === 'createdb') {
          oid = '12345';
          return '';
        }
        if (input.tool === 'dropdb') {
          oid = '';
          return '';
        }
        if (input.tool === 'pg_restore') {
          expect(input.inputFile).toBeTruthy();
          expect(input.args).toContain('--single-transaction');
          restores++;
          return '';
        }
        const query = input.args.at(-1)!;
        if (query.includes('FROM pg_database')) return oid;
        if (query.includes('information_schema.tables')) return '0';
        throw new Error('Unexpected technical unit command');
      },
    },
  };
  return {
    target,
    get calls() {
      return calls;
    },
    get restores() {
      return restores;
    },
  };
}
async function backup(data: Awaited<ReturnType<typeof setup>>) {
  return runBackup({
    ...data,
    application: {
      revision: 'draft-uncommitted',
      sourceSha256: 'a'.repeat(64),
      schemaSha256: 'b'.repeat(64),
    },
    recipient: config!.recipient,
    tools: { ageBinary: config!.ageBinary, tarBinary: config!.tarBinary },
    now: () => now,
  });
}
it('refuses production before decrypting or contacting any restore target', async () => {
  const data = await setup();
  const boundary = targetBoundary();
  await expect(
    restoreBackup({
      backupId: randomUUID(),
      repository: data.repository,
      identityPath: path.resolve('.work/no-private-key'),
      ageBinary: path.resolve('.work/no-age'),
      target: { ...boundary.target, environment: 'production' } as never,
      async verifyRestored() {},
    }),
  ).rejects.toThrow(/test|production|local/i);
  expect(boundary.calls).toBe(0);
});
it('refuses an injected repository before any target operation', async () => {
  const boundary = targetBoundary();
  await expect(
    restoreBackup({
      backupId: randomUUID(),
      repository: { root: 'fake' } as never,
      identityPath: path.resolve('.work/no-private-key'),
      ageBinary: path.resolve('.work/no-age'),
      target: boundary.target,
      async verifyRestored() {},
    }),
  ).rejects.toThrow(/registered/i);
  expect(boundary.calls).toBe(0);
});
toolProof(
  'decrypts an actual complete set and restores original keys plus the captured public root under the owned target guard',
  async () => {
    const data = await setup();
    const receipt = await backup(data);
    const boundary = targetBoundary();
    let verified = false;
    const restored = await restoreBackup({
      backupId: receipt.marker.id,
      repository: data.repository,
      identityPath: config!.identityPath,
      ageBinary: config!.ageBinary,
      target: boundary.target,
      async verifyRestored(context) {
        expect(await readFile(path.join(context.mediaRoot, data.reference.key))).toEqual(
          data.bytes,
        );
        expect(
          JSON.parse(
            await readFile(path.join(context.publicationDirectory, 'current.json'), 'utf8'),
          ),
        ).toEqual(data.root);
        verified = true;
      },
    });
    expect(verified).toBe(true);
    expect(boundary.restores).toBe(1);
    expect(restored).toMatchObject({
      backupId: receipt.marker.id,
      restoredObjectCount: 1,
      rootGeneration: data.root.generation,
    });
  },
);
toolProof(
  'does not acquire a target when a different valid age identity cannot decrypt the set',
  async () => {
    const data = await setup();
    const receipt = await backup(data);
    const boundary = targetBoundary();
    await expect(
      restoreBackup({
        backupId: receipt.marker.id,
        repository: data.repository,
        identityPath: config!.wrongIdentityPath,
        ageBinary: config!.ageBinary,
        target: boundary.target,
        async verifyRestored() {},
      }),
    ).rejects.toThrow();
    expect(boundary.calls).toBe(0);
  },
);
toolProof('does not acquire a target when stored ciphertext is corrupted', async () => {
  const data = await setup();
  const receipt = await backup(data);
  const file = path.join(data.repository.root, 'sets', receipt.marker.id, 'payload.age');
  const bytes = await readFile(file);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(file, bytes);
  const boundary = targetBoundary();
  await expect(
    restoreBackup({
      backupId: receipt.marker.id,
      repository: data.repository,
      identityPath: config!.identityPath,
      ageBinary: config!.ageBinary,
      target: boundary.target,
      async verifyRestored() {},
    }),
  ).rejects.toThrow();
  expect(boundary.calls).toBe(0);
});
toolProof(
  'does not acquire a target when the private manifest hash differs from its complete marker',
  async () => {
    const data = await setup();
    const receipt = await backup(data);
    await writeFile(
      path.join(data.repository.root, 'sets', receipt.marker.id, 'complete.json'),
      JSON.stringify({ ...receipt.marker, manifestSha256: 'f'.repeat(64) }),
    );
    const boundary = targetBoundary();
    await expect(
      restoreBackup({
        backupId: receipt.marker.id,
        repository: data.repository,
        identityPath: config!.identityPath,
        ageBinary: config!.ageBinary,
        target: boundary.target,
        async verifyRestored() {},
      }),
    ).rejects.toThrow();
    expect(boundary.calls).toBe(0);
  },
);
toolProof(
  'rejects an allowed but unreferenced archive object before acquiring a fresh application target',
  async () => {
    const data = await setup();
    const id = randomUUID();
    await withPrivateBackupWorkspace('run', async (directory) => {
      const dump = Buffer.from('PGDMP\u0001adversarial synthetic fixture');
      const manifest = {
        version: 1,
        id,
        namespace: data.namespace,
        createdAt: now.toISOString(),
        application: { revision: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) },
        database: { path: 'database.dump', byteLength: dump.length, sha256: sha(dump) },
        publicRoot: null,
        objects: [],
      };
      const manifestBytes = Buffer.from(JSON.stringify(manifest));
      await writeFile(path.join(directory, 'manifest.json'), manifestBytes);
      await writeFile(path.join(directory, 'database.dump'), dump);
      await mkdir(path.join(directory, 'objects'));
      const key = 'c'.repeat(64);
      await writeFile(path.join(directory, 'objects', key), 'unreferenced object');
      const archive = await createBackupArchive({
        entries: [
          { name: 'manifest.json', path: path.join(directory, 'manifest.json') },
          { name: 'database.dump', path: path.join(directory, 'database.dump') },
          { name: `objects/${key}`, path: path.join(directory, 'objects', key) },
        ],
        destination: path.join(directory, 'payload.tar'),
        tarBinary: config!.tarBinary,
      });
      const encrypted = await encryptBackupArchive({
        sourcePath: archive.path,
        destination: path.join(directory, 'payload.age'),
        recipient: config!.recipient,
        ageBinary: config!.ageBinary,
      });
      await data.repository.begin(id, now.toISOString());
      await data.repository.upload(id, encrypted.path);
      await data.repository.complete(
        {
          version: 1,
          id,
          namespace: data.namespace,
          createdAt: now.toISOString(),
          completedAt: now.toISOString(),
          complete: true,
          manifestSha256: sha(manifestBytes),
          ciphertext: {
            key: `sets/${id}/payload.age`,
            byteLength: encrypted.byteLength,
            sha256: encrypted.sha256,
          },
        },
        manifestBytes,
        now,
      );
    });
    const boundary = targetBoundary();
    await expect(
      restoreBackup({
        backupId: id,
        repository: data.repository,
        identityPath: config!.identityPath,
        ageBinary: config!.ageBinary,
        target: boundary.target,
        async verifyRestored() {},
      }),
    ).rejects.toThrow(/manifest/i);
    expect(boundary.calls).toBe(0);
  },
);

toolProof(
  'rejects marker application provenance that differs from the encrypted manifest before acquiring a target',
  async () => {
    const data = await setup();
    const receipt = await backup(data);
    const boundary = targetBoundary();
    await writeFile(
      path.join(data.repository.root, 'sets', receipt.marker.id, 'complete.json'),
      JSON.stringify({
        ...receipt.marker,
        application: {
          imageId: 'sha256:' + '9'.repeat(64),
          revision: 'draft-local-alpine3.24',
          schemaSha256: 'b'.repeat(64),
        },
      }),
    );
    await expect(
      restoreBackup({
        backupId: receipt.marker.id,
        repository: data.repository,
        identityPath: config!.identityPath,
        ageBinary: config!.ageBinary,
        target: boundary.target,
        async verifyRestored() {},
      }),
    ).rejects.toThrow('Backup manifest identity differs from its repository');
    expect(boundary.calls).toBe(0);
  },
);
