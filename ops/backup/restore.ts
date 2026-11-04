import type { LocalBackupRepository } from './repository';
import type { LocalRestoreContext, LocalRestoreTargetOptions } from './local-target';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { publicRootSchema } from '../../src/helpers/payload/public-root';
import { sameNamespace, validateBackupArchiveManifest } from './contracts';
import { localBackupRepositoryScope, withPrivateBackupWorkspace } from './repository';
import { decryptBackupArchive } from './age';
import { extractValidatedBackupArchive } from './archive';
import {
  restoreIntoOwnedLocalTarget,
  validateLocalRestoreTargetOptions,
  withOwnedLocalRestoreTarget,
} from './local-target';
export type RestoreBackupOptions = {
  backupId: string;
  repository: LocalBackupRepository;
  identityPath: string;
  ageBinary: string;
  target: LocalRestoreTargetOptions;
  verifyRestored: (context: LocalRestoreContext) => Promise<void>;
};
export async function restoreBackup(options: RestoreBackupOptions): Promise<{
  backupId: string;
  restoredObjectCount: number;
  rootGeneration: string | null;
  durationMs: number;
}> {
  const started = performance.now();
  validateLocalRestoreTargetOptions(options.target);
  const scope = localBackupRepositoryScope(options.repository);
  z.uuid().parse(options.backupId);
  return withPrivateBackupWorkspace('restore', async (directory) => {
    const ciphertext = path.join(directory, 'payload.age');
    const marker = await options.repository.stageCompletedSet(options.backupId, ciphertext);
    const decrypted = await decryptBackupArchive({
      sourcePath: ciphertext,
      destination: path.join(directory, 'payload.tar'),
      identityPath: options.identityPath,
      ageBinary: options.ageBinary,
    });
    const extracted = await extractValidatedBackupArchive({
      archivePath: decrypted.path,
      destination: path.join(directory, 'validated'),
    });
    const manifestEntry = extracted.entries.find((entry) => entry.name === 'manifest.json');
    if (!manifestEntry) throw new Error('Backup private manifest missing');
    const manifestBytes = await readFile(manifestEntry.path);
    if (createHash('sha256').update(manifestBytes).digest('hex') !== marker.manifestSha256)
      throw new Error('Backup private manifest differs from its completion marker');
    const manifest = validateBackupArchiveManifest({
      manifestBytes,
      entries: extracted.entries.map(({ name, byteLength, sha256 }) => ({
        name,
        byteLength,
        sha256,
      })),
    });
    if (
      manifest.id !== marker.id ||
      manifest.createdAt !== marker.createdAt ||
      !sameNamespace(manifest.namespace, marker.namespace) ||
      !sameNamespace(scope.namespace, manifest.namespace)
    )
      throw new Error('Backup manifest identity differs from its repository');
    const entries = new Map(extracted.entries.map((entry) => [entry.name, entry.path]));
    const dumpPath = entries.get('database.dump');
    if (!dumpPath) throw new Error('Backup custom database dump missing');
    const root = manifest.publicRoot
      ? publicRootSchema.parse(
          JSON.parse(await readFile(entries.get('publication/current.json')!, 'utf8')),
        )
      : null;
    const objects = manifest.objects.map((reference) => ({
      reference,
      path: entries.get(`objects/${reference.key}`)!,
    }));
    // Every age/archive/manifest/hash check precedes target acquisition. The
    // lifecycle provider then derives real owned catalog/filesystem observations.
    await withOwnedLocalRestoreTarget(options.target, (target) =>
      restoreIntoOwnedLocalTarget(target, {
        dumpPath,
        objects,
        root,
        verifyRestored: options.verifyRestored,
      }),
    );
    return {
      backupId: manifest.id,
      restoredObjectCount: objects.length,
      rootGeneration: root?.generation ?? null,
      durationMs: Math.round(performance.now() - started),
    };
  });
}
