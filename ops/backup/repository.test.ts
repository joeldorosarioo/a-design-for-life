import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  createLocalBackupRepository,
  localBackupRepositoryDirectory,
  localBackupRepositoryScope,
} from './repository';
const roots: string[] = [];
const scratch: string[] = [];
const now = new Date('2026-12-01T00:00:00.000Z');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== path.resolve('.work/backup-sets') ||
      !/^[a-f0-9]{64}$/.test(path.basename(root))
    )
      throw new Error('Unsafe repo test cleanup');
    await rm(root, { recursive: true, force: true });
  }
  for (const root of scratch.splice(0)) {
    if (
      path.dirname(root) !== path.resolve('.work/backup-private') ||
      !path.basename(root).startsWith('repo-unit-')
    )
      throw new Error('Unsafe private test cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function setup() {
  const namespace = {
    project: 'a-design-for-life' as const,
    environment: 'test' as const,
    source: `unit-${randomUUID()}`,
  };
  const root = localBackupRepositoryDirectory(namespace);
  roots.push(root);
  await mkdir(path.resolve('.work/backup-private'), { recursive: true });
  const privateRoot = await mkdtemp(path.resolve('.work/backup-private/repo-unit-'));
  scratch.push(privateRoot);
  return { repo: await createLocalBackupRepository({ namespace, root }), privateRoot, namespace };
}
async function upload(data: Awaited<ReturnType<typeof setup>>, completedAt = now.toISOString()) {
  const id = randomUUID();
  const bytes = Buffer.from(`synthetic ciphertext fixture ${id}`);
  const source = path.join(data.privateRoot, `${id}.age`);
  await writeFile(source, bytes, { flag: 'wx' });
  const manifest = Buffer.from(
    JSON.stringify({
      version: 1,
      id,
      namespace: data.namespace,
      createdAt: completedAt,
      application: { revision: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) },
      database: { path: 'database.dump', byteLength: 3, sha256: 'c'.repeat(64) },
      publicRoot: null,
      objects: [],
    }),
  );
  const marker = {
    version: 1 as const,
    id,
    namespace: data.namespace,
    createdAt: completedAt,
    completedAt,
    complete: true as const,
    manifestSha256: sha(manifest),
    ciphertext: { key: `sets/${id}/payload.age`, byteLength: bytes.length, sha256: sha(bytes) },
  };
  await data.repo.begin(id, completedAt);
  await data.repo.upload(id, source);
  return { id, bytes, manifest, marker, source };
}
it('publishes a complete marker only after ciphertext upload and verified readback', async () => {
  const data = await setup();
  const set = await upload(data);
  expect(await data.repo.list()).toEqual([
    expect.objectContaining({ id: set.id, complete: false }),
  ]);
  const completion = await data.repo.complete(set.marker, set.manifest, now);
  expect(completion.marker).toEqual(set.marker);
  expect(await data.repo.list()).toEqual([set.marker]);
  expect(await readFile(path.join(data.repo.root, 'sets', set.id, 'payload.age'))).toEqual(
    set.bytes,
  );
  expect((await readdir(path.join(data.repo.root, 'sets', set.id))).sort()).toEqual([
    'complete.json',
    'payload.age',
    'pending.json',
  ]);
});
it('can reopen the same persisted namespace without overwriting completed history', async () => {
  const data = await setup();
  const set = await upload(data);
  await data.repo.complete(set.marker, set.manifest, now);
  const reopened = await createLocalBackupRepository({ namespace: data.namespace });
  expect(await reopened.list()).toEqual([set.marker]);
});
it('never overwrites a set or ciphertext even with the same identity', async () => {
  const data = await setup();
  const set = await upload(data);
  await expect(data.repo.begin(set.id, now.toISOString())).rejects.toThrow();
  await expect(data.repo.upload(set.id, set.source)).rejects.toThrow();
  expect(await readFile(path.join(data.repo.root, 'sets', set.id, 'payload.age'))).toEqual(
    set.bytes,
  );
});
it('refuses completion if destination ciphertext differs from the proposed marker', async () => {
  const data = await setup();
  const set = await upload(data);
  await writeFile(path.join(data.repo.root, 'sets', set.id, 'payload.age'), 'corrupt');
  await expect(data.repo.complete(set.marker, set.manifest, now)).rejects.toThrow();
  expect(await data.repo.list()).toEqual([expect.objectContaining({ complete: false })]);
});
it('refuses completion with a mismatched private manifest', async () => {
  const data = await setup();
  const set = await upload(data);
  await expect(
    data.repo.complete(set.marker, Buffer.from('corrupted manifest'), now),
  ).rejects.toThrow();
  expect(await data.repo.list()).toEqual([expect.objectContaining({ complete: false })]);
});
it('does not permit retention using a forged completion proof', async () => {
  const data = await setup();
  await expect(data.repo.applyRetention({ verified: true } as never, now)).rejects.toThrow();
});
it('does not permit a completion proof issued by another repository', async () => {
  const data = await setup();
  const other = await setup();
  const set = await upload(other);
  const completion = await other.repo.complete(set.marker, set.manifest, now);
  await expect(data.repo.applyRetention(completion.proof, now)).rejects.toThrow();
});
it('deletes only old complete sets after a verified current replacement, keeping recent and incomplete history', async () => {
  const data = await setup();
  const old = await upload(data, '2026-10-05T23:59:59.999Z');
  await data.repo.complete(old.marker, old.manifest, new Date(old.marker.completedAt));
  const boundary = await upload(data, '2026-10-06T00:00:00.000Z');
  await data.repo.complete(
    boundary.marker,
    boundary.manifest,
    new Date(boundary.marker.completedAt),
  );
  const partial = await upload(data, '2026-01-01T00:00:00.000Z');
  const latest = await upload(data);
  const completion = await data.repo.complete(latest.marker, latest.manifest, now);
  expect(await data.repo.applyRetention(completion.proof, now)).toEqual([old.id]);
  expect((await data.repo.list()).map((marker) => (marker as { id: string }).id).sort()).toEqual(
    [boundary.id, partial.id, latest.id].sort(),
  );
});
it('rechecks the replacement ciphertext before deleting any old complete set', async () => {
  const data = await setup();
  const old = await upload(data, '2026-01-01T00:00:00.000Z');
  await data.repo.complete(old.marker, old.manifest, new Date(old.marker.completedAt));
  const latest = await upload(data);
  const completion = await data.repo.complete(latest.marker, latest.manifest, now);
  await writeFile(path.join(data.repo.root, 'sets', latest.id, 'payload.age'), 'corrupted');
  await expect(data.repo.applyRetention(completion.proof, now)).rejects.toThrow();
  expect(await readFile(path.join(data.repo.root, 'sets', old.id, 'payload.age'))).toEqual(
    old.bytes,
  );
});
it('fails closed for foreign or malformed markers without deleting valid history', async () => {
  const data = await setup();
  const old = await upload(data, '2026-01-01T00:00:00.000Z');
  await data.repo.complete(old.marker, old.manifest, new Date(old.marker.completedAt));
  const latest = await upload(data);
  const completion = await data.repo.complete(latest.marker, latest.manifest, now);
  await writeFile(
    path.join(data.repo.root, 'sets', old.id, 'complete.json'),
    JSON.stringify({ ...old.marker, namespace: { ...data.namespace, source: 'foreign-source' } }),
  );
  await expect(data.repo.applyRetention(completion.proof, now)).rejects.toThrow();
  expect(await readFile(path.join(data.repo.root, 'sets', old.id, 'payload.age'))).toEqual(
    old.bytes,
  );
});
it('stages an integrity-checked old completed ciphertext for later isolated restore', async () => {
  const data = await setup();
  const set = await upload(data, '2026-01-01T00:00:00.000Z');
  await data.repo.complete(set.marker, set.manifest, new Date(set.marker.completedAt));
  const destination = path.join(data.privateRoot, 'staged.age');
  expect(await data.repo.stageCompletedSet(set.id, destination)).toEqual(set.marker);
  expect(await readFile(destination)).toEqual(set.bytes);
});
it('refuses to stage an incomplete or corrupted ciphertext', async () => {
  const data = await setup();
  const set = await upload(data);
  await expect(
    data.repo.stageCompletedSet(set.id, path.join(data.privateRoot, 'staged.age')),
  ).rejects.toThrow();
});
it('refuses a foreign repository path before adopting existing data', async () => {
  const data = await setup();
  await expect(
    createLocalBackupRepository({
      namespace: { ...data.namespace, source: 'different-source' },
      root: data.repo.root,
    }),
  ).rejects.toThrow();
});
it('refuses an injected repository instead of returning a trusted physical scope', () => {
  expect(() =>
    localBackupRepositoryScope({
      root: path.resolve('.work/private-media'),
      namespace: {},
    } as never),
  ).toThrow();
});
