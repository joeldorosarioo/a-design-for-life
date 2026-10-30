import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../../testing/fixtures/editorial-payload';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;

beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-professional-profile-identity');
});

beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);

  for (const locale of ['pt', 'en'] as const) {
    await fixture.payload.create({
      collection: 'professional-profiles',

      data: { locale, _status: 'draft' },

      draft: true,

      overrideAccess: false,

      req: await fixture.request(),
    });
  }
});

afterAll(async () => {
  await fixture?.payload.destroy();
});

describe('identidade estrutural: professional-profiles', () => {
  it('bloqueia exclusão estrutural no servidor mesmo com overrideAccess', async () => {
    const docs = await fixture.payload.find({
      collection: 'professional-profiles',

      where: { locale: { equals: 'pt' } },

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    await expect(
      fixture.payload.delete({
        collection: 'professional-profiles',

        id: docs.docs[0].id,

        req: await fixture.request(),

        overrideAccess: true,
      }),
    ).rejects.toThrow(/estrutural.*excluído/i);

    expect(
      (
        await fixture.payload.find({
          collection: 'professional-profiles',

          draft: true,

          req: await fixture.request(),

          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(2);
  });

  it('bloqueia troca de idioma sem depender de colisão do índice', async () => {
    const docs = await fixture.payload.find({
      collection: 'professional-profiles',

      where: { locale: { equals: 'pt' } },

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    await fixture.payload.db.deleteVersions({
      collection: 'professional-profiles',

      where: { 'version.locale': { equals: 'en' } },
    });

    await fixture.payload.db.deleteMany({
      collection: 'professional-profiles',

      where: { locale: { equals: 'en' } },
    });

    await expect(
      fixture.payload.update({
        collection: 'professional-profiles',

        id: docs.docs[0].id,

        data: { locale: 'en' },

        draft: true,

        req: await fixture.request(),

        overrideAccess: true,
      }),
    ).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'locale' })]) },
    });

    const preserved = await fixture.payload.findByID({
      collection: 'professional-profiles',

      id: docs.docs[0].id,

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    expect(preserved.locale).toBe('pt');
  });
});

it('exige locale válido no rascunho estrutural incompleto: professional-profiles', async () => {
  await clearStructuralFixture(fixture.payload);

  for (const data of [{}, { locale: 'fr' }]) {
    await expect(
      fixture.payload.create({
        collection: 'professional-profiles',
        data: data as never,
        draft: true,
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});

it.each([
  { contacts: { linkedin: 'javascript:alert(1)' } },
  { home: { className: 'arbitrary-css', title: 'Synthetic' } },
])('rejeita perfil com link ou estilo fora do contrato: %j', async (data) => {
  const current = await fixture.payload.find({
    collection: 'professional-profiles',
    draft: true,
    where: { locale: { equals: 'pt' } },
    overrideAccess: false,
    req: await fixture.request(),
  });
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: current.docs[0].id,
      data: data as never,
      draft: true,
      overrideAccess: true,
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 400 });
});
