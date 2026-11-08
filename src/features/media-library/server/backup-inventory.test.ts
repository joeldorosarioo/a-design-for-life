import { expect, it } from 'vitest';
import { collectBackupMediaInventory } from './backup-inventory';
const id = '11111111-1111-4111-8111-111111111111';
const another = '22222222-2222-4222-8222-222222222222';
const obj = (key: string) => ({ key: key.repeat(64), byteLength: 3, sha256: 'e'.repeat(64) });
const manifest = () => ({
  revision: id,
  kind: 'image',
  original: { variant: 'original', object: obj('a'), type: 'image/png', width: 10, height: 10 },
  variants: [{ variant: 'w10', object: obj('b'), type: 'image/webp', width: 10, height: 10 }],
});
const root = () => ({
  generation: id,
  subjects: {
    'case-content/synthetic': {
      operationId: 'confirmed',
      targetRevision: 'revision-A',
      value: {
        media: [
          {
            id: another,
            manifest: {
              ...manifest(),
              revision: another,
              original: { ...manifest().original, object: obj('c') },
            },
          },
        ],
      },
    },
  },
});
it('includes current and trashed originals, variants and confirmed-root-only objects with deduplication', () => {
  const inventory = collectBackupMediaInventory({
    media: [{ id, manifest: manifest(), state: 'deleted', deletedAt: '2026-12-01T00:00:00.000Z' }],
    root: root(),
  });
  expect(inventory.mediaIds).toEqual([id, another]);
  expect(inventory.objects.map((object) => object.key)).toEqual([
    'a'.repeat(64),
    'b'.repeat(64),
    'c'.repeat(64),
  ]);
});
it('deduplicates a confirmed reference to the same current immutable manifest', () => {
  const confirmed = root();
  const current = manifest();
  confirmed.subjects['case-content/synthetic'].value.media = [{ id, manifest: current }];
  const inventory = collectBackupMediaInventory({
    media: [{ id, manifest: current }],
    root: confirmed,
  });
  expect(inventory.mediaIds).toEqual([id]);
  expect(inventory.objects).toHaveLength(2);
});
it('refuses the same object key with conflicting integrity metadata', () => {
  const other = manifest();
  other.original.object.sha256 = 'f'.repeat(64);
  expect(() =>
    collectBackupMediaInventory({
      media: [
        { id, manifest: manifest() },
        { id: another, manifest: other },
      ],
      root: null,
    }),
  ).toThrow();
});
it('refuses a duplicate media identity rather than silently skipping one record', () => {
  expect(() =>
    collectBackupMediaInventory({
      media: [
        { id, manifest: manifest() },
        { id, manifest: manifest() },
      ],
      root: null,
    }),
  ).toThrow();
});
it('refuses a malformed manifest instead of omitting required bytes', () => {
  expect(() =>
    collectBackupMediaInventory({
      media: [{ id, manifest: { original: { key: '../file' } } }],
      root: null,
    }),
  ).toThrow();
});
it('refuses malformed confirmed-root media rather than hiding backup incompleteness', () => {
  const confirmed = root();
  confirmed.subjects['case-content/synthetic'].value.media[0].manifest.original.object.key =
    '../file';
  expect(() => collectBackupMediaInventory({ media: [], root: confirmed })).toThrow();
});
it('refuses different manifests for the same current and confirmed immutable media', () => {
  const confirmed = root();
  confirmed.subjects['case-content/synthetic'].value.media[0].id = id;
  expect(() =>
    collectBackupMediaInventory({ media: [{ id, manifest: manifest() }], root: confirmed }),
  ).toThrow();
});
