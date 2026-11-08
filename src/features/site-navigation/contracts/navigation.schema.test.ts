import { expect, it } from 'vitest';
import { navigationInputSchema } from './navigation.schema';

it('accepts optional plain reading-position adjustment copy without opening arbitrary message fields', () => {
  expect(
    navigationInputSchema.parse({
      messages: { readingPositionAdjusted: 'Synthetic reading adjustment notice' },
    }),
  ).toEqual({ messages: { readingPositionAdjusted: 'Synthetic reading adjustment notice' } });
  for (const value of [undefined, null, ''])
    expect(
      navigationInputSchema.safeParse({ messages: { readingPositionAdjusted: value } }).success,
    ).toBe(true);
  expect(
    navigationInputSchema.safeParse({ messages: { readingPositionAdjusted: { html: 'unsafe' } } })
      .success,
  ).toBe(false);
  expect(
    navigationInputSchema.safeParse({
      messages: { readingPositionAdjusted: 'Synthetic', arbitraryStyle: 'color:red' },
    }).success,
  ).toBe(false);
});

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
