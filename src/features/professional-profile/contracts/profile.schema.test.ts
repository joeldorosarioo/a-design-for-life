import { expect, it } from 'vitest';
import { profileInputSchema } from './profile.schema';

it('accepts optional plain method keywords without opening presentation fields', () => {
  expect(
    profileInputSchema.parse({
      approach: { methods: [{ keywords: 'Research · flows · testing' }] },
    }),
  ).toMatchObject({
    approach: { methods: [{ keywords: 'Research · flows · testing' }] },
  });
  expect(
    profileInputSchema.safeParse({ approach: { methods: [{ keywords: ['Research'] }] } }).success,
  ).toBe(false);
  expect(
    profileInputSchema.safeParse({
      approach: { methods: [{ keywords: 'Research', style: 'color:red' }] },
    }).success,
  ).toBe(false);
});

it('accepts optional plain editorial eyebrows for the existing About sections', () => {
  const about = {
    journeyEyebrow: 'Synthetic journey eyebrow',
    approachEyebrow: 'Synthetic approach eyebrow',
    inMotionEyebrow: 'Synthetic motion eyebrow',
  };
  expect(profileInputSchema.parse({ about })).toEqual({ about });
  expect(profileInputSchema.safeParse({ about: { journeyEyebrow: ['Synthetic'] } }).success).toBe(
    false,
  );
});
