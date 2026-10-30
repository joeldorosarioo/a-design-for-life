import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readPublicRoot, withPublicRootWriter, type PublicRoot } from './public-root';
import { pinPublicRoot, readPinnedPublicRoot } from './render-snapshot';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Unsafe cleanup.');
    await rm(resolved, { recursive: true, force: true });
  }
});
async function directory() {
  const value = await mkdtemp(path.join(tmpdir(), 'portfolio-render-snapshot-'));
  directories.push(value);
  return value;
}
function root(title: string, generation: string = randomUUID()): PublicRoot {
  return {
    generation,
    subjects: { case: { operationId: 'op1', targetRevision: 'r1', value: { title } } },
  };
}
it('keeps captured A readable after current advances to B, without selecting A for the next request', async () => {
  const dir = await directory();
  const a = root('Published A');
  const b = root('Published B');
  await withPublicRootWriter(dir, async (_, commit) => commit(a));
  const captured = (await readPublicRoot(dir))!;
  await expect(
    (async () => {
      const pin = await pinPublicRoot(dir, captured);
      await withPublicRootWriter(dir, async (_, commit) => commit(b));
      return { pinned: await readPinnedPublicRoot(dir, pin), current: await readPublicRoot(dir) };
    })(),
  ).resolves.toEqual({ pinned: a, current: b });
});

