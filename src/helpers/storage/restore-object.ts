import 'server-only';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertObjectReference, type StoredObject } from './object-storage';

async function unlinked(selected: string) {
  for (let current = selected; ; current = path.dirname(current)) {
    const item = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (item?.isSymbolicLink()) throw new Error('Linked restore destination refused');
    if (current === path.dirname(current)) break;
  }
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Job-only import capability. Editorial put() keeps generating a new opaque key.
export async function createLocalRestoreObjectWriter(options: { root: string; ownerId: string }) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(options.ownerId)
  )
    throw new Error('Restore requires a fresh owned namespace');
  const parent = path.resolve('.work/private-media', `adfl-test-restore-${options.ownerId}`);
  const expected = path.join(parent, `adfl_test_restore_${options.ownerId.replaceAll('-', '')}`);
  const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
  if (
    !path.isAbsolute(options.root) ||
    normalize(path.resolve(options.root)) !== normalize(expected)
  )
    throw new Error('Restore requires its exact private isolated namespace');
  await unlinked(expected);
  await mkdir(path.dirname(parent), { recursive: true, mode: 0o700 });
  await unlinked(expected);
  // No recursive adoption of the owner namespace, even when it is empty.
  await mkdir(parent, { mode: 0o700 });
  await mkdir(expected, { mode: 0o700 });
  const acquired = await lstat(expected);
  const canonical = await realpath(expected);
  async function ensureOwned() {
    await unlinked(expected);
    const current = await lstat(expected);
    if (
      !current.isDirectory() ||
      current.dev !== acquired.dev ||
      current.ino !== acquired.ino ||
      current.birthtimeMs !== acquired.birthtimeMs ||
      (await realpath(expected)) !== canonical
    )
      throw new Error('Acquired restore directory was replaced');
  }
  async function verifyExisting(reference: StoredObject) {
    const selected = path.join(expected, reference.key);
    const info = await lstat(selected);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error('Restore object must be a regular private file');
    const file = await open(selected, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const bytes = await file.readFile();
      if (bytes.length !== reference.byteLength || hash(bytes) !== reference.sha256)
        throw new Error('Existing restore object differs from its immutable reference');
    } finally {
      await file.close();
    }
  }
  return {
    root: expected,
    async restore(reference: StoredObject, bytes: Uint8Array): Promise<StoredObject> {
      assertObjectReference(reference);
      if (!(bytes instanceof Uint8Array)) throw new Error('Restore requires validated bytes');
      const captured = Buffer.from(bytes);
      const object = {
        key: reference.key,
        byteLength: reference.byteLength,
        sha256: reference.sha256,
      };
      if (captured.length !== object.byteLength || hash(captured) !== object.sha256)
        throw new Error('Restore input integrity failure');
      await ensureOwned();
      const temporary = path.join(expected, `${randomUUID()}.tmp`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        try {
          await file.writeFile(captured);
          await file.sync();
        } finally {
          await file.close();
        }
        await ensureOwned();
        try {
          await link(temporary, path.join(expected, object.key));
        } catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST')
            throw error;
        }
        await verifyExisting(object);
        if (process.platform === 'linux') {
          const directory = await open(expected, 'r');
          try {
            await directory.sync();
          } finally {
            await directory.close();
          }
        }
        return object;
      } finally {
        await unlink(temporary);
      }
    },
  };
}
