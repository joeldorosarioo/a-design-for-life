import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { resolveNextDistDir } from './next-dist';

it('keeps an ordinary build outside the existing served .next tree', () => {
  expect(resolveNextDistDir({})).toBe('.work/next-build');
});
it('accepts only the dedicated test output beneath .work', () => {
  expect(
    resolveNextDistDir({
      NEXT_TEST_DIST_DIR: '.work/next-tests/443f2f55-41c5-499a-9c24-a038128133f7',
    }),
  ).toBe('.work/next-tests/443f2f55-41c5-499a-9c24-a038128133f7');
});
it.each([
  '.next',
  'public/build',
  '.work/../.next',
  '../outside',
  '/tmp/build',
  '.work/next-tests/../../public',
  '.work/next-tests/not-a-run',
])('rejects unsafe output %s', (selected) => {
  expect(() => resolveNextDistDir({ NEXT_TEST_DIST_DIR: selected })).toThrow(/build output/i);
});
let directory: string | undefined;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});
it('rejects an allowed-looking output whose ancestor is a filesystem link', () => {
  directory = mkdtempSync(path.join(tmpdir(), 'adfl-build-path-'));
  mkdirSync(path.join(directory, 'public'));
  symlinkSync(path.join(directory, 'public'), path.join(directory, '.work'), 'junction');
  expect(() => resolveNextDistDir({}, directory)).toThrow(/build output/i);
});
