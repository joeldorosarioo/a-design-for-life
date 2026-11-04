import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createLocalObjectStorage } from './object-storage';
import { createR2ObjectStorage } from './r2-storage';
import { withObjectStorageRetention } from './object-retention';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) await dispose();
});
async function local() {
  const root = await mkdtemp(path.resolve('.work/media-retention-'));
  cleanup.push(async () => {
    if (
      path.dirname(root) !== path.resolve('.work') ||
      !path.basename(root).startsWith('media-retention-')
    )
      throw new Error('Unsafe cleanup');
    await rm(root, { recursive: true });
  });
  return { root, storage: createLocalObjectStorage(root) };
}
it('refuses physical deletion while source objects are retained and permits it after release', async () => {
  const { storage } = await local();
  const object = await storage.put(new Uint8Array([1, 2, 3]));
  await withObjectStorageRetention(storage, async () => {
    await expect(storage.delete(object)).rejects.toThrow(/busy/i);
    expect(await storage.get(object)).toEqual(new Uint8Array([1, 2, 3]));
  });
  await storage.delete(object);
  expect(await storage.head(object)).toBeNull();
});
it('fences another concrete factory for the same canonical local storage identity', async () => {
  const { storage, root } = await local();
  const object = await storage.put(new Uint8Array([1]));
  const second = createLocalObjectStorage(path.join(root, '.'));
  await withObjectStorageRetention(storage, async () => {
    await expect(second.delete(object)).rejects.toThrow(/busy/i);
  });
  expect(await second.head(object)).toEqual(object);
});
it('keeps immutable puts and reads available while retaining earlier source bytes', async () => {
  const { storage } = await local();
  const old = await storage.put(new Uint8Array([1]));
  await withObjectStorageRetention(storage, async () => {
    const next = await storage.put(new Uint8Array([2]));
    expect(await storage.get(old)).toEqual(new Uint8Array([1]));
    expect(await storage.get(next)).toEqual(new Uint8Array([2]));
  });
});
it('refuses a copied or injected transport instead of manufacturing a retention guarantee', async () => {
  const { storage } = await local();
  let executed = false;
  await expect(
    withObjectStorageRetention({ ...storage }, async () => {
      executed = true;
    }),
  ).rejects.toThrow();
  expect(executed).toBe(false);
});
it('releases the source fence after the backup capture fails', async () => {
  const { storage } = await local();
  const object = await storage.put(new Uint8Array([1]));
  await expect(
    withObjectStorageRetention(storage, async () => {
      throw new Error('Synthetic capture failure');
    }),
  ).rejects.toThrow('Synthetic capture failure');
  await storage.delete(object);
  expect(await storage.head(object)).toBeNull();
});
it('refuses overlapping capture of the same source instead of taking over its lease', async () => {
  const { storage } = await local();
  await withObjectStorageRetention(storage, async () => {
    await expect(withObjectStorageRetention(storage, async () => randomUUID())).rejects.toThrow(
      /busy/i,
    );
  });
});
it('fences actual SDK DELETE across separate factories for the same endpoint/bucket', async () => {
  const objects = new Map<string, { bytes: Buffer; sha256: string }>();
  const methods: string[] = [];
  const server = createServer(async (req, res) => {
    const key = new URL(req.url!, 'http://127.0.0.1').pathname;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    methods.push(req.method!);
    if (req.method === 'PUT') {
      objects.set(key, {
        bytes: Buffer.concat(chunks),
        sha256: String(req.headers['x-amz-meta-sha256']),
      });
      res.writeHead(200);
      res.end();
      return;
    }
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404, { 'content-type': 'application/xml' });
      res.end('<Error><Code>NoSuchKey</Code></Error>');
      return;
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-length': object.bytes.length,
      'x-amz-meta-sha256': object.sha256,
    });
    res.end(req.method === 'HEAD' ? undefined : object.bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No controlled endpoint');
  const options = {
    endpoint: `http://127.0.0.1:${address.port}`,
    bucket: 'isolated-retention',
    accessKeyId: 'synthetic-access',
    secretAccessKey: 'synthetic-secret',
  };
  const first = createR2ObjectStorage(options);
  const second = createR2ObjectStorage(options);
  const object = await first.put(new Uint8Array([1, 2, 3]));
  await withObjectStorageRetention(first, async () => {
    options.bucket = 'changed-retention';
    await expect(second.delete(object)).rejects.toThrow(/busy/i);
    expect(methods).not.toContain('DELETE');
    expect(await first.get(object)).toEqual(new Uint8Array([1, 2, 3]));
  });
  await second.delete(object);
  expect(methods).toContain('DELETE');
  expect(objects.size).toBe(0);
});
