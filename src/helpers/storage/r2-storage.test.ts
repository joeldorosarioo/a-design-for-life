import { createHash } from 'node:crypto';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { createR2ObjectStorage } from './r2-storage';
import type { R2StorageOptions } from './r2-storage';

type Request = { method: string; key: string; bytes: Buffer; headers: IncomingHttpHeaders };
type Object = { bytes: Buffer; sha256: string };
const dispose: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of dispose.splice(0)) await close();
});
async function boundary() {
  const requests: Request[] = [];
  const objects = new Map<string, Object>();
  const state = {
    writeStatus: 200,
    readStatus: 200,
    corrupt: false,
    corruptHead: false,
    disconnect: false,
  };
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    const key = new URL(req.url!, 'http://localhost').pathname.slice('/isolated-media/'.length);
    requests.push({ method: req.method!, key, bytes, headers: req.headers });
    const fail = (status: number, code: string) => {
      res.writeHead(status, { 'content-type': 'application/xml' });
      res.end(`<Error><Code>${code}</Code><Message>Synthetic transport failure</Message></Error>`);
    };
    if (state.disconnect) return req.socket.destroy();
    if (req.method === 'PUT') {
      if (state.writeStatus !== 200)
        return fail(
          state.writeStatus,
          state.writeStatus === 412 ? 'PreconditionFailed' : 'ServiceUnavailable',
        );
      if (objects.has(key) && req.headers['if-none-match'] === '*')
        return fail(412, 'PreconditionFailed');
      objects.set(key, { bytes, sha256: String(req.headers['x-amz-meta-sha256'] ?? '') });
      res.writeHead(200, { etag: '"synthetic-etag"' });
      return res.end();
    }
    if (state.readStatus !== 200) return fail(state.readStatus, 'AccessDenied');
    const object = objects.get(key);
    if (!object) return fail(404, 'NoSuchKey');
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.writeHead(204);
      return res.end();
    }
    const returned = state.corrupt ? Buffer.from([3, 1, 5]) : object.bytes;
    res.writeHead(200, {
      'content-length': returned.byteLength,
      'content-type': 'application/octet-stream',
      'x-amz-meta-sha256':
        state.corruptHead && req.method === 'HEAD' ? 'b'.repeat(64) : object.sha256,
    });
    res.end(req.method === 'HEAD' ? undefined : returned);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  dispose.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No transport address');
  const options: R2StorageOptions = {
    endpoint: `http://127.0.0.1:${address.port}`,
    bucket: 'isolated-media',
    accessKeyId: 'synthetic-test-access',
    secretAccessKey: 'synthetic-test-secret',
  };
  return { requests, objects, state, adapter: createR2ObjectStorage(options), options };
}

