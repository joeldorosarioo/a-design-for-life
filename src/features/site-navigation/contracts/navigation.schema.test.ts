import { expect, it } from 'vitest';
import { navigationInputSchema } from './navigation.schema';

it('accepts the case card action label as optional draft text', () => {
  expect(
    navigationInputSchema.parse({ controls: { caseLinkLabel: 'Explore synthetic case' } }),
  ).toEqual({ controls: { caseLinkLabel: 'Explore synthetic case' } });
  for (const value of [undefined, null, ''])
    expect(navigationInputSchema.safeParse({ controls: { caseLinkLabel: value } }).success).toBe(
      true,
    );
  expect(
    navigationInputSchema.safeParse({ controls: { caseLinkLabel: { text: 'Synthetic' } } }).success,
  ).toBe(false);
});
