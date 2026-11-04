import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
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
it('gets captured bytes through the transport boundary without exposing its root', async () => {
  const { adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  const transport = adapter as typeof adapter & {
    get?: (reference: typeof object) => Promise<Uint8Array>;
  };
  expect(await transport.get?.(object)).toEqual(new Uint8Array([3, 1, 4]));
});
it('heads a real object only when its bytes satisfy the complete reference', async () => {
  const { adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  const transport = adapter as typeof adapter & {
    head?: (reference: typeof object) => Promise<typeof object | null>;
  };
  expect(await transport.head?.(object)).toEqual(object);
});
it('reports an explicitly missing object from head', async () => {
  const { adapter } = await storage();
  const missing = { key: 'a'.repeat(64), byteLength: 0, sha256: 'b'.repeat(64) };
  await expect(adapter.head(missing)).resolves.toBeNull();
});
it('deletes only the specified immutable object and leaves another original readable', async () => {
  const { adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  const retained = await adapter.put(new Uint8Array([2, 7, 1]));
  const transport = adapter as typeof adapter & {
    delete?: (reference: typeof object) => Promise<void>;
  };
  await transport.delete?.(object);
  expect(await adapter.head(object)).toBeNull();
  expect(await adapter.read(retained)).toEqual(new Uint8Array([2, 7, 1]));
});
it('makes a repeated technical deletion harmless', async () => {
  const { adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  await adapter.delete(object);
  await expect(adapter.delete(object)).resolves.toBeUndefined();
});
it.skipIf(process.platform === 'win32')(
  'never follows a symbolic object entry even when its target bytes match the reference',
  async () => {
    const { root, adapter } = await storage();
    const object = await adapter.put(new Uint8Array([3, 1, 4]));
    const link = { ...object, key: 'c'.repeat(64) };
    await symlink(path.join(root, object.key), path.join(root, link.key), 'file');
    await expect(adapter.head(link)).rejects.toThrow();
    await expect(adapter.get(link)).rejects.toThrow();
    await expect(adapter.delete(link)).rejects.toThrow();
    expect(await adapter.read(object)).toEqual(new Uint8Array([3, 1, 4]));
  },
);
it('rejects corrupt contents from head and leaves bytes untouched when delete receives a bad reference', async () => {
  const { root, adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  await writeFile(path.join(root, object.key), new Uint8Array([3, 1, 5]));
  await expect(adapter.head(object)).rejects.toThrow('integrity');
  await expect(adapter.delete(object)).rejects.toThrow('integrity');
  expect(await readFile(path.join(root, object.key))).toEqual(Buffer.from([3, 1, 5]));
});
it.each([
  { key: '../escape' },
  { key: 'a'.repeat(63) },
  { sha256: '' },
  { byteLength: -1 },
  { byteLength: 0.5 },
  { byteLength: Number.NaN },
])('rejects a malformed reference before any object operation: %j', async (invalid) => {
  const { adapter } = await storage();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  const reference = { ...object, ...invalid };
  await expect(adapter.get(reference)).rejects.toThrow('Invalid object reference');
  await expect(adapter.head(reference)).rejects.toThrow('Invalid object reference');
  await expect(adapter.delete(reference)).rejects.toThrow('Invalid object reference');
  expect(await adapter.read(object)).toEqual(new Uint8Array([3, 1, 4]));
});
