import { expect, it } from 'vitest';
import { selectNextDistDir } from './next-dist-value';

it('selects the ordinary output and the exact owned UUID test namespace', () => {
  expect(selectNextDistDir({})).toBe('.work/next-build');
  const selected = '.work/next-tests/443f2f55-41c5-499a-9c24-a038128133f7';
  expect(selectNextDistDir({ NEXT_TEST_DIST_DIR: selected })).toBe(selected);
});

it.each([
  '',
  '.next',
  'public/build',
  '.work/../.next',
  '../outside',
  '/tmp/build',
  '.work/next-tests/../../public',
  '.work/next-tests/not-a-run',
  '.work/next-tests/443F2F55-41C5-499A-9C24-A038128133F7',
  '.work/next-tests/443f2f55-41c5-199a-9c24-a038128133f7',
  '.work/next-tests/443f2f55-41c5-499a-1c24-a038128133f7',
])('refuses an unowned output namespace: %s', (selected) => {
  expect(() => selectNextDistDir({ NEXT_TEST_DIST_DIR: selected })).toThrow(/build output/i);
});
