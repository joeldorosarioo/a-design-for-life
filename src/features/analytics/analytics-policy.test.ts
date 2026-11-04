import { describe, expect, it } from 'vitest';
import { canMeasure } from './analytics-policy';

describe('canMeasure', () => {
  // Broadening either guard would permit private/test collection.
  it.each([
    ['local', 'public', false, false],
    ['test', 'public', false, false],
    ['staging', 'public', false, false],
    ['preview', 'public', false, false],
    ['production', 'admin', false, false],
    ['production', 'private', false, false],
    ['production', 'public', true, false],
    ['production', 'public', false, true],
  ])('limits %s/%s preview=%s to %s', (environment, area, preview, expected) => {
    expect(canMeasure({ environment, area, preview })).toBe(expected);
  });
});
