import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { link, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
import {
  backupMarkerSchema,
  backupNamespaceSchema,
  checkedClock,
  completeBackupMarkerSchema,
  sameNamespace,
  type BackupNamespace,
} from './contracts';
import { assertPrivateBackupWorkPath } from './repository';
import { verifyCompletedBackupStream } from './retention';
import { backupFileChunks, openBackupInput } from './tools';

type R2BackupConnection = {
  namespace: BackupNamespace;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};
export type R2BackupRepositoryOptions = R2BackupConnection & { sourceMediaBucket: string };
export type R2BackupRepository = ReturnType<typeof createR2BackupRepository>;
export type R2BackupReader = ReturnType<typeof createR2BackupReader>;
const writerScopes = new WeakMap<
  object,
  Readonly<{
    namespace: BackupNamespace;
    sourceMediaIdentity: string;
  }>
>();
const readerScopes = new WeakMap<object, Readonly<{ namespace: BackupNamespace }>>();

export function r2BackupWriterScope(repository: object) {
  const scope = writerScopes.get(repository);
  if (!scope) throw new Error('Unregistered R2 backup repository');
  return scope;
}

export function r2BackupReaderScope(repository: object) {
  return readerScopes.get(repository);
}

const bucketName = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const cloudflareHost = /^[a-f0-9]{32}(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/;
const setId = z.uuid().regex(/^[a-f0-9-]+$/);
const markerLimit = 16 * 1024;
// Cloudflare's documented single PUT limit is just under 5 GiB.
const ciphertextLimit = 5 * 1024 ** 3 - 1024 ** 2;
const requestBudgetMs = 600_000;
const encoded = (input: unknown) => Buffer.from(JSON.stringify(input));
class MissingBackupObject extends Error {}

function openRepository(options: R2BackupConnection) {
  const namespace = Object.freeze(backupNamespaceSchema.parse(options.namespace));
  const endpoint = URL.parse(options.endpoint);
  const bucket = options.bucket;
  const testEndpoint =
    namespace.environment === 'test' &&
    bucket.startsWith('adfl-test-backup-') &&
    endpoint?.protocol === 'http:' &&
    ['127.0.0.1', '[::1]'].includes(endpoint.hostname);
  const cloudflareEndpoint =
    namespace.environment !== 'test' &&
    endpoint?.protocol === 'https:' &&
    !endpoint.port &&
    cloudflareHost.test(endpoint.hostname);
  if (
    !endpoint ||
    (!testEndpoint && !cloudflareEndpoint) ||
    endpoint.pathname !== '/' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.search ||
    !bucketName.test(bucket) ||
    !options.accessKeyId.trim() ||
    !options.secretAccessKey.trim()
  )
    throw new Error('Invalid backup R2 configuration');

  const client = new S3Client({
    endpoint: endpoint.origin,
    region: 'auto',
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 3_000 },
    // Callers receive fixed diagnostics instead of the SDK logging provider details.
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  });

  async function* read(key: string, maximum: number): AsyncGenerator<Buffer> {
    const signal = AbortSignal.timeout(requestBudgetMs);
    const response = await client
      .send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal })
      .catch((error: unknown) => {
        if (
          error instanceof S3ServiceException &&
          error.name === 'NoSuchKey' &&
          error.$metadata.httpStatusCode === 404
        )
          throw new MissingBackupObject('Backup R2 object is missing');
        throw new Error('Backup R2 read could not be confirmed');
      });
    const body = response.Body;
    if (!(body instanceof Readable)) throw new Error('Backup R2 response has no byte stream');
    const length = response.ContentLength;
    const cancel = () => body.destroy(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (signal.aborted) throw signal.reason;
      if (length === undefined || !Number.isSafeInteger(length) || length < 1 || length > maximum)
        throw new Error('Backup R2 response length is invalid');
      let received = 0;
      for await (const chunk of body) {
        if (!Buffer.isBuffer(chunk)) throw new Error('Backup R2 response did not contain bytes');
        received += chunk.length;
        if (received > length) throw new Error('Backup R2 response exceeded its declared length');
        yield chunk;
      }
      if (received !== length) throw new Error('Backup R2 response was incomplete');
    } finally {
      signal.removeEventListener('abort', cancel);
      body.destroy();
    }
  }

  async function json(key: string): Promise<unknown> {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of read(key, markerLimit)) chunks.push(chunk);
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch (error) {
      if (error instanceof MissingBackupObject) return undefined;
      throw new Error('Backup R2 marker could not be read');
    }
  }

  async function put(
    key: string,
    body: Buffer | Readable,
    byteLength: number,
    md5: string,
  ): Promise<boolean> {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: byteLength,
          ContentMD5: md5,
          ContentType: key.endsWith('.json') ? 'application/json' : 'application/octet-stream',
          IfNoneMatch: '*',
        }),
        { abortSignal: AbortSignal.timeout(requestBudgetMs) },
      );
      return true;
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        error.name === 'PreconditionFailed' &&
        error.$metadata.httpStatusCode === 412
      )
        return false;
      throw new Error('Backup R2 conditional write could not be confirmed');
    }
  }

  function putJson(key: string, input: unknown) {
    const bytes = encoded(input);
    return put(key, bytes, bytes.length, createHash('md5').update(bytes).digest('base64'));
  }

  async function checkNamespace(create: boolean) {
    let persisted = await json('namespace.json');
    if (persisted === undefined && create) {
      await putJson('namespace.json', namespace);
      persisted = await json('namespace.json');
    }
    if (!sameNamespace(backupNamespaceSchema.parse(persisted), namespace))
      throw new Error('Foreign R2 backup namespace');
  }

  function key(id: string, name: 'pending.json' | 'payload.age' | 'complete.json') {
    return `sets/${setId.parse(id)}/${name}`;
  }

  async function pending(id: string) {
    const marker = backupMarkerSchema.parse(await json(key(id, 'pending.json')));
    if (marker.complete || marker.id !== id || !sameNamespace(marker.namespace, namespace))
      throw new Error('Foreign R2 pending set');
    return marker;
  }

  return {
    namespace,
    origin: endpoint.origin,
    bucket,
    read,
    json,
    put,
    putJson,
    checkNamespace,
    key,
    pending,
  };
}

