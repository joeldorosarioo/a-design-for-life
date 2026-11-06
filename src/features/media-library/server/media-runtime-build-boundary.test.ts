import path from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  lstatSync: vi.fn(() => {
    throw new Error('Runtime must not traverse workspace paths');
  }),
  realpathSync: vi.fn(() => {
    throw new Error('Runtime must not traverse workspace paths');
  }),
}));

import { installMediaRuntime } from './media-runtime';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('configures private media when workspace traversal is unavailable', () => {
  vi.stubEnv('NEXT_TEST_DIST_DIR', '.work/next-tests/443f2f55-41c5-499a-9c24-a038128133f7');
  expect(() =>
    installMediaRuntime({
      root: path.resolve('.work/private-media/runtime-boundary'),
      checkerBinary: '/synthetic/qpdf',
    }),
  ).not.toThrow();
  expect(lstatSync).not.toHaveBeenCalled();
  expect(realpathSync).not.toHaveBeenCalled();
});

it('still refuses media inside the isolated static output without filesystem traversal', () => {
  const selected = '.work/next-tests/443f2f55-41c5-499a-9c24-a038128133f7';
  vi.stubEnv('NEXT_TEST_DIST_DIR', selected);
  expect(() =>
    installMediaRuntime({
      root: path.resolve(selected, 'static/private'),
      checkerBinary: '/synthetic/qpdf',
    }),
  ).toThrow(/public|static/i);
  expect(lstatSync).not.toHaveBeenCalled();
  expect(realpathSync).not.toHaveBeenCalled();
});
