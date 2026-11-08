import { expect, it } from 'vitest';
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload';
import { profilePublicationFixture } from '../../../../testing/fixtures/editorial-lifecycle';
import { validateProfilePublication } from './validate-publication';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
function validate(trajectoryKey: unknown, methodKey: unknown, status = 'published') {
  const data = profilePublicationFixture(first, second);
  data._status = status;
  (data.homeAbout as { trajectory: unknown[] }).trajectory = [
    {
      readingKey: trajectoryKey,
      period: 'Synthetic period',
      title: 'Synthetic trajectory',
      description: 'Synthetic description',
    },
  ];
  (data.approach as { methods: unknown[] }).methods = [
    { readingKey: methodKey, title: 'Synthetic method', description: 'Synthetic description' },
  ];
  return validateProfilePublication({
    data,
    operation: 'create',
    context: {},
    req: {} as PayloadRequest,
    collection: { slug: 'professional-profiles' } as SanitizedCollectionConfig,
  });
}

it.each([undefined, null, '', 'not-a-uuid'])(
  'rejects a published row without a valid reading identity: %j',
  (value) => {
    expect(() => validate(value, second)).toThrow(/homeAbout.trajectory.0.readingKey/);
  },
);

it('rejects a duplicate published identity across the two profile groups', () => {
  expect(() => validate(first, first)).toThrow(/approach.methods.0.readingKey/);
});

it('allows unique published identities and keeps incomplete drafts flexible', () => {
  expect(() => validate(first, second)).not.toThrow();
  expect(() => validate(undefined, undefined, 'draft')).not.toThrow();
});