export function createR2BackupRepository(options: R2BackupRepositoryOptions) {
  const { sourceMediaBucket } = options;
  const remote = openRepository(options);
  if (!bucketName.test(sourceMediaBucket) || sourceMediaBucket === remote.bucket)
    throw new Error('Backup and source media require separate R2 buckets');

  const repository = Object.freeze({
    retention: 'disabled' as const,
    async begin(id: string, createdAt: string) {
      const pending = backupMarkerSchema.parse({
        version: 1,
        id: setId.parse(id),
        namespace: remote.namespace,
        createdAt,
        complete: false,
      });
      await remote.checkNamespace(true);
      if (!(await remote.putJson(remote.key(id, 'pending.json'), pending)))
        throw new Error('Backup R2 set already exists');
    },
    async upload(id: string, sourcePath: string) {
      const key = remote.key(id, 'payload.age');
      assertPrivateBackupWorkPath(sourcePath);
      await remote.checkNamespace(false);
      await remote.pending(id);
      if ((await remote.json(remote.key(id, 'complete.json'))) !== undefined)
        throw new Error('Completed backup is immutable');
      const file = await openBackupInput(sourcePath);
      try {
        const info = await file.stat();
        if (info.nlink !== 1 || info.size < 1 || info.size > ciphertextLimit)
          throw new Error('Backup R2 ciphertext exceeds the allowed single upload');
        const sha = createHash('sha256');
        const md5 = createHash('md5');
        let byteLength = 0;
        for await (const chunk of backupFileChunks(file)) {
          byteLength += chunk.length;
          if (byteLength > info.size) throw new Error('Backup ciphertext changed');
          sha.update(chunk);
          md5.update(chunk);
        }
        if (byteLength !== info.size) throw new Error('Backup ciphertext changed');
        const stream = file.createReadStream({ start: 0, end: byteLength - 1, autoClose: false });
        try {
          if (!(await remote.put(key, stream, byteLength, md5.digest('base64'))))
            throw new Error('Backup R2 ciphertext already exists');
        } finally {
          stream.destroy();
        }
        return { byteLength, sha256: sha.digest('hex') };
      } finally {
        await file.close();
      }
    },
    async complete(input: unknown, manifest: Uint8Array, now: Date) {
      const marker = completeBackupMarkerSchema.parse(input);
      const manifestBytes = Buffer.from(manifest);
      const completed = new Date(checkedClock(now));
      if (
        !sameNamespace(marker.namespace, remote.namespace) ||
        marker.ciphertext.byteLength > ciphertextLimit
      )
        throw new Error('Backup completion differs from its R2 namespace or size limit');
      await remote.checkNamespace(false);
      const pending = await remote.pending(marker.id);
      if (pending.createdAt !== marker.createdAt)
        throw new Error('Backup completion differs from its pending set');
      await verifyCompletedBackupStream({
        marker,
        manifest: manifestBytes,
        ciphertext: remote.read(marker.ciphertext.key, marker.ciphertext.byteLength),
        now: completed,
      }).catch(() => {
        throw new Error('Backup R2 ciphertext or private manifest did not verify');
      });
      const key = remote.key(marker.id, 'complete.json');
      if (!(await remote.putJson(key, marker))) throw new Error('Completed backup is immutable');
      const actual = completeBackupMarkerSchema.parse(await remote.json(key));
      if (JSON.stringify(actual) !== JSON.stringify(marker))
        throw new Error('Backup R2 complete marker readback differs');
      return actual;
    },
  });
  writerScopes.set(
    repository,
    Object.freeze({
      namespace: remote.namespace,
      sourceMediaIdentity: `object-storage:r2:${remote.origin}/${sourceMediaBucket}`,
    }),
  );
  return repository;
}

