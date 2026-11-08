import path from 'node:path';
import { expect, it } from 'vitest';
import { installMediaRuntime } from './media-runtime';
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