it('uploads captured bytes using a signed immutable request and complete integrity metadata', async () => {
  const { requests, adapter } = await boundary();
  const bytes = new Uint8Array([3, 1, 4]);
  const writing = adapter.put(bytes);
  bytes.fill(9);
  const object = await writing;
  expect(requests.map((request) => request.method)).toEqual(['PUT']);
  expect(requests[0].bytes).toEqual(Buffer.from([3, 1, 4]));
  expect(requests[0].key).toMatch(/^[a-f0-9]{64}$/);
  expect(object).toEqual({
    key: requests[0].key,
    byteLength: 3,
    sha256: '9ceed0d818acc42d0318974c548e2251f888f8512bc5c4c70378aa969a883cad',
  });
  expect(requests[0].headers['if-none-match']).toBe('*');
  expect(requests[0].headers['content-md5']).toBe(
    createHash('md5')
      .update(Buffer.from([3, 1, 4]))
      .digest('base64'),
  );
  expect(requests[0].headers['x-amz-meta-sha256']).toBe(object.sha256);
  expect(requests[0].headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
  expect(requests[0].headers['x-amz-acl']).toBeUndefined();
});
it('downloads the accepted bytes through get and legacy read with response integrity checked', async () => {
  const { adapter } = await boundary();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  expect(await adapter.get(object)).toEqual(new Uint8Array([3, 1, 4]));
  expect(await adapter.read(object)).toEqual(new Uint8Array([3, 1, 4]));
});
it.each(['bytes', 'metadata', 'length'] as const)(
  'rejects a downloaded object with corrupt %s',
  async (corruption) => {
    const { adapter, objects, state } = await boundary();
    const object = await adapter.put(new Uint8Array([3, 1, 4]));
    if (corruption === 'bytes') state.corrupt = true;
    if (corruption === 'metadata') objects.get(object.key)!.sha256 = 'b'.repeat(64);
    if (corruption === 'length') object.byteLength = 4;
    await expect(adapter.get(object)).rejects.toThrow('integrity');
  },
);
it('heads remote metadata and verifies body integrity before confirming the reference', async () => {
  const { adapter, requests } = await boundary();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  expect(await adapter.head(object)).toEqual(object);
  expect(requests.map((request) => request.method)).toEqual(['PUT', 'HEAD', 'GET']);
});
it('reports only a missing remote object as absent and preserves access-denied failures', async () => {
  const { adapter, state } = await boundary();
  const absent = { key: 'a'.repeat(64), byteLength: 0, sha256: 'b'.repeat(64) };
  await expect(adapter.head(absent)).resolves.toBeNull();
  state.readStatus = 403;
  await expect(adapter.head(absent)).rejects.toThrow();
});
it('deletes a verified remote object and makes a repeated deletion harmless', async () => {
  const { adapter, objects } = await boundary();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  await adapter.delete(object);
  expect(objects.has(object.key)).toBe(false);
  await expect(adapter.delete(object)).resolves.toBeUndefined();
});
it('rejects contradictory HEAD metadata even when GET returns the expected bytes', async () => {
  const { adapter, state } = await boundary();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  state.corruptHead = true;
  await expect(adapter.head(object)).rejects.toThrow('integrity');
});
it.each([{ key: '../escape' }, { sha256: '' }, { byteLength: -1 }])(
  'rejects a malformed reference without making any request: %j',
  async (invalid) => {
    const { adapter, requests } = await boundary();
    const reference = { key: 'a'.repeat(64), byteLength: 0, sha256: 'b'.repeat(64), ...invalid };
    await expect(adapter.get(reference)).rejects.toThrow('Invalid object reference');
    await expect(adapter.head(reference)).rejects.toThrow('Invalid object reference');
    await expect(adapter.delete(reference)).rejects.toThrow('Invalid object reference');
    expect(requests).toEqual([]);
  },
);
it.each([
  { endpoint: 'http://remote.example' },
  { endpoint: 'https://user:pass@remote.example' },
  { endpoint: 'https://remote.example/bucket' },
  { endpoint: 'https://remote.example?secret=value' },
  { bucket: '' },
  { accessKeyId: '' },
  { secretAccessKey: ' ' },
])('rejects incomplete or unsafe remote configuration before use: %j', async (invalid) => {
  const { options } = await boundary();
  expect(() => createR2ObjectStorage({ ...options, ...invalid })).toThrow(
    'Invalid R2 configuration',
  );
});
it.each([503, 412, 'disconnect'] as const)(
  'does not acknowledge an upload rejected by the external boundary: %s',
  async (failure) => {
    const { adapter, objects, requests, state } = await boundary();
    if (failure === 'disconnect') state.disconnect = true;
    else state.writeStatus = failure;
    await expect(adapter.put(new Uint8Array([3, 1, 4]))).rejects.toThrow();
    expect(objects.size).toBe(0);
    expect(requests.map((request) => request.method)).toEqual(['PUT']);
  },
);
it('rejects corrupt bytes during head and deletion without deleting the remote original', async () => {
  const { adapter, objects, state } = await boundary();
  const object = await adapter.put(new Uint8Array([3, 1, 4]));
  state.corrupt = true;
  await expect(adapter.head(object)).rejects.toThrow('integrity');
  await expect(adapter.delete(object)).rejects.toThrow('integrity');
  expect(objects.has(object.key)).toBe(true);
});
it('round trips an empty object without confusing zero bytes with absence', async () => {
  const { adapter } = await boundary();
  const object = await adapter.put(new Uint8Array());
  expect(object.byteLength).toBe(0);
  expect(await adapter.head(object)).toEqual(object);
  expect(await adapter.get(object)).toEqual(new Uint8Array());
});

it('scopes upload, read, head and delete while keeping manifest keys bare', async () => {
  const { options, objects, requests } = await boundary();
  const adapter = createR2ObjectStorage({ ...options, keyPrefix: 'development/rebuild/media/' });
  const bytes = new Uint8Array([3, 1, 4]);
  const object = await adapter.put(bytes);
  expect(object.key).toMatch(/^[a-f0-9]{64}$/);
  objects.set(object.key, { bytes: Buffer.from([1]), sha256: 'a'.repeat(64) });
  expect(await adapter.get(object)).toEqual(bytes);
  expect(await adapter.head(object)).toEqual(object);
  await adapter.delete(object);
  expect(requests.map(({ method, key }) => [method, key])).toEqual(
    ['PUT', 'GET', 'HEAD', 'GET', 'GET', 'DELETE'].map((method) => [
      method,
      `development/rebuild/media/${object.key}`,
    ]),
  );
  expect([...objects.keys()]).toEqual([object.key]);
});

it('rejects a traversal prefix before creating a transport', async () => {
  const { options, requests } = await boundary();
  expect(() => createR2ObjectStorage({ ...options, keyPrefix: 'media/../shared' })).toThrow(
    'Invalid R2 configuration',
  );
  expect(requests).toEqual([]);
});