export function createR2BackupReader(options: R2BackupConnection) {
  const remote = openRepository(options);
  const reader = Object.freeze({
    async stageCompletedSet(id: string, destination: string) {
      const key = remote.key(id, 'complete.json');
      assertPrivateBackupWorkPath(destination);
      await remote.checkNamespace(false);
      const pending = await remote.pending(id);
      const marker = completeBackupMarkerSchema.parse(await remote.json(key));
      if (
        marker.id !== id ||
        marker.createdAt !== pending.createdAt ||
        !sameNamespace(marker.namespace, remote.namespace) ||
        marker.ciphertext.byteLength > ciphertextLimit
      )
        throw new Error('Foreign or invalid R2 completed set');
      const temporary = path.join(path.dirname(destination), `${randomUUID()}.tmp`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        const hash = createHash('sha256');
        let byteLength = 0;
        async function* verify() {
          for await (const chunk of remote.read(
            marker.ciphertext.key,
            marker.ciphertext.byteLength,
          )) {
            hash.update(chunk);
            byteLength += chunk.length;
            yield chunk;
          }
        }
        try {
          await file.writeFile(verify());
          if (
            byteLength !== marker.ciphertext.byteLength ||
            hash.digest('hex') !== marker.ciphertext.sha256
          )
            throw new Error('R2 restore ciphertext integrity differs');
          await file.sync();
        } finally {
          await file.close();
        }
        assertPrivateBackupWorkPath(destination);
        await link(temporary, destination);
        return marker;
      } finally {
        await unlink(temporary);
      }
    },
  });
  readerScopes.set(reader, Object.freeze({ namespace: remote.namespace }));
  return reader;
}
