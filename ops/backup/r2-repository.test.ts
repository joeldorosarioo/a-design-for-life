import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import path from 'node:path';
import { expect, it } from 'vitest';
import type { Payload } from 'payload';
import { withOperationalBackupLock } from './r2-retention-lock';
import { createR2ObjectStorage } from '../../src/helpers/storage/r2-storage';
import type { LocalRestoreTargetOptions } from './local-target';
import { withPrivateBackupWorkspace } from './repository';
import { runBackup, type BackupSource } from './run';
import { restoreBackup } from './restore';
import {
  createR2BackupReader,
  createR2BackupRepository,
  type R2BackupRepositoryOptions,
} from './r2-repository';

type Request = { method: string; key: string; headers: IncomingHttpHeaders };
type BoundaryState = {
  lostPutResponse?: string;
  overrideRead?: { key: string; bytes: Buffer };
  pageSize?: number;
  repeatedContinuation?: boolean;
  truncatedWithoutToken?: boolean;
  duplicateListingKey?: boolean;
  failDeleteKey?: string;
  lostDeleteResponse?: string;
  beforeRequest?: (request: Request) => void;
};
const bucket = 'adfl-test-backup-r2';
const mediaBucket = 'adfl-test-media-fixture';
const namespace = {
  project: 'a-design-for-life',
  environment: 'test',
  source: 'unit-r2-source',
} as const;
const date = new Date('2026-11-04T00:00:00.000Z');
const bytes = Buffer.from('test-only ciphertext fixture');
const digest = (content: Uint8Array) => createHash('sha256').update(content).digest('hex');
const fixturePath = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
const tools = fixturePath
  ? (JSON.parse(await readFile(fixturePath, 'utf8')) as {
      ageBinary: string;
      tarBinary: string;
      recipient: string;
      identityPath: string;
    })
  : undefined;

async function withBoundary<T>(
  test: (boundary: {
    options: R2BackupRepositoryOptions;
    objects: Map<string, Buffer>;
    mediaRequests: Request[];
    requests: Request[];
    state: BoundaryState;
  }) => Promise<T>,
) {
  const objects = new Map<string, Buffer>();
  const media = new Map<string, Buffer>();
  const mediaRequests: Request[] = [];
  const requests: Request[] = [];
  const state: BoundaryState = {};
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://127.0.0.1');
    const pathname = url.pathname;
    const mediaRequest = pathname.startsWith(`/${mediaBucket}/`);
    const scope = mediaRequest ? mediaBucket : bucket;
    const stored = mediaRequest ? media : objects;
    const key = pathname.slice(`/${scope}/`.length);
    const method = req.method!;
    const request = { method, key, headers: req.headers };
    (mediaRequest ? mediaRequests : requests).push(request);
    state.beforeRequest?.(request);
    function fail(status: number, code: string) {
      res.writeHead(status, { 'content-type': 'application/xml' });
      res.end(`<Error><Code>${code}</Code><Message>Loopback fixture</Message></Error>`);
    }
    if (
      !pathname.startsWith(`/${scope}/`) ||
      !req.headers.authorization?.includes('AWS4-HMAC-SHA256')
    )
      return fail(403, 'AccessDenied');
    if (mediaRequest && !req.headers.authorization.includes('Credential=synthetic-media-access/'))
      return fail(403, 'AccessDenied');
    if (method === 'GET' && url.searchParams.get('list-type') === '2') {
      if (pathname !== `/${bucket}/` || url.searchParams.get('prefix') !== 'sets/')
        return fail(400, 'InvalidRequest');
      const entries = [...objects.keys()].filter((item) => item.startsWith('sets/')).sort();
      const start = Number(url.searchParams.get('continuation-token') ?? '0');
      const page = entries.slice(start, start + (state.pageSize ?? 1000));
      if (state.duplicateListingKey && page.length) page.push(page[0]);
      const next = start + page.length;
      const truncated = state.truncatedWithoutToken || next < entries.length;
      const escape = (text: string) =>
        text
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      const body = page
        .map(
          (item) =>
            `<Contents><Key>${escape(item)}</Key><Size>${objects.get(item)!.length}</Size><ETag>&quot;${createHash('md5').update(objects.get(item)!).digest('hex')}&quot;</ETag></Contents>`,
        )
        .join('');
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(
        `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${bucket}</Name><Prefix>sets/</Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>${truncated ? 'true' : 'false'}</IsTruncated>${truncated && !state.truncatedWithoutToken ? `<NextContinuationToken>${state.repeatedContinuation ? '0' : next}</NextContinuationToken>` : ''}${body}</ListBucketResult>`,
      );
    }
    if (method === 'DELETE') {
      if (
        mediaRequest ||
        !req.headers.authorization.includes('Credential=synthetic-backup-access/')
      )
        return fail(403, 'AccessDenied');
      if (state.failDeleteKey === key) return fail(503, 'ServiceUnavailable');
      stored.delete(key);
      if (state.lostDeleteResponse === key) return res.destroy();
      res.writeHead(204);
      return res.end();
    }
    if (method === 'PUT') {
      if (
        !mediaRequest &&
        !req.headers.authorization.includes('Credential=synthetic-backup-access/')
      )
        return fail(403, 'AccessDenied');
      if (req.headers['if-none-match'] !== '*') return fail(400, 'InvalidRequest');
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      if (
        req.headers['content-md5'] !== createHash('md5').update(bytes).digest('base64') ||
        req.headers['content-length'] !== String(bytes.length)
      )
        return fail(400, 'BadDigest');
      if (stored.has(key)) return fail(412, 'PreconditionFailed');
      stored.set(key, bytes);
      if (!mediaRequest && state.lostPutResponse === key) return res.destroy();
      res.writeHead(200, { etag: '"loopback-etag"' });
      return res.end();
    }
    if (method !== 'GET') return fail(405, 'MethodNotAllowed');
    const object =
      !mediaRequest && state.overrideRead?.key === key ? state.overrideRead.bytes : stored.get(key);
    if (!object) return fail(404, 'NoSuchKey');
    res.writeHead(200, {
      'content-length': object.byteLength,
      ...(mediaRequest ? { 'x-amz-meta-sha256': digest(object) } : {}),
    });
    res.end(object);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback address');
    return await test({
      options: {
        namespace,
        endpoint: `http://127.0.0.1:${address.port}`,
        bucket,
        sourceMediaBucket: mediaBucket,
        accessKeyId: 'synthetic-backup-access',
        secretAccessKey: 'synthetic-backup-secret',
      },
      objects,
      mediaRequests,
      requests,
      state,
    });
  } finally {
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server.closeAllConnections();
    await closed;
  }
}

