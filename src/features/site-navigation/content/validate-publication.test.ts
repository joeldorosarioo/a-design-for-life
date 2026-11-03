import { expect, it } from 'vitest';
import type { CollectionBeforeChangeHook } from 'payload';
import { navigationFixture } from '../../../../testing/fixtures/editorial-lifecycle';
import { validateNavigationPublication } from './validate-publication';

function validate(data: Record<string, unknown>) {
  return validateNavigationPublication({
    data,
    req: {},
    collection: { slug: 'site-navigation' },
  } as Parameters<CollectionBeforeChangeHook>[0]);
}

it.each([undefined, null, '', '  '])(
  'allows publication with an absent optional return label (%s)',
  (backToProjectsLabel) => {
    const data = navigationFixture();
    data._status = 'published';
    data.controls = { ...(data.controls as Record<string, unknown>), backToProjectsLabel };
    expect(() => validate(data)).not.toThrow();
  },
);

it('still rejects a missing required count noun and leaves the return label optional', () => {
  const data = navigationFixture();
  data._status = 'published';
  data.controls = {
    ...(data.controls as Record<string, unknown>),
    casesLabel: '',
    backToProjectsLabel: null,
  };
  expect(() => validate(data)).toThrowError(
    expect.objectContaining({
      data: expect.objectContaining({
        errors: [expect.objectContaining({ path: 'controls.casesLabel' })],
      }),
    }),
  );
});
