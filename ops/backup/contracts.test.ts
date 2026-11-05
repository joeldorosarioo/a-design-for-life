import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { backupManifestSchema, validateBackupArchiveManifest } from './contracts';
const manifest = {
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  namespace: { project: 'a-design-for-life', environment: 'test', source: 'synthetic-source' },
  createdAt: '2026-12-01T00:00:00.000Z',
  database: { path: 'database.dump', byteLength: 1, sha256: 'a'.repeat(64) },
  publicRoot: null,
  objects: [],
};
it('records an immutable local application image and its inspected draft label in the archive', () => {
  const application = {
    imageId: 'sha256:' + 'd'.repeat(64),
    revision: 'draft-local-alpine3.24',
    schemaSha256: 'c'.repeat(64),
  };
  expect(backupManifestSchema.parse({ ...manifest, application }).application).toEqual(application);
});

it.each([
  { revision: 'draft-local-alpine3.24', schemaSha256: 'c'.repeat(64) },
  {
    imageId: 'adfl:local-alpine3.24',
    revision: 'draft-local-alpine3.24',
    schemaSha256: 'c'.repeat(64),
  },
  {
    imageId: 'sha256:' + 'd'.repeat(64),
    revision: 'draft-local-alpine3.24',
    sourceSha256: 'b'.repeat(64),
    schemaSha256: 'c'.repeat(64),
  },
])('rejects unbound or mixed local application provenance', (application) => {
  expect(backupManifestSchema.safeParse({ ...manifest, application }).success).toBe(false);
});

it('records an honest dirty local revision with the captured source fingerprint', () => {
  const result = backupManifestSchema.safeParse({
    ...manifest,
    application: {
      revision: 'draft-uncommitted',
      sourceSha256: 'b'.repeat(64),
      schemaSha256: 'c'.repeat(64),
    },
  });
  expect(result.success).toBe(true);
  if (result.success)
    expect(result.data.application).toMatchObject({
      revision: 'draft-uncommitted',
      sourceSha256: 'b'.repeat(64),
    });
});
it('refuses a draft revision without a complete source fingerprint', () => {
  expect(
    backupManifestSchema.safeParse({
      ...manifest,
      application: { revision: 'draft-uncommitted', schemaSha256: 'c'.repeat(64) },
    }).success,
  ).toBe(false);
});
it('preserves the clean commit identity contract', () => {
  expect(
    backupManifestSchema.safeParse({
      ...manifest,
      application: { revision: 'd'.repeat(40), schemaSha256: 'c'.repeat(64) },
    }).success,
  ).toBe(true);
});

function archiveFixture() {
  const value = {
    ...manifest,
    application: { revision: 'd'.repeat(40), schemaSha256: 'c'.repeat(64) },
  };
  const manifestBytes = Buffer.from(JSON.stringify(value));
  return {
    manifestBytes,
    entries: [
      {
        name: 'manifest.json',
        byteLength: manifestBytes.length,
        sha256: createHash('sha256').update(manifestBytes).digest('hex'),
      },
      { name: 'database.dump', byteLength: 1, sha256: 'a'.repeat(64) },
    ],
  };
}
it('accepts only the exact files and hashes described by the private archive manifest', () => {
  expect(validateBackupArchiveManifest(archiveFixture())).toMatchObject({ id: manifest.id });
});
it('refuses an allowed object name omitted from the private manifest', () => {
  const input = archiveFixture();
  input.entries.push({ name: 'objects/' + 'e'.repeat(64), byteLength: 3, sha256: 'f'.repeat(64) });
  expect(() => validateBackupArchiveManifest(input)).toThrow();
});
it('refuses a required private archive member that is absent', () => {
  const input = archiveFixture();
  input.entries.pop();
  expect(() => validateBackupArchiveManifest(input)).toThrow();
});
it('refuses changed bytes even when all archive names are individually allowed', () => {
  const input = archiveFixture();
  input.entries[1].sha256 = 'f'.repeat(64);
  expect(() => validateBackupArchiveManifest(input)).toThrow();
});
