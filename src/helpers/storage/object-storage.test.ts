import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createLocalObjectStorage } from './object-storage';

const roots: string[] = [];
afterEach(async () => {
  const scratch = path.resolve('.work');
  for (const root of roots.splice(0)) {
    if (!root.startsWith(scratch + path.sep)) throw new Error('Invalid test cleanup target');
    await rm(root, { recursive: true, force: true });
  }
});
async function storage() {
  const root = await mkdtemp(path.resolve('.work/media-storage-'));
  roots.push(root);
  return { root, adapter: createLocalObjectStorage(root) };
}
it('persists real bytes privately under an opaque key with integrity metadata', async () => {
  const { root, adapter } = await storage();
  const bytes = new TextEncoder().encode('private synthetic bytes');
  const object = await adapter.put(bytes);
  expect(object.key).toMatch(/^[a-f0-9]{64}$/);
  expect(object).toMatchObject({
    byteLength: 23,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  expect(await readdir(root)).toEqual([object.key]);
  expect(await readFile(path.join(root, object.key))).toEqual(Buffer.from(bytes));
  expect(await adapter.read(object)).toEqual(bytes);
});
it('preserves bytes captured before caller mutation and never overwrites a previous object', async () => {
  const { adapter } = await storage();
  const input = new Uint8Array([1, 2, 3]);
  const firstWrite = adapter.put(input);
  input.fill(9);
  const first = await firstWrite;
  const second = await adapter.put(input);
  expect(second.key).not.toBe(first.key);
  expect(await adapter.read(first)).toEqual(new Uint8Array([1, 2, 3]));
  expect(await adapter.read(second)).toEqual(new Uint8Array([9, 9, 9]));
});
it('rejects traversal and an object whose persisted bytes no longer match its manifest', async () => {
  const { root, adapter } = await storage();
  await expect(adapter.read({ key: '../private', byteLength: 0, sha256: '' })).rejects.toThrow();
  const object = await adapter.put(new Uint8Array([1, 2, 3]));
  await writeFile(path.join(root, object.key), new Uint8Array([9, 2, 3]));
  await expect(adapter.read(object)).rejects.toThrow('integrity');
});
