import { expect, it } from 'vitest';
import { localMediaStorageRoot } from './local.mjs';

it('preserves the configured local source directory under the mounted media volume', () => {
  expect(localMediaStorageRoot('/app/.work/private-media/custom/content')).toBe(
    '/app/.work/private-media/custom/content',
  );
  expect(localMediaStorageRoot('/app/.work/private-media')).toBe('/app/.work/private-media');
  expect(localMediaStorageRoot(undefined)).toBeUndefined();
});

it.each([
  '/tmp/media',
  '/app/.work/private-media-other',
  '/app/.work/private-media/../../publication',
  '.work/private-media/custom',
])('rejects a source root outside the mounted media volume', (root) => {
  expect(() => localMediaStorageRoot(root)).toThrow(
    'The local media storage root must stay within its mounted volume.',
  );
});
