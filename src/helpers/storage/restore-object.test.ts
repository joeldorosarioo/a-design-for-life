import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createLocalRestoreObjectWriter } from './restore-object';
import { createLocalObjectStorage } from './object-storage';

const parents: string[] = [];
function fresh() {
  const ownerId = randomUUID();
  const parent = path.resolve('.work/private-media', `adfl-test-restore-${ownerId}`);
  parents.push(parent);
  return { ownerId, root: path.join(parent, `adfl_test_restore_${ownerId.replaceAll('-', '')}`) };
}
const bytes = Buffer.from('original immutable backup bytes');
function reference(input = bytes) {
  return {
    key: 'a'.repeat(64),
    byteLength: input.length,
    sha256: createHash('sha256').update(input).digest('hex'),
  };
}
afterEach(async () => {
  for (const parent of parents.splice(0)) {
    if (
      path.dirname(parent) !== path.resolve('.work/private-media') ||
      !/^adfl-test-restore-[a-f0-9-]+$/.test(path.basename(parent))
    )
      throw new Error('Unsafe owned restore test cleanup');
    await rm(parent, { recursive: true, force: true });
  }
});
it('restores captured bytes under the original immutable key in a newly owned private namespace', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  expect(await writer.restore(reference(), bytes)).toEqual(reference());
  expect(await readdir(options.root)).toEqual(['a'.repeat(64)]);
  expect(await createLocalObjectStorage(options.root).get(reference())).toEqual(
    new Uint8Array(bytes),
  );
});
it('makes an identical repeated restoration idempotent without rewriting existing bytes', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  await writer.restore(reference(), bytes);
  const before = await stat(path.join(options.root, reference().key));
  await writer.restore(reference(), bytes);
  const after = await stat(path.join(options.root, reference().key));
  expect(after.mtimeMs).toBe(before.mtimeMs);
  expect(await readFile(path.join(options.root, reference().key))).toEqual(bytes);
});
it('refuses a divergent object under the same key and preserves the original', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  await writer.restore(reference(), bytes);
  const changed = Buffer.from('divergent immutable bytes');
  await expect(writer.restore(reference(changed), changed)).rejects.toThrow();
  expect(await readFile(path.join(options.root, reference().key))).toEqual(bytes);
});
it('validates input integrity before creating an object', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  await expect(writer.restore(reference(), Buffer.from('corrupted'))).rejects.toThrow();
  expect(await readdir(options.root)).toEqual([]);
});
it.each([{ key: '../outside' }, { sha256: 'invalid' }, { byteLength: -1 }, { byteLength: 1.5 }])(
  'refuses malformed references before writing: %j',
  async (changed) => {
    const options = fresh();
    const writer = await createLocalRestoreObjectWriter(options);
    await expect(writer.restore({ ...reference(), ...changed }, bytes)).rejects.toThrow();
    expect(await readdir(options.root)).toEqual([]);
  },
);
it('refuses to adopt a pre-existing destination even when empty', async () => {
  const options = fresh();
  await mkdir(options.root, { recursive: true });
  await writeFile(path.join(path.dirname(options.root), 'owner-sentinel'), 'existing owner');
  await expect(createLocalRestoreObjectWriter(options)).rejects.toThrow();
  expect(await readFile(path.join(path.dirname(options.root), 'owner-sentinel'), 'utf8')).toBe(
    'existing owner',
  );
});
it.each([
  'public/private',
  '.next/static/private',
  '.work/private-media/adfl-test-existing/adfl_test_existing',
])('refuses a destination outside the exact fresh restore namespace: %s', async (selected) => {
  await expect(
    createLocalRestoreObjectWriter({ root: path.resolve(selected), ownerId: randomUUID() }),
  ).rejects.toThrow();
});
it('captures bytes before the caller mutates the input', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  const input = Buffer.from(bytes);
  const pending = writer.restore(reference(), input);
  input.fill(9);
  await pending;
  expect(await readFile(path.join(options.root, reference().key))).toEqual(bytes);
});
it('allows concurrent identical writes only after complete bytes are visible', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  await Promise.all([writer.restore(reference(), bytes), writer.restore(reference(), bytes)]);
  expect(await readdir(options.root)).toEqual(['a'.repeat(64)]);
  expect(await readFile(path.join(options.root, reference().key))).toEqual(bytes);
});
it('refuses a root replaced after acquisition', async () => {
  const options = fresh();
  const writer = await createLocalRestoreObjectWriter(options);
  await rename(options.root, `${options.root}-original`);
  await mkdir(options.root);
  await expect(writer.restore(reference(), bytes)).rejects.toThrow();
  expect(await readdir(options.root)).toEqual([]);
});
it('refuses a linked ancestor without touching its destination', async () => {
  const options = fresh();
  const real = fresh();
  await mkdir(real.root, { recursive: true });
  await symlink(
    path.dirname(real.root),
    path.dirname(options.root),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(createLocalRestoreObjectWriter(options)).rejects.toThrow();
  expect(await readdir(real.root)).toEqual([]);
});
