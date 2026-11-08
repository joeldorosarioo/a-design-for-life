import type { PublicRoot } from '../../src/helpers/payload/public-root';
import type { ObjectStorage, StoredObject } from '../../src/helpers/storage/object-storage';
import type { BackupManifest, BackupNamespace, CompleteBackupMarker } from './contracts';
import type { LocalBackupRepository } from './repository';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { publicRootSchema } from '../../src/helpers/payload/public-root';
import { assertObjectReference } from '../../src/helpers/storage/object-storage';
import { withObjectStorageRetention } from '../../src/helpers/storage/object-retention';
import {
  backupApplicationSchema,
  backupManifestSchema,
  backupNamespaceSchema,
  checkedClock,
  sameNamespace,
  validateBackupArchiveManifest,
} from './contracts';
import {
  assertPrivateBackupWorkPath,
  inspectPrivateBackupFile,
  localBackupRepositoryScope,
  withPrivateBackupWorkspace,
} from './repository';
import { createBackupArchive } from './archive';
import { encryptBackupArchive } from './age';
export type BackupSourceSnapshot = {
  root: PublicRoot | null;
  objects: StoredObject[];
  dump: (destination: string) => Promise<void>;
};
export type BackupSource = {
  storage: ObjectStorage;
  capture: <T>(consume: (snapshot: BackupSourceSnapshot) => Promise<T>) => Promise<T>;
};
export type RunBackupOptions = {
  namespace: BackupNamespace;
  repository: LocalBackupRepository;
  source: BackupSource;
  application: BackupManifest['application'];
  recipient: string;
  tools: { ageBinary: string; tarBinary: string };
  now?: () => Date;
};
function overlap(first: string, second: string) {
  const relative = path.relative(first, second);
  return (
    !relative ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}
export async function runBackup(
  options: RunBackupOptions,
): Promise<{ marker: CompleteBackupMarker; removedBackupIds: string[]; durationMs: number }> {
  const started = performance.now();
  const namespace = backupNamespaceSchema.parse(options.namespace);
  const application = backupApplicationSchema.parse(options.application);
  const repository = localBackupRepositoryScope(options.repository);
  if (!sameNamespace(namespace, repository.namespace))
    throw new Error('Source and backup namespaces differ');
  const clock = options.now ?? (() => new Date());
  const createdAt = new Date(checkedClock(clock())).toISOString();
  const id = randomUUID();
  return withPrivateBackupWorkspace('run', async (directory) => {
    const captured = await withObjectStorageRetention(options.source.storage, async (scope) => {
      if (scope.identity.startsWith('object-storage:local:')) {
        const source = scope.identity.slice('object-storage:local:'.length);
        if (
          [repository.root, path.resolve('.work/backup-private')].some(
            (destination) => overlap(source, destination) || overlap(destination, source),
          )
        )
          throw new Error('Backup source and destinations must be physically disjoint');
      }
      await options.repository.begin(id, createdAt);
      return options.source.capture(async (snapshot) => {
        const references = new Map<string, StoredObject>();
        for (const reference of snapshot.objects) {
          assertObjectReference(reference);
          if (reference.byteLength === 0 || references.has(reference.key))
            throw new Error('Invalid or duplicate backup object reference');
          references.set(reference.key, {
            key: reference.key,
            byteLength: reference.byteLength,
            sha256: reference.sha256,
          });
        }
        const databasePath = path.join(directory, 'database.dump');
        await snapshot.dump(databasePath);
        assertPrivateBackupWorkPath(databasePath);
        const dump = await open(databasePath, 'r');
        try {
          const magic = Buffer.alloc(5);
          const read = await dump.read(magic, 0, 5, 0);
          if (read.bytesRead !== 5 || magic.toString('ascii') !== 'PGDMP')
            throw new Error('Backup requires a PostgreSQL custom dump');
        } finally {
          await dump.close();
        }
        const database = {
          path: 'database.dump' as const,
          ...(await inspectPrivateBackupFile(databasePath)),
        };
        let publicRoot: BackupManifest['publicRoot'] = null;
        if (snapshot.root !== null) {
          const root = publicRootSchema.parse(snapshot.root);
          const parent = path.join(directory, 'publication');
          assertPrivateBackupWorkPath(parent);
          await mkdir(parent, { mode: 0o700 });
          const rootPath = path.join(parent, 'current.json');
          await writeFile(rootPath, JSON.stringify(root), { flag: 'wx', mode: 0o600, flush: true });
          publicRoot = {
            path: 'publication/current.json',
            ...(await inspectPrivateBackupFile(rootPath)),
          };
        }
        const objects = [...references.values()].sort((a, b) => a.key.localeCompare(b.key));
        if (objects.length) {
          const objectDirectory = path.join(directory, 'objects');
          assertPrivateBackupWorkPath(objectDirectory);
          await mkdir(objectDirectory, { mode: 0o700 });
          for (const reference of objects) {
            const bytes = await options.source.storage.get(reference);
            if (
              bytes.byteLength !== reference.byteLength ||
              createHash('sha256').update(bytes).digest('hex') !== reference.sha256
            )
              throw new Error('Backup source object integrity failure');
            const file = path.join(objectDirectory, reference.key);
            assertPrivateBackupWorkPath(file);
            await writeFile(file, bytes, { flag: 'wx', mode: 0o600, flush: true });
          }
        }
        return backupManifestSchema.parse({
          version: 1,
          id,
          namespace,
          createdAt,
          application,
          database,
          publicRoot,
          objects,
        });
      });
    });
    const manifestBytes = Buffer.from(JSON.stringify(captured));
    const manifestPath = path.join(directory, 'manifest.json');
    await writeFile(manifestPath, manifestBytes, { flag: 'wx', mode: 0o600, flush: true });
    const entries = [
      { name: 'manifest.json', path: manifestPath },
      { name: 'database.dump', path: path.join(directory, 'database.dump') },
      ...(captured.publicRoot
        ? [
            {
              name: 'publication/current.json',
              path: path.join(directory, 'publication/current.json'),
            },
          ]
        : []),
      ...captured.objects.map((object) => ({
        name: `objects/${object.key}`,
        path: path.join(directory, 'objects', object.key),
      })),
    ];
    const archive = await createBackupArchive({
      entries,
      destination: path.join(directory, 'payload.tar'),
      tarBinary: options.tools.tarBinary,
    });
    validateBackupArchiveManifest({ manifestBytes, entries: archive.entries });
    const encrypted = await encryptBackupArchive({
      sourcePath: archive.path,
      destination: path.join(directory, 'payload.age'),
      recipient: options.recipient,
      ageBinary: options.tools.ageBinary,
    });
    const uploaded = await options.repository.upload(id, encrypted.path);
    if (uploaded.byteLength !== encrypted.byteLength || uploaded.sha256 !== encrypted.sha256)
      throw new Error('Backup upload differs from encrypted source');
    const marker = {
      version: 1 as const,
      id,
      namespace,
      createdAt,
      completedAt: new Date(checkedClock(clock())).toISOString(),
      complete: true as const,
      manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
      ciphertext: {
        key: `sets/${id}/payload.age`,
        byteLength: uploaded.byteLength,
        sha256: uploaded.sha256,
      },
    };
    const completion = await options.repository.complete(marker, manifestBytes, clock());
    const removedBackupIds = await options.repository.applyRetention(completion.proof, clock());
    return {
      marker: completion.marker,
      removedBackupIds,
      durationMs: Math.round(performance.now() - started),
    };
  });
}
