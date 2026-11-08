import { describe, expect, it, vi } from 'vitest';
import { restoreReadOnlyMedia } from './restore-read-only';
import type { ObjectStorage } from './object-storage';
const env = {
  APP_ENV: 'local' as const,
  PUBLIC_SITE_ENABLED: 'false' as const,
  SITE_ORIGIN: 'http://127.0.0.1:3087',
  DATABASE_URI:
    'postgres://joeldorosarioo_local:synthetic@host.docker.internal:55435/a_design_for_life_restore_0123456789abcdef0123456789abcdef',
};
const object = { key: 'a'.repeat(64), sha256: 'b'.repeat(64), byteLength: 1 };
function fixture(): ObjectStorage & { checkBucket: () => Promise<void> } {
  return {
    put: vi.fn(async () => object),
    delete: vi.fn(async () => {}),
    get: vi.fn(async () => new Uint8Array([1])),
    read: vi.fn(async () => new Uint8Array([1])),
    head: vi.fn(async () => object),
    checkBucket: vi.fn(async () => {}),
  } satisfies ObjectStorage & { checkBucket: () => Promise<void> };
}
it('preserves normal media storage when the optional proof flag is absent or false', () => {
  const storage = fixture();
  expect(restoreReadOnlyMedia(storage, { ...env, APP_ENV: 'staging' }, undefined)).toBe(storage);
  expect(restoreReadOnlyMedia(storage, env, 'false')).toBe(storage);
});
it('blocks put and delete before invoking either SDK-facing operation', async () => {
  const storage = fixture();
  const proof = restoreReadOnlyMedia(storage, env, 'true')!;
  await expect(proof.put(new Uint8Array([1]))).rejects.toThrow(/writes are disabled/);
  await expect(proof.delete(object)).rejects.toThrow(/writes are disabled/);
  expect(storage.put).not.toHaveBeenCalled();
  expect(storage.delete).not.toHaveBeenCalled();
  expect(await proof.get(object)).toEqual(new Uint8Array([1]));
  expect(await proof.read(object)).toEqual(new Uint8Array([1]));
  expect(await proof.head(object)).toEqual(object);
  await proof.checkBucket();
  expect(storage.checkBucket).toHaveBeenCalledOnce();
});
describe.each([
  { APP_ENV: 'production' as const },
  { APP_ENV: 'staging' as const },
  { APP_ENV: 'test' as const },
  { PUBLIC_SITE_ENABLED: 'true' as const },
  { PUBLIC_SITE_ENABLED: undefined },
  { SITE_ORIGIN: 'https://example.test' },
  { SITE_ORIGIN: 'http://localhost:3087' },
  { DATABASE_URI: env.DATABASE_URI.replace('restore_0123456789abcdef0123456789abcdef', 'rebuild') },
  { DATABASE_URI: env.DATABASE_URI.replace('host.docker.internal', 'remote.test') },
  { DATABASE_URI: env.DATABASE_URI.replace('55435', '5432') },
  { DATABASE_URI: env.DATABASE_URI + '?application_name=unexpected' },
])('refuses an ambiguous or deployed restore environment %j', (invalid) => {
  it('rejects before allowing the wrapper', () => {
    expect(() => restoreReadOnlyMedia(fixture(), { ...env, ...invalid }, 'true')).toThrow(
      /private local/,
    );
  });
});
it('rejects invalid flags and missing R2 adapters', () => {
  expect(() => restoreReadOnlyMedia(fixture(), env, 'TRUE')).toThrow(/private local/);
  expect(() => restoreReadOnlyMedia(undefined, env, 'true')).toThrow(/private local/);
});
