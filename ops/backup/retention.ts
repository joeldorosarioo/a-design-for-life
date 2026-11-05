import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  backupManifestSchema,
  backupMarkerSchema,
  backupNamespaceSchema,
  checkedClock,
  completeBackupMarkerSchema,
  sameNamespace,
  sameBackupApplication,
  type CompleteBackupMarker,
} from './contracts';

declare const completionBrand: unique symbol;
export type VerifiedBackupCompletion = { readonly [completionBrand]: true };
const completions = new WeakMap<object, { marker: CompleteBackupMarker; verifiedAt: number }>();
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const completionInput = z.strictObject({
  marker: completeBackupMarkerSchema,
  manifest: z.instanceof(Uint8Array),
  ciphertext: z.instanceof(Uint8Array),
  now: z.date(),
});

// Verifies bytes already read back from the destination. The job must separately
// prove pg_dump/age, archive contents and source-reference coverage before upload.
export function verifyCompletedBackup(input: unknown): VerifiedBackupCompletion {
  const parsed = completionInput.parse(input);
  const now = checkedClock(parsed.now);
  const marker = parsed.marker;
  const completedAt = Date.parse(marker.completedAt);
  if (
    completedAt > now ||
    now - completedAt > 300_000 ||
    parsed.ciphertext.byteLength !== marker.ciphertext.byteLength ||
    digest(parsed.ciphertext) !== marker.ciphertext.sha256 ||
    digest(parsed.manifest) !== marker.manifestSha256
  )
    throw new Error('Backup completion integrity was not verified');
  const manifest = backupManifestSchema.parse(
    JSON.parse(Buffer.from(parsed.manifest).toString('utf8')),
  );
  if (
    manifest.id !== marker.id ||
    manifest.createdAt !== marker.createdAt ||
    !sameNamespace(manifest.namespace, marker.namespace) ||
    !sameBackupApplication(marker.application, manifest.application)
  )
    throw new Error('Backup completion identity differs from its manifest');
  const receipt = Object.freeze({}) as VerifiedBackupCompletion;
  completions.set(receipt, { marker, verifiedAt: now });
  return receipt;
}

// The repository supplies an actual destination read stream; no supplied hash
// or verification flag can replace consuming every ciphertext byte.
export async function verifyCompletedBackupStream(input: {
  marker: unknown;
  manifest: Uint8Array;
  ciphertext: AsyncIterable<Uint8Array>;
  now: Date;
}): Promise<VerifiedBackupCompletion> {
  const marker = completeBackupMarkerSchema.parse(input.marker);
  const now = checkedClock(input.now);
  const manifestBytes = Buffer.from(input.manifest);
  const manifest = backupManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
  if (
    Date.parse(marker.completedAt) > now ||
    now - Date.parse(marker.completedAt) > 300_000 ||
    digest(manifestBytes) !== marker.manifestSha256 ||
    manifest.id !== marker.id ||
    manifest.createdAt !== marker.createdAt ||
    !sameNamespace(manifest.namespace, marker.namespace) ||
    !sameBackupApplication(marker.application, manifest.application)
  )
    throw new Error('Backup completion integrity was not verified');
  let byteLength = 0;
  const hash = createHash('sha256');
  for await (const chunk of input.ciphertext) {
    if (!(chunk instanceof Uint8Array)) throw new Error('Backup readback must contain bytes');
    byteLength += chunk.byteLength;
    if (!Number.isSafeInteger(byteLength) || byteLength > marker.ciphertext.byteLength)
      throw new Error('Backup ciphertext readback length differs');
    hash.update(chunk);
  }
  if (
    byteLength !== marker.ciphertext.byteLength ||
    hash.digest('hex') !== marker.ciphertext.sha256
  )
    throw new Error('Backup ciphertext readback integrity differs');
  const receipt = Object.freeze({}) as VerifiedBackupCompletion;
  completions.set(receipt, { marker, verifiedAt: now });
  return receipt;
}

export function selectExpiredBackups(
  input: unknown,
  now: Date,
  authorization: unknown,
): CompleteBackupMarker[] {
  const time = checkedClock(now);
  const scope = z
    .strictObject({ namespace: backupNamespaceSchema, replacement: z.unknown() })
    .parse(authorization);
  const replacement =
    scope.replacement && typeof scope.replacement === 'object'
      ? completions.get(scope.replacement)
      : undefined;
  if (
    !replacement ||
    time < replacement.verifiedAt ||
    time - replacement.verifiedAt > 60_000 ||
    !sameNamespace(scope.namespace, replacement.marker.namespace)
  )
    throw new Error('Retention requires a fresh verified completed replacement');
  const markers = z.array(backupMarkerSchema).parse(input);
  const ids = new Set<string>();
  for (const marker of markers) {
    if (
      ids.has(marker.id) ||
      !sameNamespace(scope.namespace, marker.namespace) ||
      Date.parse(marker.createdAt) > time ||
      (marker.complete && Date.parse(marker.completedAt) > time)
    )
      throw new Error('Untrusted backup listing; retention refused');
    ids.add(marker.id);
  }
  const current = markers.find((marker) => marker.id === replacement.marker.id);
  if (
    !current?.complete ||
    JSON.stringify(current) !== JSON.stringify(replacement.marker) ||
    markers.some((marker) => marker.complete && marker.completedAt > current.completedAt)
  )
    throw new Error('The verified replacement must be the latest complete set in the listing');
  const cutoff = time - 56 * 24 * 60 * 60 * 1_000;
  return markers.filter(
    (marker): marker is CompleteBackupMarker =>
      marker.complete && Date.parse(marker.completedAt) < cutoff,
  );
}
