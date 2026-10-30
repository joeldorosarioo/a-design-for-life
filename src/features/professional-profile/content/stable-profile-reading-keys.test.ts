import { expect, it } from 'vitest';
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload';
import type { ProfessionalProfile } from '@/payload-types';
import { z } from 'zod';
import { stableProfileReadingKeys } from './stable-profile-reading-keys';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
async function apply(
  data: Partial<ProfessionalProfile>,
  originalDoc?: Partial<ProfessionalProfile>,
) {
  return (await stableProfileReadingKeys({
    data,
    originalDoc: originalDoc as ProfessionalProfile | undefined,
    operation: originalDoc ? 'update' : 'create',
    context: {},
    req: {} as PayloadRequest,
    collection: { slug: 'professional-profiles' } as SanitizedCollectionConfig,
  })) as Partial<ProfessionalProfile>;
}

it('assigns distinct UUID reading identities to incomplete draft rows in both groups', async () => {
  const data = {
    homeAbout: { trajectory: [{ title: null }] },
    approach: { methods: [{ title: null }] },
  };
  const result = await apply(data);
  const trajectory = result.homeAbout!.trajectory![0].readingKey;
  const method = result.approach!.methods![0].readingKey;
  expect(z.uuid().safeParse(trajectory).success).toBe(true);
  expect(z.uuid().safeParse(method).success).toBe(true);
  expect(method).not.toBe(trajectory);
});

it('keeps identities attached to row IDs after title changes and reorder', async () => {
  const originalDoc = {
    homeAbout: {
      trajectory: [
        { id: 'a', readingKey: first },
        { id: 'b', readingKey: second },
      ],
    },
  };
  const result = await apply(
    {
      homeAbout: {
        trajectory: [
          { id: 'b', title: 'Renamed second' },
          { id: 'a', readingKey: null, title: 'Renamed first' },
        ],
      },
    },
    originalDoc,
  );
  expect(result.homeAbout!.trajectory!.map((row) => row.readingKey)).toEqual([second, first]);
});

it.each(['trajectory', 'methods'] as const)(
  'rejects changing an established %s row reading identity',
  async (field) => {
    const group = field === 'trajectory' ? 'homeAbout' : 'approach';
    await expect(async () =>
      apply(
        { [group]: { [field]: [{ id: 'a', readingKey: second }] } },
        { [group]: { [field]: [{ id: 'a', readingKey: first }] } },
      ),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: `${group}.${field}.0.readingKey`,
            message: 'Chave de leitura não pode ser alterada.',
          }),
        ]),
      },
    });
  },
);

it('rejects duplicate reading identities across trajectory and method rows', async () => {
  await expect(async () =>
    apply({
      homeAbout: { trajectory: [{ readingKey: first }] },
      approach: { methods: [{ readingKey: first }] },
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({
          path: 'approach.methods.0.readingKey',
          message: 'Chave de leitura repetida neste documento.',
        }),
      ]),
    },
  });
});

it('accepts an explicit corresponding key for a new row in another translation', async () => {
  const result = await apply({
    locale: 'en',
    approach: { methods: [{ readingKey: first, title: 'Translated method' }] },
  });
  expect(result.approach!.methods![0].readingKey).toBe(first);
});

it('does not invent missing groups or rows in a sparse draft', async () => {
  expect(await apply({ locale: 'pt' })).toEqual({ locale: 'pt' });
});
