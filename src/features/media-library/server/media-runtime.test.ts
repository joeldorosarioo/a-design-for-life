import path from 'node:path';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createLocalObjectStorage } from '@/helpers/storage/object-storage';
import { afterEach, expect, it, vi } from 'vitest';
import { installMediaRuntime, mediaRuntime } from './media-runtime';
const configure = (root: string) =>
  installMediaRuntime({ root, checkerBinary: path.resolve('.toolchain/test-checker') });
it.each([
  path.resolve('public'),
  path.resolve('public/private-assets'),
  path.resolve('.next/static'),
  path.resolve('.next/static/private-assets'),
  path.resolve('.work/private-media', '../../public', 'adfl_test_base'),
  path.resolve('.work/private-media', '../../.next/static', 'adfl_test_base'),
])(
  'rejects an effective media root served by Next before creating its storage capability: %s',
  (root) => {
    expect(() => configure(root)).toThrow(/public|static/i);
  },
);
it('accepts private roots outside Next static serving paths without treating a similarly named sibling as public', () => {
  expect(() =>
    configure(path.resolve('.work/private-media/adfl-test-files/adfl_test_base')),
  ).not.toThrow();
  expect(() => configure(path.resolve('public-private'))).not.toThrow();
});
afterEach(() => vi.unstubAllEnvs());
it.each(['.work/next-build/static', '.work/next-build/static/private-assets'])(
  'rejects media inside the selected Next build static output: %s',
  (root) => {
    expect(() => configure(path.resolve(root))).toThrow(/public|static/i);
  },
);
it('rejects private media beneath the current isolated test static output', () => {
  const dist = '.work/next-tests/11111111-1111-4111-8111-111111111111';
  vi.stubEnv('NEXT_TEST_DIST_DIR', dist);
  expect(() => configure(path.resolve(dist, 'static/private-media'))).toThrow(/public|static/i);
});
it('uses an explicitly injected byte transport while preserving the legacy root option', async () => {
  const scratch = path.resolve('.work');
  const root = await mkdtemp(path.join(scratch, 'media-runtime-'));
  if (!root.startsWith(scratch + path.sep)) throw new Error('Invalid test cleanup target');
  try {
    const injectedRoot = path.join(root, 'injected');
    await mkdir(injectedRoot);
    const options = {
      root: path.join(root, 'fallback'),
      checkerBinary: path.resolve('.toolchain/test-checker'),
      storage: createLocalObjectStorage(injectedRoot),
    };
    installMediaRuntime(options);
    const object = await mediaRuntime().storage.put(new Uint8Array([3, 1, 4]));
    expect(await readdir(injectedRoot)).toEqual([object.key]);
    expect(await mediaRuntime().storage.read(object)).toEqual(new Uint8Array([3, 1, 4]));
    installMediaRuntime({ storage: options.storage, checkerBinary: options.checkerBinary });
    expect(await mediaRuntime().storage.get(object)).toEqual(new Uint8Array([3, 1, 4]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
