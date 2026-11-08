import { createHash } from 'node:crypto';
import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ precision: 3 });
export const backupNamespaceSchema = z.strictObject({
  project: z.literal('a-design-for-life'),
  environment: z.enum(['test', 'staging', 'production']),
  source: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
});
const artifact = z.strictObject({ byteLength: z.number().int().positive().safe(), sha256: digest });
const setIdentity = {
  version: z.literal(1),
  id: z.uuid(),
  namespace: backupNamespaceSchema,
  createdAt: timestamp,
};
export const backupApplicationSchema = z.union([
  z.strictObject({ revision: z.string().regex(/^[a-f0-9]{40}$/), schemaSha256: digest }),
  z.strictObject({
    revision: z.literal('draft-uncommitted'),
    sourceSha256: digest,
    schemaSha256: digest,
  }),
]);
export const backupManifestSchema = z
  .strictObject({
    ...setIdentity,
    application: backupApplicationSchema,
    database: artifact.extend({ path: z.literal('database.dump') }),
    publicRoot: artifact.extend({ path: z.literal('publication/current.json') }).nullable(),
    objects: z.array(artifact.extend({ key: digest })),
  })
  .superRefine((value, context) => {
    const keys = new Set<string>();
    for (const object of value.objects) {
      if (keys.has(object.key))
        context.addIssue({ code: 'custom', message: 'Duplicate object reference' });
      keys.add(object.key);
    }
  });
export const completeBackupMarkerSchema = z
  .strictObject({
    ...setIdentity,
    complete: z.literal(true),
    completedAt: timestamp,
    manifestSha256: digest,
    ciphertext: artifact.extend({ key: z.string() }),
  })
  .superRefine((value, context) => {
    if (
      value.ciphertext.key !== `sets/${value.id}/payload.age` ||
      value.completedAt < value.createdAt
    )
      context.addIssue({ code: 'custom', message: 'Invalid complete backup marker' });
  });
export const backupMarkerSchema = z.union([
  completeBackupMarkerSchema,
  z.strictObject({ ...setIdentity, complete: z.literal(false) }),
]);
export type BackupNamespace = z.infer<typeof backupNamespaceSchema>;
export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type CompleteBackupMarker = z.infer<typeof completeBackupMarkerSchema>;

export function checkedClock(now: Date): number {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error('Invalid backup clock');
  return now.getTime();
}
export function sameNamespace(first: BackupNamespace, second: BackupNamespace): boolean {
  return (
    first.project === second.project &&
    first.environment === second.environment &&
    first.source === second.source
  );
}

export function validateBackupArchiveManifest(input: {
  manifestBytes: Uint8Array;
  entries: readonly { name: string; byteLength: number; sha256: string }[];
}): BackupManifest {
  const bytes = Buffer.from(input.manifestBytes);
  const manifest = backupManifestSchema.parse(JSON.parse(bytes.toString('utf8')));
  const entries = z
    .array(
      z.strictObject({
        name: z.string(),
        byteLength: z.number().int().nonnegative().safe(),
        sha256: digest,
      }),
    )
    .parse(input.entries);
  const expected = new Map<string, { byteLength: number; sha256: string }>([
    [
      'manifest.json',
      { byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    ],
    ['database.dump', manifest.database],
    ...(manifest.publicRoot ? [['publication/current.json', manifest.publicRoot] as const] : []),
    ...manifest.objects.map((object) => ['objects/' + object.key, object] as const),
  ]);
  if (entries.length !== expected.size)
    throw new Error('Backup archive differs from its complete private manifest');
  const seen = new Set<string>();
  for (const entry of entries) {
    const required = expected.get(entry.name);
    if (
      seen.has(entry.name) ||
      !required ||
      entry.byteLength !== required.byteLength ||
      entry.sha256 !== required.sha256
    )
      throw new Error('Backup archive integrity differs from its private manifest');
    seen.add(entry.name);
  }
  return manifest;
}
