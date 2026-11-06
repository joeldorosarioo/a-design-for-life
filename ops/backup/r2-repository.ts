import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { link, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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
  type CompleteBackupMarker,
} from './contracts';
import { assertPrivateBackupWorkPath } from './repository';
import {
  selectExpiredBackups,
  verifyCompletedBackupStream,
  type VerifiedBackupCompletion,
} from './retention';
import { withR2RetentionLock, type OperationalBackupLockPermit } from './r2-retention-lock';
import { backupFileChunks, openBackupInput } from './tools';

type R2BackupConnection = {
  namespace: BackupNamespace;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};
export type R2BackupRepositoryOptions = R2BackupConnection & {
  sourceMediaBucket: string;
  retentionLock?: OperationalBackupLockPermit;
};
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

  async function listKeys() {
    const keys = new Map<string, number>();
    const tokens = new Set<string>();
    let continuation: string | undefined;
    while (true) {
      const result = await client
        .send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: 'sets/',
            MaxKeys: 1000,
            ...(continuation ? { ContinuationToken: continuation } : {}),
          }),
          { abortSignal: AbortSignal.timeout(requestBudgetMs) },
        )
        .catch(() => {
          throw new Error('Backup R2 listing could not be confirmed');
        });
      const entries = result.Contents ?? [];
      if (
        (result.IsTruncated !== true && result.IsTruncated !== false) ||
        result.CommonPrefixes?.length ||
        result.KeyCount !== entries.length ||
        entries.length > 1000
      )
        throw new Error('Untrusted backup R2 listing');
      for (const entry of entries) {
        if (
          typeof entry.Key !== 'string' ||
          !/^sets\/[a-f0-9-]{36}\/(?:pending\.json|payload\.age|complete\.json)$/.test(entry.Key) ||
          !setId.safeParse(entry.Key.split('/')[1]).success ||
          keys.has(entry.Key) ||
          !Number.isSafeInteger(entry.Size) ||
          entry.Size! < 0 ||
          entry.Size! > ciphertextLimit ||
          (entry.Key.endsWith('.json') && entry.Size! > markerLimit)
        )
          throw new Error('Unexpected backup R2 namespace entry');
        keys.set(entry.Key, entry.Size!);
        if (keys.size > 10_000) throw new Error('Backup R2 listing exceeds its operation limit');
      }
      const next = result.NextContinuationToken;
      if (!result.IsTruncated) {
        if (next) throw new Error('Unexpected completed backup listing token');
        return keys;
      }
      if (!next || next.length > 4096 || tokens.has(next))
        throw new Error('Incomplete or repeated backup R2 listing');
      tokens.add(next);
      continuation = next;
    }
  }

  async function absent(key: string) {
    try {
      for await (const bytes of read(key, ciphertextLimit)) {
        if (bytes.length) return false;
      }
      return false;
    } catch (error) {
      if (error instanceof MissingBackupObject) return true;
      throw error;
    }
  }

  async function removeKnown(key: string) {
    // R2 currently ignores DeleteObject If-Match (proved with an owned probe).
    // Safety comes from the shared PostgreSQL lock, immutable producer protocol,
    // namespace and full byte identity checks. Out-of-band administrator writes
    // are outside that operational exclusion, just as direct root filesystem edits.
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(requestBudgetMs),
      })
      .catch(() => {
        throw new Error('Backup R2 deletion could not be confirmed');
      });
    if (!(await absent(key))) throw new Error('Backup R2 deleted object is still present');
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
    listKeys,
    absent,
    removeKnown,
  };
}

