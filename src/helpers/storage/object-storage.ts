import 'server-only';
import { constants } from 'node:fs';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

export type StoredObject = { key: string; byteLength: number; sha256: string };
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Byte transport only. Callers must authorize before reading an object reference.
export function createLocalObjectStorage(root: string) {
  if (!path.isAbsolute(root)) throw new Error('Storage requires an absolute private root');
  const objectPath = (object: StoredObject) => {
    if (
      !/^[a-f0-9]{64}$/.test(object.key) ||
      !/^[a-f0-9]{64}$/.test(object.sha256) ||
      !Number.isSafeInteger(object.byteLength) ||
      object.byteLength < 0
    )
      throw new Error('Invalid object reference');
    return path.join(root, object.key);
  };
  return {
    async put(bytes: Uint8Array): Promise<StoredObject> {
      const captured = Buffer.from(bytes);
      const object = {
        key: randomBytes(32).toString('hex'),
        byteLength: captured.byteLength,
        sha256: digest(captured),
      };
      await mkdir(root, { recursive: true, mode: 0o700 });
      await writeFile(objectPath(object), captured, { flag: 'wx', mode: 0o600, flush: true });
      return object;
    },
    async read(object: StoredObject): Promise<Uint8Array> {
      const handle = await open(
        objectPath(object),
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size !== object.byteLength)
          throw new Error('Object integrity failure');
        const bytes = await handle.readFile();
        if (bytes.byteLength !== object.byteLength || digest(bytes) !== object.sha256)
          throw new Error('Object integrity failure');
        return new Uint8Array(bytes);
      } finally {
        await handle.close();
      }
    },
  };
}
