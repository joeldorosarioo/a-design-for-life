import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { assertObjectReference, type ObjectStorage, type StoredObject } from './object-storage';
import { registerObjectStorageRetention, withObjectStorageRetention } from './object-retention';

export type R2StorageOptions = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function createR2ObjectStorage(options: R2StorageOptions): ObjectStorage {
  let endpoint: URL;
  try {
    endpoint = new URL(options.endpoint);
  } catch {
    throw new Error('Invalid R2 configuration');
  }
  const loopback = ['127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (
    !(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && loopback)) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.bucket) ||
    !options.accessKeyId.trim() ||
    !options.secretAccessKey.trim()
  )
    throw new Error('Invalid R2 configuration');
  const bucket = options.bucket;
  const client = new S3Client({
    endpoint: endpoint.origin,
    region: 'auto',
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 10_000 },
  });
  const missing = (error: unknown) =>
    error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
  const get = async (object: StoredObject): Promise<Uint8Array> => {
    assertObjectReference(object);
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.key }));
    if (!response.Body) throw new Error('Object integrity failure');
    const bytes = await response.Body.transformToByteArray();
    if (
      response.ContentLength !== object.byteLength ||
      response.Metadata?.sha256 !== object.sha256 ||
      bytes.byteLength !== object.byteLength ||
      createHash('sha256').update(bytes).digest('hex') !== object.sha256
    )
      throw new Error('Object integrity failure');
    return bytes;
  };
  const adapter: ObjectStorage = {
    get,
    read: get,
    async delete(object) {
      return withObjectStorageRetention(adapter, async () => {
        try {
          await get(object);
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.key }));
        } catch (error) {
          if (missing(error)) return;
          throw error;
        }
      });
    },
    async head(object) {
      assertObjectReference(object);
      try {
        const response = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: object.key }),
        );
        if (
          response.ContentLength !== object.byteLength ||
          response.Metadata?.sha256 !== object.sha256
        )
          throw new Error('Object integrity failure');
        await get(object);
        return { ...object };
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async put(bytes) {
      const captured = Buffer.from(bytes);
      const object = {
        key: randomBytes(32).toString('hex'),
        byteLength: captured.byteLength,
        sha256: createHash('sha256').update(captured).digest('hex'),
      };
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: object.key,
          Body: captured,
          ContentLength: captured.byteLength,
          ContentType: 'application/octet-stream',
          ContentMD5: createHash('md5').update(captured).digest('base64'),
          Metadata: { sha256: object.sha256 },
          IfNoneMatch: '*',
        }),
      );
      return object;
    },
  };
  return registerObjectStorageRetention(
    adapter,
    async () => `object-storage:r2:${endpoint.origin}/${bucket}`,
  );
}