export function createR2BackupRepository(options: R2BackupRepositoryOptions) {
  const { sourceMediaBucket, retentionLock } = options;
  const remote = openRepository(options);
  if (!bucketName.test(sourceMediaBucket) || sourceMediaBucket === remote.bucket)
    throw new Error('Backup and source media require separate R2 buckets');

  const lockScope = { namespace: remote.namespace, endpoint: remote.origin, bucket: remote.bucket };
  const fence = <T>(operation: (checkpoint: () => Promise<void>) => Promise<T>) =>
    withR2RetentionLock(retentionLock, lockScope, operation);
  const guarded = <T>(operation: () => Promise<T>) =>
    retentionLock
      ? fence(async (checkpoint) => {
          await checkpoint();
          return operation();
        })
      : operation();
  const proofs = new WeakMap<
    object,
    {
      marker: CompleteBackupMarker;
      manifest: Buffer;
      proof: VerifiedBackupCompletion;
    }
  >();
  async function listUnlocked() {
    await remote.checkNamespace(false);
    const keys = await remote.listKeys();
    const ids = [...new Set([...keys.keys()].map((key) => key.split('/')[1]))].sort();
    const markers = [];
    for (const id of ids) {
      const pendingKey = remote.key(id, 'pending.json');
      if (!keys.has(pendingKey)) throw new Error('Backup R2 pending identity is missing');
      const pending = await remote.pending(id);
      const completeKey = remote.key(id, 'complete.json');
      if (!keys.has(completeKey)) {
        markers.push(pending);
        continue;
      }
      const marker = completeBackupMarkerSchema.parse(await remote.json(completeKey));
      if (
        marker.id !== id ||
        marker.createdAt !== pending.createdAt ||
        !sameNamespace(marker.namespace, remote.namespace) ||
        marker.ciphertext.byteLength > ciphertextLimit ||
        keys.get(marker.ciphertext.key) !== marker.ciphertext.byteLength
      )
        throw new Error('Backup R2 completed listing identity differs');
      markers.push(marker);
    }
    return markers;
  }
  async function verifyCiphertext(marker: CompleteBackupMarker) {
    const hash = createHash('sha256');
    let byteLength = 0;
    for await (const bytes of remote.read(marker.ciphertext.key, marker.ciphertext.byteLength)) {
      byteLength += bytes.length;
      hash.update(bytes);
    }
    if (
      byteLength !== marker.ciphertext.byteLength ||
      hash.digest('hex') !== marker.ciphertext.sha256
    )
      throw new Error('Expired backup R2 ciphertext identity changed');
  }
  async function verifyPending(marker: CompleteBackupMarker) {
    const pending = await remote.pending(marker.id);
    if (pending.createdAt !== marker.createdAt)
      throw new Error('Expired R2 pending identity changed');
    return pending;
  }
  const repository = Object.freeze({
    retention: retentionLock ? ('enabled' as const) : ('disabled' as const),
    retentionBoundary: 'postgresql-operational-lock-and-immutable-writers' as const,
    async begin(id: string, createdAt: string) {
      return guarded(async () => {
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
      });
    },
    async upload(id: string, sourcePath: string) {
      return guarded(async () => {
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
      });
    },
    async complete(input: unknown, manifest: Uint8Array, now: Date) {
      // Capture caller-owned values before awaiting the operation boundary.
      const privateManifest = Buffer.from(manifest);
      const invocationTime = new Date(checkedClock(now));
      const marker = completeBackupMarkerSchema.parse(input);
      return guarded(async () => {
        const manifestBytes = privateManifest;
        const completed = invocationTime;
        if (
          !sameNamespace(marker.namespace, remote.namespace) ||
          marker.ciphertext.byteLength > ciphertextLimit
        )
          throw new Error('Backup completion differs from its R2 namespace or size limit');
        await remote.checkNamespace(false);
        const pending = await remote.pending(marker.id);
        if (pending.createdAt !== marker.createdAt)
          throw new Error('Backup completion differs from its pending set');
        const proof = await verifyCompletedBackupStream({
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
        proofs.set(actual, { marker, manifest: manifestBytes, proof });
        return actual;
      });
    },
    async list() {
      return guarded(listUnlocked);
    },
    async applyRetention(completion: CompleteBackupMarker, now: Date) {
      const invocationTime = new Date(checkedClock(now));
      return fence(async (checkpoint) => {
        const completed = proofs.get(completion);
        if (!completed || JSON.stringify(completion) !== JSON.stringify(completed.marker))
          throw new Error('Retention requires this R2 repository completion receipt');
        const verifyReplacement = async () => {
          await checkpoint();
          await remote.checkNamespace(false);
          const current = completeBackupMarkerSchema.parse(
            await remote.json(remote.key(completed.marker.id, 'complete.json')),
          );
          if (JSON.stringify(current) !== JSON.stringify(completed.marker))
            throw new Error('Backup R2 replacement marker changed');
          await verifyPending(current);
          await verifyCompletedBackupStream({
            marker: current,
            manifest: completed.manifest,
            ciphertext: remote.read(current.ciphertext.key, current.ciphertext.byteLength),
            now: invocationTime,
          });
          return selectExpiredBackups(await listUnlocked(), invocationTime, {
            namespace: remote.namespace,
            replacement: completed.proof,
          });
        };
        const selected = (await verifyReplacement()).sort(
          (a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id),
        );
        const removed: string[] = [];
        for (const marker of selected) {
          const currentCandidates = await verifyReplacement();
          if (
            !currentCandidates.some(
              (candidate) => JSON.stringify(candidate) === JSON.stringify(marker),
            )
          )
            throw new Error('Expired backup R2 listing changed');
          await verifyPending(marker);
          const current = completeBackupMarkerSchema.parse(
            await remote.json(remote.key(marker.id, 'complete.json')),
          );
          if (JSON.stringify(current) !== JSON.stringify(marker))
            throw new Error('Expired backup R2 marker changed');
          await verifyCiphertext(marker);
          // Remove the completeness claim first. Any interruption leaves an
          // incomplete expired residue, never a marker promising missing bytes.
          await checkpoint();
          await remote.checkNamespace(false);
          await remote.removeKnown(remote.key(marker.id, 'complete.json'));
          await verifyPending(marker);
          await verifyCiphertext(marker);
          await checkpoint();
          await remote.checkNamespace(false);
          await remote.removeKnown(marker.ciphertext.key);
          await verifyPending(marker);
          if (
            !(await remote.absent(remote.key(marker.id, 'complete.json'))) ||
            !(await remote.absent(marker.ciphertext.key))
          )
            throw new Error('Expired backup R2 deletion identity changed');
          await checkpoint();
          await remote.checkNamespace(false);
          await remote.removeKnown(remote.key(marker.id, 'pending.json'));
          removed.push(marker.id);
        }
        return removed;
      });
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