async function withSet<T>(
  test: (set: ReturnType<typeof fixture> & { file: string; directory: string }) => Promise<T>,
) {
  return withPrivateBackupWorkspace('run', async (directory) => {
    const file = path.join(directory, 'fixture.age');
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    return test({ ...fixture(), file, directory });
  });
}

function fixture() {
  const id = randomUUID();
  const prefix = `sets/${id}`;
  const createdAt = date.toISOString();
  const identity = { version: 1 as const, id, namespace, createdAt };
  const manifest = Buffer.from(
    JSON.stringify({
      ...identity,
      application: { revision: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) },
      database: { path: 'database.dump', byteLength: 3, sha256: 'c'.repeat(64) },
      publicRoot: null,
      objects: [],
    }),
  );
  const marker = {
    ...identity,
    completedAt: createdAt,
    complete: true as const,
    manifestSha256: digest(manifest),
    ciphertext: { key: `${prefix}/payload.age`, byteLength: bytes.length, sha256: digest(bytes) },
  };
  return { id, prefix, createdAt, manifest, marker };
}

it('publishes a completion marker only after reading the uploaded ciphertext through signed S3 HTTP', async () => {
  await withBoundary(async ({ options, objects, requests }) => {
    await withSet(async ({ id, prefix, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      const uploaded = await repository.upload(id, file);
      expect(objects.has(`${prefix}/complete.json`)).toBe(false);
      const complete = await repository.complete(marker, manifest, date);
      expect([...objects.keys()]).toEqual([
        'namespace.json',
        `${prefix}/pending.json`,
        `${prefix}/payload.age`,
        `${prefix}/complete.json`,
      ]);
      expect(uploaded).toEqual({ byteLength: bytes.length, sha256: digest(bytes) });
      expect(complete).toEqual(marker);
      expect(objects.get(`${prefix}/payload.age`)).toEqual(bytes);
      expect(JSON.parse(objects.get(`${prefix}/complete.json`)!.toString())).toEqual(marker);
      const commands = requests.map(({ method, key }) => `${method} ${key}`);
      const markerWrite = commands.indexOf(`PUT ${prefix}/complete.json`);
      expect(commands.indexOf(`GET ${prefix}/payload.age`)).toBeGreaterThan(
        commands.indexOf(`PUT ${prefix}/payload.age`),
      );
      expect(markerWrite).toBeGreaterThan(commands.indexOf(`GET ${prefix}/payload.age`));
      expect(commands.slice(markerWrite + 1)).toContain(`GET ${prefix}/complete.json`);
      expect(repository.retention).toBe('disabled');
    });
  });
});

it('binds completion to the private manifest bytes and time supplied when the caller starts it', async () => {
  await withBoundary(async ({ options }) => {
    await withSet(async ({ id, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      await repository.upload(id, file);
      const invocationTime = new Date(date);
      const result = repository.complete(marker, manifest, invocationTime);
      manifest.fill(0);
      invocationTime.setUTCFullYear(2099);
      await expect(result).resolves.toEqual(marker);
    });
  });
});

it('preserves the original ciphertext across concurrent exclusive uploads and later duplicate writes', async () => {
  await withBoundary(async ({ options, objects, requests }) => {
    await withSet(async ({ id, prefix, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      const uploads = await Promise.allSettled([
        repository.upload(id, file),
        createR2BackupRepository(options).upload(id, file),
      ]);
      expect(uploads.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
      await expect(repository.begin(id, createdAt)).rejects.toThrow();
      await repository.complete(marker, manifest, date);
      await expect(repository.upload(id, file)).rejects.toThrow();
      await expect(repository.complete(marker, manifest, date)).rejects.toThrow();
      expect(objects.get(`${prefix}/payload.age`)).toEqual(bytes);
      expect(JSON.parse(objects.get(`${prefix}/complete.json`)!.toString())).toEqual(marker);
      expect(requests.filter(({ method }) => method !== 'GET' && method !== 'PUT')).toEqual([]);
    });
  });
});

it('leaves the set incomplete when the full remote ciphertext has a different hash', async () => {
  await withBoundary(async ({ options, objects }) => {
    await withSet(async ({ id, prefix, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      await repository.upload(id, file);
      objects.set(`${prefix}/payload.age`, Buffer.alloc(bytes.length, 7));
      await expect(repository.complete(marker, manifest, date)).rejects.toThrow();
      expect(objects.has(`${prefix}/complete.json`)).toBe(false);
    });
  });
});

it('does not report a confirmed completion when the marker write loses its response', async () => {
  await withBoundary(async ({ options, objects, state }) => {
    await withSet(async ({ id, prefix, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      await repository.upload(id, file);
      const key = `${prefix}/complete.json`;
      state.lostPutResponse = key;
      await expect(repository.complete(marker, manifest, date)).rejects.toThrow();
      expect(JSON.parse(objects.get(key)!.toString())).toEqual(marker);
      await expect(repository.complete(marker, manifest, date)).rejects.toThrow();
      expect(JSON.parse(objects.get(key)!.toString())).toEqual(marker);
    });
  });
});

it('does not report a confirmed completion when the remote marker readback disagrees', async () => {
  await withBoundary(async ({ options, state }) => {
    await withSet(async ({ id, prefix, createdAt, manifest, marker, file }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      await repository.upload(id, file);
      state.overrideRead = {
        key: `${prefix}/complete.json`,
        bytes: Buffer.from(JSON.stringify({ ...marker, manifestSha256: 'f'.repeat(64) })),
      };
      await expect(repository.complete(marker, manifest, date)).rejects.toThrow();
    });
  });
});

it('refuses the source-media bucket and a foreign stored namespace before any set write', async () => {
  await withBoundary(async ({ options, objects, requests }) => {
    expect(() => createR2BackupRepository({ ...options, sourceMediaBucket: bucket })).toThrow();
    expect(requests).toEqual([]);
    objects.set('namespace.json', Buffer.from(JSON.stringify({ ...namespace, source: 'foreign' })));
    const repository = createR2BackupRepository(options);
    await expect(repository.begin(randomUUID(), date.toISOString())).rejects.toThrow();
    expect(requests.map(({ method, key }) => `${method} ${key}`)).toEqual(['GET namespace.json']);
  });
});

it('binds the source-media separation check to the bucket used by its S3 client', async () => {
  await withBoundary(async ({ options, requests }) => {
    const sourceMediaBucket = 'adfl-test-backup-source-media';
    let observed = false;
    const divergent = {
      ...options,
      sourceMediaBucket,
      get bucket() {
        if (observed) return sourceMediaBucket;
        observed = true;
        return options.bucket;
      },
    };
    // The scope must use one captured value even if a configuration accessor changes later.
    const repository = createR2BackupRepository(divergent);
    await repository.begin(randomUUID(), date.toISOString());
    expect(requests.map(({ method, key }) => `${method} ${key}`)).toEqual([
      'GET namespace.json',
      'PUT namespace.json',
      'GET namespace.json',
      expect.stringMatching(/^PUT sets\/[a-f0-9-]+\/pending\.json$/),
    ]);
  });
});

function reader(options: R2BackupRepositoryOptions) {
  return createR2BackupReader({
    namespace: options.namespace,
    endpoint: options.endpoint,
    bucket: options.bucket,
    accessKeyId: 'synthetic-recovery-access',
    secretAccessKey: 'synthetic-recovery-secret',
  });
}

it('stages a verified completed set using only signed reads and separate recovery credentials', async () => {
  await withBoundary(async ({ options, requests }) => {
    await withSet(async ({ id, createdAt, manifest, marker, file, directory }) => {
      const repository = createR2BackupRepository(options);
      await repository.begin(id, createdAt);
      await repository.upload(id, file);
      await repository.complete(marker, manifest, date);
      const destination = path.join(directory, 'restored.age');
      const start = requests.length;
      expect(await reader(options).stageCompletedSet(id, destination)).toEqual(marker);
      expect(await readFile(destination)).toEqual(bytes);
      expect(
        requests.slice(start).map(({ method, key, headers }) => ({
          method,
          key,
          recovery: headers.authorization?.includes('Credential=synthetic-recovery-access/'),
        })),
      ).toEqual([
        { method: 'GET', key: 'namespace.json', recovery: true },
        { method: 'GET', key: `sets/${id}/pending.json`, recovery: true },
        { method: 'GET', key: `sets/${id}/complete.json`, recovery: true },
        { method: 'GET', key: `sets/${id}/payload.age`, recovery: true },
      ]);
    });
  });
});

it.each(['incomplete', 'corrupt'] as const)(
  'refuses to expose a staged file for an %s R2 set',
  async (state) => {
    await withBoundary(async ({ options, objects }) => {
      await withSet(async ({ id, prefix, createdAt, manifest, marker, file, directory }) => {
        const repository = createR2BackupRepository(options);
        await repository.begin(id, createdAt);
        await repository.upload(id, file);
        if (state === 'corrupt') {
          await repository.complete(marker, manifest, date);
          objects.set(`${prefix}/payload.age`, Buffer.alloc(bytes.length, 7));
        }
        const destination = path.join(directory, 'restored.age');
        await expect(reader(options).stageCompletedSet(id, destination)).rejects.toThrow();
        expect(await readdir(directory)).toEqual(['fixture.age']);
      });
    });
  },
);

function mediaStorage(options: R2BackupRepositoryOptions, bucket = mediaBucket) {
  return createR2ObjectStorage({
    endpoint: options.endpoint,
    bucket,
    accessKeyId: 'synthetic-media-access',
    secretAccessKey: 'synthetic-media-secret',
  });
}

function runOptions(repository: ReturnType<typeof createR2BackupRepository>, source: BackupSource) {
  return {
    namespace,
    repository,
    source,
    application: { revision: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) },
    recipient: tools?.recipient ?? 'invalid-recipient',
    tools: {
      ageBinary: tools?.ageBinary ?? path.resolve('.work/no-age'),
      tarBinary: tools?.tarBinary ?? path.resolve('.work/no-tar'),
    },
    now: () => date,
  };
}

it('rejects an R2 source identity mismatch before capturing data or contacting the backup bucket', async () => {
  await withBoundary(async ({ options, requests, mediaRequests }) => {
    let captured = false;
    const source: BackupSource = {
      storage: mediaStorage(options, 'adfl-test-foreign-media'),
      async capture() {
        captured = true;
        throw new Error('Backup capture must not start');
      },
    };
    await expect(runBackup(runOptions(createR2BackupRepository(options), source))).rejects.toThrow(
      /registered source media identity/i,
    );
    expect(captured).toBe(false);
    expect(requests).toEqual([]);
    expect(mediaRequests).toEqual([]);
  });
});

it('does not treat a copy of a registered writer as an authorized backup repository', async () => {
  await withBoundary(async ({ options, requests }) => {
    let captured = false;
    const source: BackupSource = {
      storage: mediaStorage(options),
      async capture() {
        captured = true;
        throw new Error('Backup capture must not start');
      },
    };
    await expect(
      runBackup(runOptions({ ...createR2BackupRepository(options) }, source)),
    ).rejects.toThrow(/registered/i);
    expect(captured).toBe(false);
    expect(requests).toEqual([]);
  });
});

function restoreTarget() {
  let oid = '';
  let invocations = 0;
  let restores = 0;
  const target: LocalRestoreTargetOptions = {
    environment: 'test',
    sourceDatabaseUri:
      'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
    siteOrigin: 'http://127.0.0.1:3101',
    postgres: {
      async assertOwned() {
        invocations++;
        return {
          containerId: 'a'.repeat(64),
          networkId: 'b'.repeat(64),
          runId: 'a1111111-1111-4111-8111-111111111111',
        };
      },
      async invoke(input) {
        invocations++;
        if (input.tool === 'createdb') oid = '12345';
        if (input.tool === 'dropdb') oid = '';
        if (input.tool === 'pg_restore') {
          expect(input.args).toContain('--single-transaction');
          expect((await readFile(input.inputFile!)).subarray(0, 5).toString()).toBe('PGDMP');
          restores++;
        }
        const command = input.args.at(-1)!;
        if (command.includes('FROM pg_database')) return oid;
        if (command.includes('information_schema.tables')) return '0';
        return '';
      },
    },
  };
  return { target, invocations: () => invocations, restores: () => restores };
}

it('admits only a registered R2 reader and stages before checking a restore target', async () => {
  await withBoundary(async ({ options, requests }) => {
    await withSet(async ({ id, createdAt, manifest, marker, file }) => {
      const writer = createR2BackupRepository(options);
      await writer.begin(id, createdAt);
      await writer.upload(id, file);
      await writer.complete(marker, manifest, date);
      const approved = reader(options);
      const boundary = restoreTarget();
      const input = {
        backupId: id,
        identityPath: path.resolve('.work/no-private-key'),
        ageBinary: path.resolve('.work/no-age'),
        target: boundary.target,
        async verifyRestored() {},
      };
      const start = requests.length;
      await expect(restoreBackup({ ...input, repository: { ...approved } })).rejects.toThrow(
        /registered/i,
      );
      expect(requests).toHaveLength(start);
      const registered = { ...input, repository: approved };
      const recovery = restoreBackup(registered);
      let unregisteredReaderCalled = false;
      registered.repository = {
        async stageCompletedSet() {
          unregisteredReaderCalled = true;
          throw new Error('Unregistered reader must not be called');
        },
      };
      registered.backupId = randomUUID();
      await expect(recovery).rejects.toThrow();
      expect(unregisteredReaderCalled).toBe(false);
      expect(requests.slice(start).map(({ method, key }) => `${method} ${key}`)).toEqual([
        'GET namespace.json',
        `GET sets/${id}/pending.json`,
        `GET sets/${id}/complete.json`,
        `GET sets/${id}/payload.age`,
      ]);
      expect(boundary.invocations()).toBe(0);
    });
  });
});

it.skipIf(!tools)(
  'backs up a fenced R2 media source and recovers the encrypted set through the existing isolated target',
  async () => {
    await withBoundary(async ({ options, requests, mediaRequests, objects }) => {
      const storage = mediaStorage(options);
      const original = Buffer.from('separate synthetic editorial media');
      const reference = await storage.put(original);
      const root = { generation: randomUUID(), subjects: {} };
      const source: BackupSource = {
        storage,
        async capture(consume) {
          await expect(storage.delete(reference)).rejects.toThrow(/busy/i);
          source.storage = mediaStorage(options, 'adfl-test-foreign-media');
          return consume({
            root,
            objects: [reference],
            dump: (destination) =>
              writeFile(destination, 'PGDMP\u0001synthetic process-boundary fixture', {
                flag: 'wx',
              }),
          });
        },
      };
      const receipt = await runBackup(runOptions(createR2BackupRepository(options), source));
      expect(receipt).toMatchObject({
        marker: { complete: true },
        removedBackupIds: [],
        retention: 'disabled',
      });
      const prefix = `sets/${receipt.marker.id}`;
      expect(objects.get(`${prefix}/payload.age`)?.subarray(0, 22).toString()).toBe(
        'age-encryption.org/v1\n',
      );
      expect(mediaRequests.map(({ method, key }) => `${method} ${key}`)).toEqual([
        `PUT ${reference.key}`,
        `GET ${reference.key}`,
      ]);
      const boundary = restoreTarget();
      let verified = false;
      const start = requests.length;
      const restored = await restoreBackup({
        backupId: receipt.marker.id,
        repository: reader(options),
        identityPath: tools!.identityPath,
        ageBinary: tools!.ageBinary,
        target: boundary.target,
        async verifyRestored(context) {
          expect(await readFile(path.join(context.mediaRoot, reference.key))).toEqual(original);
          expect(
            JSON.parse(
              await readFile(path.join(context.publicationDirectory, 'current.json'), 'utf8'),
            ),
          ).toEqual(root);
          verified = true;
        },
      });
      expect(verified).toBe(true);
      expect(boundary.restores()).toBe(1);
      expect(restored).toMatchObject({
        backupId: receipt.marker.id,
        restoredObjectCount: 1,
        rootGeneration: root.generation,
      });
      expect(
        requests
          .slice(start)
          .every(
            ({ method, headers }) =>
              method === 'GET' &&
              headers.authorization?.includes('Credential=synthetic-recovery-access/'),
          ),
      ).toBe(true);
      expect(requests.every(({ method }) => method === 'PUT' || method === 'GET')).toBe(true);
    });
  },
);

function storeSet(objects: Map<string, Buffer>, completedAt: string, complete = true) {
  const data = fixture();
  const parsed = JSON.parse(data.manifest.toString('utf8'));
  parsed.createdAt = completedAt;
  const manifest = Buffer.from(JSON.stringify(parsed));
  const marker = {
    ...data.marker,
    createdAt: completedAt,
    completedAt,
    manifestSha256: digest(manifest),
  };
  const pending = { version: 1, id: data.id, namespace, createdAt: completedAt, complete: false };
  objects.set(`${data.prefix}/pending.json`, Buffer.from(JSON.stringify(pending)));
  objects.set(`${data.prefix}/payload.age`, Buffer.from(bytes));
  if (complete) objects.set(`${data.prefix}/complete.json`, Buffer.from(JSON.stringify(marker)));
  return { ...data, manifest, marker, pending };
}

async function withLockedRepository<T>(
  options: R2BackupRepositoryOptions,
  consume: (
    repository: ReturnType<typeof createR2BackupRepository>,
    state: { held: boolean; released: boolean },
  ) => Promise<T>,
) {
  const state = { held: true, released: false };
  const client = {
    async query(text: string) {
      if (text.includes('current_database()'))
        return { rows: [{ database: 'adfl_test_retention', version: 170011, pid: 123 }] };
      if (text.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      return { rows: [{ pid: 123, held: state.held }] };
    },
    release() {
      state.released = true;
    },
  };
  return withOperationalBackupLock(
    {
      payload: { db: { pool: { connect: async () => client } } } as unknown as Payload,
      databaseUri: 'postgres://synthetic:synthetic@127.0.0.1:25434/adfl_test_retention',
      namespace,
      backupStorage: { endpoint: options.endpoint, bucket: options.bucket },
    },
    (permit) => consume(createR2BackupRepository({ ...options, retentionLock: permit }), state),
  );
}

async function completedReplacement(
  repository: ReturnType<typeof createR2BackupRepository>,
  file: string,
) {
  const data = fixture();
  await repository.begin(data.id, data.createdAt);
  await repository.upload(data.id, file);
  const marker = await repository.complete(data.marker, data.manifest, date);
  return { ...data, marker };
}

it('deletes only complete sets strictly older than 56 days after a new same-repository readback', async () => {
  await withBoundary(async ({ options, objects, requests }) => {
    await withSet(async ({ file }) => {
      await withLockedRepository(options, async (repository) => {
        const old = storeSet(objects, new Date(date.getTime() - 56 * 86_400_000 - 1).toISOString());
        const boundary = storeSet(
          objects,
          new Date(date.getTime() - 56 * 86_400_000).toISOString(),
        );
        const recent = storeSet(objects, new Date(date.getTime() - 55 * 86_400_000).toISOString());
        const incomplete = storeSet(
          objects,
          new Date(date.getTime() - 80 * 86_400_000).toISOString(),
          false,
        );
        const replacement = await completedReplacement(repository, file);
        const start = requests.length;
        expect(repository.retention).toBe('enabled');
        expect(await repository.applyRetention(replacement.marker, date)).toEqual([old.id]);
        expect(
          requests
            .slice(start)
            .filter((r) => r.method === 'DELETE')
            .map((r) => r.key),
        ).toEqual([
          `${old.prefix}/complete.json`,
          `${old.prefix}/payload.age`,
          `${old.prefix}/pending.json`,
        ]);
        for (const item of [boundary, recent, incomplete, replacement]) {
          expect(objects.get(`${item.prefix}/payload.age`)).toEqual(bytes);
          expect(objects.has(`${item.prefix}/pending.json`)).toBe(true);
        }
        expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
        expect(objects.has('namespace.json')).toBe(true);
        expect([...objects.keys()].filter((key) => key.startsWith(old.prefix))).toEqual([]);
        expect(
          requests
            .filter((r) => r.method === 'DELETE')
            .every((r) => r.headers['if-match'] === undefined),
        ).toBe(true);
      });
    });
  });
});

it('reads every listing page before choosing candidates and deletes the oldest first', async () => {
  await withBoundary(async ({ options, objects, state, requests }) => {
    state.pageSize = 2;
    await withSet(async ({ file }) =>
      withLockedRepository(options, async (repository) => {
        const newer = storeSet(objects, new Date(date.getTime() - 57 * 86_400_000).toISOString());
        const older = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const replacement = await completedReplacement(repository, file);
        expect(await repository.applyRetention(replacement.marker, date)).toEqual([
          older.id,
          newer.id,
        ]);
        expect(requests.filter((r) => r.method === 'GET' && r.key === '').length).toBeGreaterThan(
          1,
        );
        expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
      }),
    );
  });
});

it.each([
  'missing-token',
  'repeated-token',
  'duplicate-key',
  'extra-member',
  'missing-pending',
  'missing-ciphertext',
] as const)('refuses an untrusted %s listing before any deletion', async (corruption) => {
  await withBoundary(async ({ options, objects, state, requests }) => {
    await withSet(async ({ file }) =>
      withLockedRepository(options, async (repository) => {
        const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const replacement = await completedReplacement(repository, file);
        if (corruption === 'missing-token') state.truncatedWithoutToken = true;
        if (corruption === 'repeated-token') {
          state.pageSize = 2;
          state.repeatedContinuation = true;
        }
        if (corruption === 'duplicate-key') state.duplicateListingKey = true;
        if (corruption === 'extra-member') objects.set(`${old.prefix}/unknown.bin`, bytes);
        if (corruption === 'missing-pending') objects.delete(`${old.prefix}/pending.json`);
        if (corruption === 'missing-ciphertext') objects.delete(`${old.prefix}/payload.age`);
        await expect(repository.applyRetention(replacement.marker, date)).rejects.toThrow();
        expect(requests.filter((r) => r.method === 'DELETE')).toEqual([]);
        expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
      }),
    );
  });
});

it('refuses copied, modified, foreign-instance and stale completion receipts', async () => {
  await withBoundary(async ({ options, objects, requests }) => {
    await withSet(async ({ file }) =>
      withLockedRepository(options, async (repository) => {
        storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const replacement = await completedReplacement(repository, file);
        await expect(repository.applyRetention({ ...replacement.marker }, date)).rejects.toThrow();
        const foreign = createR2BackupRepository(options);
        await expect(foreign.applyRetention(replacement.marker, date)).rejects.toThrow();
        await expect(
          repository.applyRetention(replacement.marker, new Date(date.getTime() + 60_001)),
        ).rejects.toThrow();
        replacement.marker.manifestSha256 = 'f'.repeat(64);
        await expect(repository.applyRetention(replacement.marker, date)).rejects.toThrow();
        expect(requests.filter((r) => r.method === 'DELETE')).toEqual([]);
      }),
    );
  });
});

it.each([
  'replacement-marker',
  'replacement-bytes',
  'old-marker',
  'old-bytes',
  'namespace',
  'newer-complete',
  'lock',
] as const)('refuses a changed %s before any historical deletion', async (corruption) => {
  await withBoundary(async ({ options, objects, state, requests }) => {
    await withSet(async ({ file }) =>
      withLockedRepository(options, async (repository, lock) => {
        const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const replacement = await completedReplacement(repository, file);
        if (corruption === 'replacement-marker')
          objects.set(
            `${replacement.prefix}/complete.json`,
            Buffer.from(JSON.stringify({ ...replacement.marker, manifestSha256: 'f'.repeat(64) })),
          );
        if (corruption === 'replacement-bytes')
          objects.set(`${replacement.prefix}/payload.age`, Buffer.alloc(bytes.length, 7));
        if (corruption === 'old-marker')
          objects.set(
            `${old.prefix}/complete.json`,
            Buffer.from(
              JSON.stringify({ ...old.marker, namespace: { ...namespace, source: 'foreign' } }),
            ),
          );
        if (corruption === 'old-bytes')
          objects.set(`${old.prefix}/payload.age`, Buffer.alloc(bytes.length, 7));
        if (corruption === 'namespace')
          objects.set(
            'namespace.json',
            Buffer.from(JSON.stringify({ ...namespace, source: 'foreign' })),
          );
        if (corruption === 'newer-complete')
          storeSet(objects, new Date(date.getTime() + 1).toISOString());
        if (corruption === 'lock')
          state.beforeRequest = (request) => {
            if (request.method === 'GET' && request.key === `${old.prefix}/payload.age`)
              lock.held = false;
          };
        await expect(repository.applyRetention(replacement.marker, date)).rejects.toThrow();
        expect(requests.filter((r) => r.method === 'DELETE')).toEqual([]);
        expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
      }),
    );
  });
});

it.each(['complete.json', 'payload.age', 'pending.json'] as const)(
  'stops a partial %s deletion failure without touching the valid replacement',
  async (member) => {
    await withBoundary(async ({ options, objects, state, requests }) => {
      await withSet(async ({ file }) =>
        withLockedRepository(options, async (repository) => {
          const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
          const replacement = await completedReplacement(repository, file);
          state.failDeleteKey = `${old.prefix}/${member}`;
          await expect(repository.applyRetention(replacement.marker, date)).rejects.toThrow();
          const deleted = requests.filter((r) => r.method === 'DELETE').map((r) => r.key);
          expect(deleted.at(-1)).toBe(state.failDeleteKey);
          expect(objects.get(`${replacement.prefix}/payload.age`)).toEqual(bytes);
          expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
          if (member !== 'complete.json')
            expect(objects.has(`${old.prefix}/complete.json`)).toBe(false);
        }),
      );
    });
  },
);

it('does not retry or remove another member when the deletion acknowledgement is lost', async () => {
  await withBoundary(async ({ options, objects, state, requests }) => {
    await withSet(async ({ file }) =>
      withLockedRepository(options, async (repository) => {
        const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const replacement = await completedReplacement(repository, file);
        state.lostDeleteResponse = `${old.prefix}/complete.json`;
        await expect(repository.applyRetention(replacement.marker, date)).rejects.toThrow();
        expect(requests.filter((r) => r.method === 'DELETE').map((r) => r.key)).toEqual([
          `${old.prefix}/complete.json`,
        ]);
        expect(objects.get(`${old.prefix}/payload.age`)).toEqual(bytes);
        expect(objects.has(`${replacement.prefix}/complete.json`)).toBe(true);
      }),
    );
  });
});

it('does not grant remote retention after its operational callback closes', async () => {
  await withBoundary(async ({ options, requests }) => {
    let retained: ReturnType<typeof createR2BackupRepository> | undefined;
    await withLockedRepository(options, async (repository) => {
      retained = repository;
    });
    await expect(retained!.begin(randomUUID(), date.toISOString())).rejects.toThrow();
    expect(requests).toEqual([]);
  });
});

it.runIf(tools)(
  'applies enabled remote retention only after the actual runBackup encryption and completion readback',
  async () => {
    await withBoundary(async ({ options, objects, requests }) => {
      await withLockedRepository(options, async (repository) => {
        const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        const source: BackupSource = {
          storage: mediaStorage(options),
          async capture(consume) {
            return consume({
              root: null,
              objects: [],
              async dump(destination) {
                await writeFile(
                  destination,
                  Buffer.from('PGDMP\u0001synthetic-retention-boundary-fixture'),
                  { flag: 'wx', mode: 0o600 },
                );
              },
            });
          },
        };
        const result = await runBackup(runOptions(repository, source));
        expect(result.retention).toBe('enabled');
        expect(result.removedBackupIds).toEqual([old.id]);
        const completeKey = `sets/${result.marker.id}/complete.json`;
        const completed = requests.findIndex((r) => r.method === 'PUT' && r.key === completeKey);
        const deleted = requests.findIndex((r) => r.method === 'DELETE');
        expect(completed).toBeGreaterThan(-1);
        expect(deleted).toBeGreaterThan(completed);
        expect(
          requests
            .slice(completed + 1, deleted)
            .some((r) => r.method === 'GET' && r.key === `sets/${result.marker.id}/payload.age`),
        ).toBe(true);
        expect(objects.has(completeKey)).toBe(true);
      });
    });
  },
);

it.runIf(tools)(
  'preserves the previous complete set when runBackup loses the encrypted upload response',
  async () => {
    await withBoundary(async ({ options, objects, requests, state }) => {
      await withLockedRepository(options, async (repository) => {
        const old = storeSet(objects, new Date(date.getTime() - 70 * 86_400_000).toISOString());
        state.beforeRequest = (request) => {
          if (request.method === 'PUT' && request.key.endsWith('/payload.age'))
            state.lostPutResponse = request.key;
        };
        const source: BackupSource = {
          storage: mediaStorage(options),
          async capture(consume) {
            return consume({
              root: null,
              objects: [],
              async dump(destination) {
                await writeFile(
                  destination,
                  Buffer.from('PGDMP\u0001synthetic-retention-upload-failure'),
                  { flag: 'wx', mode: 0o600 },
                );
              },
            });
          },
        };
        await expect(runBackup(runOptions(repository, source))).rejects.toThrow();
        expect(requests.filter((r) => r.method === 'DELETE')).toEqual([]);
        expect(objects.get(`${old.prefix}/payload.age`)).toEqual(bytes);
        expect(JSON.parse(objects.get(`${old.prefix}/complete.json`)!.toString())).toEqual(
          old.marker,
        );
        expect([...objects.keys()].filter((key) => key.endsWith('/complete.json'))).toEqual([
          `${old.prefix}/complete.json`,
        ]);
      });
    });
  },
);
