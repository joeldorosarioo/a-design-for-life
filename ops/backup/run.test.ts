import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createLocalObjectStorage } from '../../src/helpers/storage/object-storage';
import { decryptBackupArchive } from './age';
import { extractValidatedBackupArchive } from './archive';
import {
  createLocalBackupRepository,
  localBackupRepositoryDirectory,
  withPrivateBackupWorkspace,
} from './repository';
import { runBackup, type BackupSource } from './run';
const fixturePath = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
const config = fixturePath
  ? (JSON.parse(await readFile(fixturePath, 'utf8')) as {
      ageBinary: string;
      tarBinary: string;
      recipient: string;
      identityPath: string;
    })
  : undefined;
const toolProof = config ? it : it.skip;
const roots: string[] = [];
const sources: string[] = [];
const fixed = new Date('2026-12-01T00:00:00.000Z');
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== path.resolve('.work/backup-sets') ||
      !/^[a-f0-9]{64}$/.test(path.basename(root))
    )
      throw new Error('Unsafe backup test cleanup');
    await rm(root, { recursive: true, force: true });
  }
  for (const root of sources.splice(0)) {
    if (
      path.dirname(root) !== path.resolve('.work/private-media') ||
      !path.basename(root).startsWith('adfl-test-backup-source-')
    )
      throw new Error('Unsafe source cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function setup() {
  const id = randomUUID();
  const namespace = {
    project: 'a-design-for-life' as const,
    environment: 'test' as const,
    source: `creator-${id}`,
  };
  const repository = await createLocalBackupRepository({ namespace });
  roots.push(localBackupRepositoryDirectory(namespace));
  const parent = path.resolve('.work/private-media', `adfl-test-backup-source-${id}`);
  sources.push(parent);
  const storage = createLocalObjectStorage(
    path.join(parent, `adfl_test_source_${id.replaceAll('-', '')}`),
  );
  const object = await storage.put(Buffer.from('synthetic immutable original bytes'));
  const calls = { capture: 0, dump: 0 };
  const root = {
    generation: id,
    subjects: {
      synthetic: {
        operationId: 'synthetic-public-confirmed',
        targetRevision: 'revision-A',
        value: { title: 'SYNTHETIC PRIVATE BACKUP CONTENT' },
      },
    },
  };
  const source: BackupSource = {
    storage,
    async capture(consume) {
      calls.capture++;
      return consume({
        root,
        objects: [object],
        async dump(destination) {
          calls.dump++;
          await writeFile(
            destination,
            Buffer.from('PGDMP\u0001synthetic process-boundary fixture; Native proof is separate'),
            { flag: 'wx', mode: 0o600 },
          );
        },
      });
    },
  };
  return { namespace, repository, source, calls, object };
}
function options(data: Awaited<ReturnType<typeof setup>>) {
  return {
    ...data,
    application: {
      revision: 'draft-uncommitted' as const,
      sourceSha256: 'a'.repeat(64),
      schemaSha256: 'b'.repeat(64),
    },
    recipient: config?.recipient ?? 'age1invalid',
    tools: {
      ageBinary: config?.ageBinary ?? path.resolve('.toolchain/missing-age'),
      tarBinary: config?.tarBinary ?? path.resolve('.toolchain/missing-tar'),
    },
    now: () => fixed,
  };
}
it('refuses unregistered injected source storage before capture or repository changes', async () => {
  const data = await setup();
  const input = options(data);
  input.source = { ...data.source, storage: { ...data.source.storage } };
  await expect(runBackup(input)).rejects.toThrow(/registered|retention/i);
  expect(data.calls.capture).toBe(0);
  expect(await data.repository.list()).toEqual([]);
});
it('refuses source bytes in the backup repository physical namespace before capture', async () => {
  const data = await setup();
  const input = options(data);
  input.source = { ...data.source, storage: createLocalObjectStorage(data.repository.root) };
  await expect(runBackup(input)).rejects.toThrow(/distinct|disjoint/i);
  expect(data.calls.capture).toBe(0);
  expect(await data.repository.list()).toEqual([]);
});
it('refuses a draft without source fingerprint before a source operation', async () => {
  const data = await setup();
  await expect(
    runBackup({
      ...options(data),
      application: { revision: 'draft-uncommitted', schemaSha256: 'b'.repeat(64) } as never,
    }),
  ).rejects.toThrow();
  expect(data.calls.capture).toBe(0);
});
toolProof(
  'creates an actual age encrypted complete set from exact captured bytes under a source deletion fence',
  async () => {
    const data = await setup();
    const capture = data.source.capture;
    data.source.capture = async (consume) => {
      await expect(data.source.storage.delete(data.object)).rejects.toThrow(/busy/i);
      return capture(consume);
    };
    const receipt = await runBackup(options(data));
    expect(receipt.marker.complete).toBe(true);
    expect(receipt.removedBackupIds).toEqual([]);
    expect(data.calls).toEqual({ capture: 1, dump: 1 });
    const directory = path.join(data.repository.root, 'sets', receipt.marker.id);
    const ciphertext = await readFile(path.join(directory, 'payload.age'));
    expect(ciphertext.subarray(0, 22).toString()).toBe('age-encryption.org/v1\n');
    expect(ciphertext.includes(Buffer.from('SYNTHETIC PRIVATE BACKUP CONTENT'))).toBe(false);
    for (const name of ['pending.json', 'complete.json'])
      expect(await readFile(path.join(directory, name), 'utf8')).not.toContain(
        'SYNTHETIC PRIVATE BACKUP CONTENT',
      );
    expect(await data.source.storage.get(data.object)).toEqual(
      new Uint8Array(Buffer.from('synthetic immutable original bytes')),
    );
  },
);
toolProof(
  'does not delete the previous valid set when a later ciphertext upload fails',
  async () => {
    const data = await setup();
    let clock = new Date('2026-01-01T00:00:00.000Z');
    const old = await runBackup({ ...options(data), now: () => clock });
    clock = fixed;
    const capture = data.source.capture;
    data.source.capture = async (consume) => {
      const pending = (await data.repository.list()).find(
        (marker) => !(marker as { complete: boolean }).complete,
      ) as { id: string };
      await mkdir(path.join(data.repository.root, 'sets', pending.id, 'payload.age'));
      return capture(consume);
    };
    await expect(runBackup({ ...options(data), now: () => clock })).rejects.toThrow();
    expect(
      await readFile(path.join(data.repository.root, 'sets', old.marker.id, 'payload.age')),
    ).toBeInstanceOf(Buffer);
    expect(
      (await data.repository.list()).filter((marker) => (marker as { complete: boolean }).complete),
    ).toEqual([old.marker]);
  },
);
toolProof(
  'retains recent history and removes old encrypted sets only after the new complete set is verified',
  async () => {
    const data = await setup();
    const old = await runBackup({
      ...options(data),
      now: () => new Date('2026-10-05T23:59:59.999Z'),
    });
    const latest = await runBackup(options(data));
    expect(latest.removedBackupIds).toEqual([old.marker.id]);
    expect(await data.repository.list()).toEqual([latest.marker]);
  },
);
toolProof('recovers archived media after physically deleting its source object', async () => {
  const data = await setup();
  const original = await data.source.storage.get(data.object);
  const { marker } = await runBackup(options(data));
  expect(await data.repository.list()).toEqual([marker]);

  await data.source.storage.delete(data.object);
  expect(await data.source.storage.head(data.object)).toBeNull();
  expect(await data.repository.list()).toEqual([marker]);

  await withPrivateBackupWorkspace('restore', async (directory) => {
    const ciphertext = path.join(directory, 'payload.age');
    expect(await data.repository.stageCompletedSet(marker.id, ciphertext)).toEqual(marker);
    const decrypted = await decryptBackupArchive({
      sourcePath: ciphertext,
      destination: path.join(directory, 'payload.tar'),
      identityPath: config!.identityPath,
      ageBinary: config!.ageBinary,
    });
    const destination = path.join(directory, 'validated');
    const archive = await extractValidatedBackupArchive({
      archivePath: decrypted.path,
      destination,
    });
    const objectName = `objects/${data.object.key}`;
    expect(archive.entries).toContainEqual(
      expect.objectContaining({
        name: objectName,
        byteLength: data.object.byteLength,
        sha256: data.object.sha256,
      }),
    );
    expect(await readFile(path.join(destination, objectName))).toEqual(Buffer.from(original));
  });
});
it('rejects a non-custom database dump before any completion marker', async () => {
  const data = await setup();
  data.source.capture = async (consume) =>
    consume({
      root: null,
      objects: [data.object],
      dump: (destination) =>
        writeFile(destination, 'plain SQL is not a custom dump', { flag: 'wx' }),
    });
  await expect(runBackup(options(data))).rejects.toThrow(/dump/i);
  expect(
    (await data.repository.list()).every((marker) => !(marker as { complete: boolean }).complete),
  ).toBe(true);
});