it('reuses the immutable generation without replacing its file or changing current', async () => {
  const dir = await directory();
  const published = root('Published');
  const first = await pinPublicRoot(dir, published);
  const file = path.join(dir, 'render-snapshots', `${published.generation}.json`);
  const before = await stat(file);
  await expect(pinPublicRoot(dir, structuredClone(published))).resolves.toEqual(first);
  const after = await stat(file);
  expect([after.ino, after.mtimeMs]).toEqual([before.ino, before.mtimeMs]);
  expect(first.sha256).toBe(
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
  );
  expect(await readdir(path.dirname(file))).toEqual([`${published.generation}.json`]);
  expect(await readPublicRoot(dir)).toBeNull();
});
it('rejects a different body for an already pinned generation without overwriting it', async () => {
  const dir = await directory();
  const a = root('Original');
  const pin = await pinPublicRoot(dir, a);
  await expect(pinPublicRoot(dir, root('Different', a.generation))).rejects.toThrow();
  await expect(readPinnedPublicRoot(dir, pin)).resolves.toEqual(a);
  expect(await readdir(path.join(dir, 'render-snapshots'))).toEqual([`${a.generation}.json`]);
});
it('rejects invalid roots before creating a snapshot directory', async () => {
  const dir = await directory();
  const invalid = { ...root('Invalid'), privateExtra: 'draft' };
  await expect(pinPublicRoot(dir, invalid)).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
});
it('requires a canonical lowercase root generation', async () => {
  const dir = await directory();
  const invalid = root('Invalid', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA');
  await expect(pinPublicRoot(dir, invalid)).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
});
it.each([
  { generation: '../current', sha256: 'a'.repeat(64) },
  { generation: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sha256: '../current' },
  { generation: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sha256: 'A'.repeat(64) },
  { generation: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sha256: 'a'.repeat(64), extra: true },
])('rejects a malformed or expanded pin without touching current (%j)', async (pin) => {
  const dir = await directory();
  const published = root('Current');
  await withPublicRootWriter(dir, async (_, commit) => commit(published));
  await expect(readPinnedPublicRoot(dir, pin)).rejects.toThrow();
  expect(await readdir(dir)).toEqual(['current.json']);
  expect(await readPublicRoot(dir)).toEqual(published);
});
it('does not fall back to current when the pinned file is missing', async () => {
  const dir = await directory();
  const pin = await pinPublicRoot(dir, root('Pinned'));
  const current = root('Current');
  await withPublicRootWriter(dir, async (_, commit) => commit(current));
  await rm(path.join(dir, 'render-snapshots', `${pin.generation}.json`));
  await expect(readPinnedPublicRoot(dir, pin)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readPublicRoot(dir)).toEqual(current);
});
it('rejects a modified snapshot even when it remains valid JSON', async () => {
  const dir = await directory();
  const pin = await pinPublicRoot(dir, root('Original'));
  const file = path.join(dir, 'render-snapshots', `${pin.generation}.json`);
  await writeFile(file, JSON.stringify(root('Modified', pin.generation)));
  await expect(readPinnedPublicRoot(dir, pin)).rejects.toThrow();
});
it('rejects a root whose generation differs from its pin even with a matching digest', async () => {
  const dir = await directory();
  const pin = await pinPublicRoot(dir, root('Original'));
  const serialized = JSON.stringify(root('Other generation'));
  await writeFile(path.join(dir, 'render-snapshots', `${pin.generation}.json`), serialized);
  await expect(
    readPinnedPublicRoot(dir, {
      ...pin,
      sha256: createHash('sha256').update(serialized).digest('hex'),
    }),
  ).rejects.toThrow();
});
it('does not replace a corrupt existing generation with a new candidate', async () => {
  const dir = await directory();
  const published = root('Published');
  const snapshots = path.join(dir, 'render-snapshots');
  await mkdir(snapshots);
  const file = path.join(snapshots, `${published.generation}.json`);
  await writeFile(file, '{broken');
  await expect(pinPublicRoot(dir, published)).rejects.toThrow();
  expect(await readFile(file, 'utf8')).toBe('{broken');
  expect(await readdir(snapshots)).toEqual([`${published.generation}.json`]);
});
it('publishes only one complete candidate when different bodies race for one generation', async () => {
  const dir = await directory();
  const generation = randomUUID();
  const roots = [root('Candidate A', generation), root('Candidate B', generation)];
  const results = await Promise.allSettled(roots.map((value) => pinPublicRoot(dir, value)));
  expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((value) => value.status === 'rejected')).toHaveLength(1);
  const index = results.findIndex((value) => value.status === 'fulfilled');
  const winner = results[index];
  if (winner.status !== 'fulfilled') throw new Error('No winning pin.');
  expect(await readPinnedPublicRoot(dir, winner.value)).toEqual(roots[index]);
  expect(await readdir(path.join(dir, 'render-snapshots'))).toEqual([`${generation}.json`]);
});
it('pins the same complete root concurrently across independent Node processes', async () => {
  const dir = await directory();
  const published = root('Shared complete body');
  const moduleURL = pathToFileURL(path.resolve('src/helpers/payload/render-snapshot.ts')).href;
  const script = `
    const { pinPublicRoot, readPinnedPublicRoot } = await import(${JSON.stringify(moduleURL)});
    process.send('ready');
    process.once('message', async ({directory, root}) => {
      try {
        const pin = await pinPublicRoot(directory, root);
        const readback = await readPinnedPublicRoot(directory, pin);
        process.send({pin, readback}, () => process.disconnect());
      } catch (error) {
        process.stderr.write(String(error));
        process.exitCode = 1;
        process.send({ error: String(error) }, () => process.disconnect());
      }
    });`;
  const children = Array.from({ length: 4 }, () =>
    spawn(
      process.execPath,
      ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', script],
      { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
    ),
  );
  const exits = children.map((child) => once(child, 'exit'));
  const errors: string[] = [];
  children.forEach((child) => child.stderr?.on('data', (value) => errors.push(String(value))));
  try {
    await Promise.all(
      children.map(async (child) => {
        expect((await once(child, 'message', { signal: AbortSignal.timeout(10_000) }))[0]).toBe(
          'ready',
        );
      }),
    );
    const messages = children.map((child) =>
      once(child, 'message', { signal: AbortSignal.timeout(10_000) }),
    );
    for (const child of children) child.send({ directory: dir, root: published });
    const responses = (await Promise.all(messages)).map(
      ([value]) =>
        value as {
          pin: { generation: string; sha256: string };
          readback: PublicRoot;
        },
    );
    expect(responses.every((value) => value.pin.generation === published.generation)).toBe(true);
    expect(new Set(responses.map((value) => value.pin.sha256)).size).toBe(1);
    for (const response of responses) expect(response.readback).toEqual(published);
    expect((await Promise.all(exits)).map(([code]) => code)).toEqual([0, 0, 0, 0]);
    expect(errors).toEqual([]);
    expect(await readdir(path.join(dir, 'render-snapshots'))).toEqual([
      `${published.generation}.json`,
    ]);
  } finally {
    await Promise.all(
      children.map(async (child, index) => {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        await exits[index];
      }),
    );
  }
}, 15_000);
it.skipIf(process.platform === 'win32')(
  'creates private snapshot files and their directory',
  async () => {
    const dir = await directory();
    const pin = await pinPublicRoot(dir, root('Private storage'));
    expect((await stat(path.join(dir, 'render-snapshots'))).mode & 0o777).toBe(0o700);
    expect(
      (await stat(path.join(dir, 'render-snapshots', `${pin.generation}.json`))).mode & 0o777,
    ).toBe(0o600);
  },
);
