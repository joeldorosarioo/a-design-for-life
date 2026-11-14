import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { backupFileChunks, openBackupInput } from './tools';
import {
  rename,
  lstat,
  mkdir,
  mkdtemp,
  rm,
  open,
  readFile,
  readdir,
  realpath,
  rmdir,
  unlink,
} from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { z } from 'zod';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { withPublicationWriter } from '../../src/helpers/payload/publication-writer';
import {
  backupMarkerSchema,
  backupNamespaceSchema,
  completeBackupMarkerSchema,
  sameNamespace,
  type BackupNamespace,
  type CompleteBackupMarker,
} from './contracts';
import {
  selectExpiredBackups,
  verifyCompletedBackupStream,
  type VerifiedBackupCompletion,
} from './retention';
export type LocalBackupRepository = {
  readonly root: string;
  readonly namespace: BackupNamespace;
  begin(id: string, createdAt: string): Promise<void>;
  upload(id: string, sourcePath: string): Promise<{ byteLength: number; sha256: string }>;
  complete(
    marker: unknown,
    manifest: Uint8Array,
    now: Date,
  ): Promise<{ marker: CompleteBackupMarker; proof: VerifiedBackupCompletion }>;
  list(): Promise<unknown[]>;
  applyRetention(proof: VerifiedBackupCompletion, now: Date): Promise<string[]>;
  stageCompletedSet(id: string, destination: string): Promise<CompleteBackupMarker>;
};
const scopes = new WeakMap<object, { root: string; namespace: BackupNamespace }>();
const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
const within = (base: string, selected: string) => {
  const relative = path.relative(base, selected);
  return (
    !!relative &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
export function localBackupRepositoryDirectory(input: unknown): string {
  const namespace = backupNamespaceSchema.parse(input);
  return path.resolve(
    '.work/backup-sets',
    createHash('sha256').update(JSON.stringify(namespace)).digest('hex'),
  );
}
export function localBackupRepositoryScope(repository: object) {
  const scope = scopes.get(repository);
  if (!scope) throw new Error('Unregistered backup repository');
  return { root: scope.root, namespace: structuredClone(scope.namespace) };
}
export function assertPrivateBackupWorkPath(selected: string): void {
  if (
    !path.isAbsolute(selected) ||
    !within(path.resolve('.work/backup-private'), path.resolve(selected))
  )
    throw new Error('Private backup work path required');
  assertUnlinkedWorkspacePath(selected);
}
async function regularFile(file: string) {
  assertUnlinkedWorkspacePath(file);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
    throw new Error('Backup requires an unlinked regular private file');
  return info;
}
export async function inspectPrivateBackupFile(
  file: string,
): Promise<{ byteLength: number; sha256: string }> {
  if (
    !path.isAbsolute(file) ||
    (!within(path.resolve('.work/backup-private'), file) &&
      !within(path.resolve('.work/backup-sets'), file))
  )
    throw new Error('Private backup file required');
  const info = await regularFile(file);
  let byteLength = 0;
  const hash = createHash('sha256');
  for await (const chunk of ciphertextChunks(file)) {
    byteLength += chunk.length;
    hash.update(chunk);
  }
  if (byteLength !== info.size) throw new Error('Backup file changed while reading');
  return { byteLength, sha256: hash.digest('hex') };
}
async function* ciphertextChunks(file: string) {
  const handle = await openBackupInput(file);
  try {
    yield* backupFileChunks(handle);
  } finally {
    await handle.close();
  }
}
async function syncDirectory(directory: string) {
  if (process.platform !== 'linux') return;
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
// All repository renames run under its writer mutex; existing destinations are never adopted.
async function renameNew(source: string, destination: string) {
  assertUnlinkedWorkspacePath(source);
  assertUnlinkedWorkspacePath(destination);
  const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing) throw new Error('Existing backup destination refused');
  await rename(source, destination);
  await syncDirectory(path.dirname(destination));
  if (path.dirname(source) !== path.dirname(destination)) await syncDirectory(path.dirname(source));
}
async function atomicExclusive(
  file: string,
  bytes: Uint8Array,
  temporaryDirectory = path.dirname(file),
) {
  const temporary = path.join(temporaryDirectory, `${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameNew(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
async function json(file: string) {
  await regularFile(file);
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}
async function copyExclusive(source: string, destination: string) {
  await regularFile(source);
  await pipeline(
    Readable.from(ciphertextChunks(source)),
    createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
  );
  const durable = await open(destination, 'r+');
  try {
    await durable.sync();
  } finally {
    await durable.close();
  }
}
export async function createLocalBackupRepository(options: {
  namespace: BackupNamespace;
  root?: string;
}): Promise<LocalBackupRepository> {
  const namespace = Object.freeze(backupNamespaceSchema.parse(options.namespace));
  const expected = localBackupRepositoryDirectory(namespace);
  const root = options.root ?? expected;
  if (!path.isAbsolute(root) || normalize(path.resolve(root)) !== normalize(expected))
    throw new Error('Backup repository must use its distinct private namespace');
  assertUnlinkedWorkspacePath(root);
  await mkdir(path.dirname(root), { recursive: true, mode: 0o700 });
  const identity = `backup-repository:${normalize(
    path.join(await realpath(path.dirname(root)), path.basename(root)),
  )}`;
  await withPublicationWriter(identity, async () => {
    assertUnlinkedWorkspacePath(root);
    const existing = await lstat(root).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) {
      if (!existing.isDirectory()) throw new Error('Backup repository directory required');
      return;
    }
    const staged = await mkdtemp(
      path.join(path.dirname(root), `begin-${path.basename(expected)}-`),
    );
    await atomicExclusive(
      path.join(staged, 'namespace.json'),
      Buffer.from(JSON.stringify(namespace)),
    );
    await mkdir(path.join(staged, 'sets'), { mode: 0o700 });
    await mkdir(path.join(staged, 'working'), { mode: 0o700 });
    await syncDirectory(staged);
    await renameNew(staged, root);
  });
  const acquired = await lstat(root);
  const canonical = await realpath(root);
  async function ensureOwned() {
    assertUnlinkedWorkspacePath(root);
    const current = await lstat(root);
    if (
      !current.isDirectory() ||
      current.dev !== acquired.dev ||
      current.ino !== acquired.ino ||
      current.birthtimeMs !== acquired.birthtimeMs ||
      (await realpath(root)) !== canonical
    )
      throw new Error('Backup repository identity changed');
  }
  const fence = <T>(operation: () => Promise<T>) =>
    withPublicationWriter(identity, async () => {
      await ensureOwned();
      return operation();
    });
  const working = path.join(root, 'working');
  await fence(async () => {
    const metadata = path.join(root, 'namespace.json');
    if (!sameNamespace(backupNamespaceSchema.parse(await json(metadata)), namespace))
      throw new Error('Foreign backup repository namespace');
    await mkdir(path.join(root, 'sets'), { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    assertUnlinkedWorkspacePath(path.join(root, 'sets'));
    assertUnlinkedWorkspacePath(working);
    await mkdir(working, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (!(await lstat(working)).isDirectory()) throw new Error('Backup working directory required');
  });
  function setDirectory(id: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) ||
      !z.uuid().safeParse(id).success
    )
      throw new Error('Invalid backup set identity');
    return path.join(root, 'sets', id);
  }
  async function readSet(id: string) {
    const directory = setDirectory(id);
    assertUnlinkedWorkspacePath(directory);
    if (!(await lstat(directory)).isDirectory()) throw new Error('Backup set directory required');
    const names = await readdir(directory);
    if (names.some((name) => !['pending.json', 'payload.age', 'complete.json'].includes(name)))
      throw new Error('Unexpected backup set entry');
    const pending = backupMarkerSchema.parse(await json(path.join(directory, 'pending.json')));
    if (pending.complete || pending.id !== id || !sameNamespace(pending.namespace, namespace))
      throw new Error('Foreign pending backup identity');
    if (!names.includes('complete.json')) return pending;
    const complete = completeBackupMarkerSchema.parse(
      await json(path.join(directory, 'complete.json')),
    );
    if (
      complete.id !== id ||
      complete.createdAt !== pending.createdAt ||
      !sameNamespace(complete.namespace, namespace)
    )
      throw new Error('Foreign completed backup identity');
    if (
      (await regularFile(path.join(directory, 'payload.age'))).size !==
      complete.ciphertext.byteLength
    )
      throw new Error('Completed ciphertext is missing or truncated');
    return complete;
  }
  async function listUnlocked() {
    const entries = await readdir(path.join(root, 'sets'), { withFileTypes: true });
    const markers: unknown[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink())
        throw new Error('Unexpected backup set namespace entry');
      markers.push(await readSet(entry.name));
    }
    return markers;
  }
  const proofs = new WeakMap<
    VerifiedBackupCompletion,
    { marker: CompleteBackupMarker; manifest: Buffer }
  >();
  const repository: LocalBackupRepository = {
    root,
    namespace,
    async begin(id, createdAt) {
      return fence(async () => {
        const marker = backupMarkerSchema.parse({
          version: 1,
          id,
          namespace,
          createdAt,
          complete: false,
        });
        const directory = await mkdtemp(path.join(working, 'begin-'));
        await atomicExclusive(
          path.join(directory, 'pending.json'),
          Buffer.from(JSON.stringify(marker)),
        );
        await renameNew(directory, setDirectory(id));
      });
    },
    async upload(id, sourcePath) {
      return fence(async () => {
        assertPrivateBackupWorkPath(sourcePath);
        const current = await readSet(id);
        if (current.complete) throw new Error('Completed backup is immutable');
        const destination = path.join(setDirectory(id), 'payload.age');
        await copyExclusive(sourcePath, destination);
        return inspectPrivateBackupFile(destination);
      });
    },
    async complete(input, manifest, now) {
      return fence(async () => {
        const marker = completeBackupMarkerSchema.parse(input);
        const current = await readSet(marker.id);
        if (
          current.complete ||
          marker.createdAt !== current.createdAt ||
          !sameNamespace(marker.namespace, namespace)
        )
          throw new Error('Backup completion differs from its pending set');
        const manifestBytes = Buffer.from(manifest);
        const file = path.join(setDirectory(marker.id), 'payload.age');
        await regularFile(file);
        const proof = await verifyCompletedBackupStream({
          marker,
          manifest: manifestBytes,
          ciphertext: ciphertextChunks(file),
          now,
        });
        await atomicExclusive(
          path.join(setDirectory(marker.id), 'complete.json'),
          Buffer.from(JSON.stringify(marker)),
          working,
        );
        const actual = await readSet(marker.id);
        if (!actual.complete || JSON.stringify(actual) !== JSON.stringify(marker))
          throw new Error('Backup complete marker readback failed');
        proofs.set(proof, { marker, manifest: manifestBytes });
        return { marker: structuredClone(marker), proof };
      });
    },
    async list() {
      return fence(listUnlocked);
    },
    async applyRetention(proof, now) {
      return fence(async () => {
        const completed = proofs.get(proof);
        if (!completed) throw new Error('Retention requires this repository completion receipt');
        const file = path.join(setDirectory(completed.marker.id), 'payload.age');
        await regularFile(file);
        // Re-read the actual destination under the same repository fence before any deletion.
        await verifyCompletedBackupStream({
          marker: completed.marker,
          manifest: completed.manifest,
          ciphertext: ciphertextChunks(file),
          now,
        });
        const selected = selectExpiredBackups(await listUnlocked(), now, {
          namespace,
          replacement: proof,
        });
        const removed: string[] = [];
        for (const marker of selected) {
          const current = await readSet(marker.id);
          if (!current.complete || JSON.stringify(current) !== JSON.stringify(marker))
            throw new Error('Expired backup identity changed');
          const directory = setDirectory(marker.id);
          const names = ['complete.json', 'payload.age', 'pending.json'];
          for (const name of names) await regularFile(path.join(directory, name));
          const retired = path.join(working, `retired-${randomUUID()}`);
          await renameNew(directory, retired);
          for (const name of names) {
            const file = path.join(retired, name);
            await regularFile(file);
            await unlink(file);
          }
          await rmdir(retired);
          await syncDirectory(working);
          removed.push(marker.id);
        }
        return removed;
      });
    },
    async stageCompletedSet(id, destination) {
      return fence(async () => {
        assertPrivateBackupWorkPath(destination);
        const marker = await readSet(id);
        if (!marker.complete) throw new Error('Only completed backup sets can be restored');
        const source = path.join(setDirectory(id), 'payload.age');
        await copyExclusive(source, destination);
        const actual = await inspectPrivateBackupFile(destination);
        if (
          actual.byteLength !== marker.ciphertext.byteLength ||
          actual.sha256 !== marker.ciphertext.sha256
        )
          throw new Error('Restored ciphertext readback integrity differs');
        return marker;
      });
    },
  };
  const frozen = Object.freeze(repository);
  scopes.set(frozen, { root, namespace });
  return frozen;
}

export async function withPrivateBackupWorkspace<T>(
  prefix: 'run' | 'restore',
  operation: (directory: string) => Promise<T>,
): Promise<T> {
  if (!['run', 'restore'].includes(prefix)) throw new Error('Invalid private backup workspace');
  const base = path.resolve('.work/backup-private');
  assertUnlinkedWorkspacePath(base);
  await mkdir(base, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(base, prefix + '-'));
  const acquired = await lstat(directory);
  let failure: unknown;
  try {
    return await operation(directory);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      assertPrivateBackupWorkPath(directory);
      const current = await lstat(directory);
      if (
        path.dirname(directory) !== base ||
        !path.basename(directory).startsWith(prefix + '-') ||
        !current.isDirectory() ||
        current.ino !== acquired.ino ||
        current.dev !== acquired.dev ||
        current.birthtimeMs !== acquired.birthtimeMs
      )
        throw new Error('Private backup workspace identity changed; cleanup refused');
      await rm(directory, { recursive: true });
    } catch (cleanupError) {
      if (failure !== undefined)
        throw new AggregateError(
          [failure, cleanupError],
          'Backup failed and private workspace cleanup was refused',
        );
      throw cleanupError;
    }
  }
}
