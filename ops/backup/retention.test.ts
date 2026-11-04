import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { selectExpiredBackups, verifyCompletedBackup } from './retention';

const now = new Date('2026-12-01T00:00:00.000Z');
const namespace = {
  project: 'a-design-for-life',
  environment: 'test',
  source: 'isolated-backup-proof',
};
const ciphertext = Buffer.from('synthetic encrypted bytes; the unit does not implement age');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const newId = '11111111-1111-4111-8111-111111111111';
function set(id: string, completedAt: string) {
  const manifest = Buffer.from(
    JSON.stringify({
      version: 1,
      id,
      namespace,
      createdAt: completedAt,
      application: { revision: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) },
      database: { path: 'database.dump', byteLength: 7, sha256: 'c'.repeat(64) },
      publicRoot: null,
      objects: [{ key: 'd'.repeat(64), byteLength: 12, sha256: 'e'.repeat(64) }],
    }),
  );
  return {
    manifest,
    marker: {
      version: 1,
      id,
      namespace: structuredClone(namespace),
      createdAt: completedAt,
      completedAt,
      complete: true,
      manifestSha256: hash(manifest),
      ciphertext: {
        key: `sets/${id}/payload.age`,
        byteLength: ciphertext.length,
        sha256: hash(ciphertext),
      },
    },
  };
}
const replacement = set(newId, '2026-11-30T23:59:50.000Z');
const old = set('22222222-2222-4222-8222-222222222222', '2026-10-05T23:59:59.999Z');
function proof() {
  return verifyCompletedBackup({ ...replacement, ciphertext, now });
}
function select(markers: unknown, extra: Record<string, unknown> = {}, at = now) {
  return selectExpiredBackups(markers, at, { namespace, replacement: proof(), ...extra });
}

// A changed cutoff or accepting a marker without verified bytes can destroy recoverability.
it('selects only complete sets strictly older than 56 days after a verified replacement', () => {
  const boundary = set('33333333-3333-4333-8333-333333333333', '2026-10-06T00:00:00.000Z');
  const recent = set('44444444-4444-4444-8444-444444444444', '2026-11-01T00:00:00.000Z');
  expect(
    select([old.marker, boundary.marker, recent.marker, replacement.marker]).map((item) => item.id),
  ).toEqual(['22222222-2222-4222-8222-222222222222']);
});
it('preserves an incomplete old upload without treating it as completed', () => {
  const pending = {
    version: 1,
    id: '55555555-5555-4555-8555-555555555555',
    namespace,
    createdAt: '2026-01-01T00:00:00.000Z',
    complete: false,
  };
  expect(select([pending, replacement.marker])).toEqual([]);
});
it('does not select anything when no old complete set exists', () => {
  expect(select([replacement.marker])).toEqual([]);
});
it.each([
  ['absent replacement', undefined],
  ['forged verified flag', { verified: true, marker: replacement.marker }],
])('refuses retention with %s', (_name, invalidProof) => {
  expect(() => select([old.marker, replacement.marker], { replacement: invalidProof })).toThrow();
});
it('refuses a proof copied into a new object', () => {
  expect(() => select([old.marker, replacement.marker], { replacement: { ...proof() } })).toThrow();
});
it('refuses a replacement absent from the current listing', () => {
  expect(() => select([old.marker])).toThrow();
});
it('refuses a stale integrity proof before selecting any set', () => {
  const receipt = proof();
  expect(() =>
    select(
      [old.marker, replacement.marker],
      { replacement: receipt },
      new Date('2026-12-01T00:01:01.000Z'),
    ),
  ).toThrow();
});
it('refuses a replacement that completed too long ago', () => {
  const stale = set(newId, '2026-11-30T23:49:00.000Z');
  expect(() => verifyCompletedBackup({ ...stale, ciphertext, now })).toThrow();
});
it.each([
  ['duplicate identity', () => [old.marker, old.marker, replacement.marker]],
  [
    'foreign namespace',
    () => [
      { ...old.marker, namespace: { ...namespace, environment: 'production' } },
      replacement.marker,
    ],
  ],
  [
    'invalid completion date',
    () => [{ ...old.marker, completedAt: 'yesterday' }, replacement.marker],
  ],
  [
    'future completion',
    () => [{ ...old.marker, completedAt: '2026-12-02T00:00:00.000Z' }, replacement.marker],
  ],
  [
    'completion predates creation',
    () => [{ ...old.marker, createdAt: '2026-10-07T00:00:00.000Z' }, replacement.marker],
  ],
  ['extra control field', () => [{ ...old.marker, forceDelete: true }, replacement.marker]],
  [
    'unexpected ciphertext path',
    () => [
      { ...old.marker, ciphertext: { ...old.marker.ciphertext, key: '../current' } },
      replacement.marker,
    ],
  ],
  ['non-list input', () => ({ complete: true })],
])('fails closed for %s', (_name, markers) => {
  expect(() => select(markers())).toThrow();
});
it('refuses a same-ID marker changed after integrity verification', () => {
  expect(() =>
    select([old.marker, { ...replacement.marker, manifestSha256: 'f'.repeat(64) }]),
  ).toThrow();
});
it('refuses a verified replacement older than another complete set', () => {
  const newer = set('66666666-6666-4666-8666-666666666666', '2026-11-30T23:59:59.000Z');
  expect(() => select([old.marker, replacement.marker, newer.marker])).toThrow();
});
it.each(['ciphertext', 'manifest'] as const)('refuses corrupted %s bytes', (field) => {
  expect(() =>
    verifyCompletedBackup({ ...replacement, ciphertext, now, [field]: Buffer.from('corrupted') }),
  ).toThrow();
});
it('refuses an invalid manifest even when its hash matches', () => {
  const manifest = Buffer.from(
    JSON.stringify({
      ...JSON.parse(replacement.manifest.toString()),
      objects: [{ key: '../file', byteLength: 1, sha256: 'e'.repeat(64) }],
    }),
  );
  expect(() =>
    verifyCompletedBackup({
      ...replacement,
      marker: { ...replacement.marker, manifestSha256: hash(manifest) },
      manifest,
      ciphertext,
      now,
    }),
  ).toThrow();
});
it('refuses conflicting duplicate object references inside the encrypted manifest', () => {
  const parsed = JSON.parse(replacement.manifest.toString());
  parsed.objects.push({ ...parsed.objects[0], sha256: 'f'.repeat(64) });
  const manifest = Buffer.from(JSON.stringify(parsed));
  expect(() =>
    verifyCompletedBackup({
      ...replacement,
      marker: { ...replacement.marker, manifestSha256: hash(manifest) },
      manifest,
      ciphertext,
      now,
    }),
  ).toThrow();
});
it('does not trust mutations to original input after verification', () => {
  const current = set(newId, '2026-11-30T23:59:50.000Z');
  const receipt = verifyCompletedBackup({ ...current, ciphertext, now });
  current.marker.namespace.source = 'changed-source';
  expect(() =>
    selectExpiredBackups([old.marker, current.marker], now, { namespace, replacement: receipt }),
  ).toThrow();
});
it('refuses an invalid clock', () => {
  expect(() => select([old.marker, replacement.marker], {}, new Date(NaN))).toThrow();
});
