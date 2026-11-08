import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readPublicRoot, withPublicRootWriter } from './public-root';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function directory() {
  const dir = await mkdtemp(path.join(tmpdir(), 'portfolio-root-'));
  directories.push(dir);
  return dir;
}
it('persists one complete generation and merges independent subjects from the current disk root', async () => {
  const dir = await directory();
  await withPublicRootWriter(dir, async (_, commit) =>
    commit({
      generation: randomUUID(),
      subjects: { a: { operationId: 'a1', targetRevision: 'r1', value: { title: 'confirmed A' } } },
    }),
  );
  await withPublicRootWriter(dir, async (root, commit) =>
    commit({
      generation: randomUUID(),
      subjects: {
        ...root?.subjects,
        b: { operationId: 'b1', targetRevision: 'r1', value: { title: 'confirmed B' } },
      },
    }),
  );
  expect((await readPublicRoot(dir))?.subjects).toEqual({
    a: { operationId: 'a1', targetRevision: 'r1', value: { title: 'confirmed A' } },
    b: { operationId: 'b1', targetRevision: 'r1', value: { title: 'confirmed B' } },
  });
});
it('preserves the last root when preparation fails and ignores abandoned candidate files', async () => {
  const dir = await directory();
  const root = {
    generation: randomUUID(),
    subjects: { a: { operationId: 'a1', targetRevision: 'r1', value: { title: 'confirmed' } } },
  };
  await withPublicRootWriter(dir, async (_, commit) => commit(root));
  await writeFile(path.join(dir, 'abandoned.tmp'), '{"private":"uncommitted"}');
  await expect(
    withPublicRootWriter(dir, async () => {
      throw new Error('preparation failed');
    }),
  ).rejects.toThrow('preparation failed');
  expect(await readPublicRoot(dir)).toEqual(root);
  expect(await readFile(path.join(dir, 'current.json'), 'utf8')).not.toContain('uncommitted');
});
it('distinguishes missing projection from a corrupt projection', async () => {
  const dir = await directory();
  expect(await readPublicRoot(dir)).toBeNull();
  await writeFile(path.join(dir, 'current.json'), '{broken');
  await expect(readPublicRoot(dir)).rejects.toThrow();
});
