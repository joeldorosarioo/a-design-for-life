import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../../testing/fixtures/editorial-payload';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;

beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-site-navigation-identity');
});

beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);

  for (const locale of ['pt', 'en'] as const) {
    await fixture.payload.create({
      collection: 'site-navigation',

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

describe('identidade estrutural: site-navigation', () => {
  it('bloqueia exclusão estrutural no servidor mesmo com overrideAccess', async () => {
    const docs = await fixture.payload.find({
      collection: 'site-navigation',

      where: { locale: { equals: 'pt' } },

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    await expect(
      fixture.payload.delete({
        collection: 'site-navigation',

        id: docs.docs[0].id,

        req: await fixture.request(),

        overrideAccess: true,
      }),
    ).rejects.toThrow(/estrutural.*excluído/i);

    expect(
      (
        await fixture.payload.find({
          collection: 'site-navigation',

          draft: true,

          req: await fixture.request(),

          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(2);
  });

  it('bloqueia troca de idioma sem depender de colisão do índice', async () => {
    const docs = await fixture.payload.find({
      collection: 'site-navigation',

      where: { locale: { equals: 'pt' } },

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    await fixture.payload.db.deleteVersions({
      collection: 'site-navigation',

      where: { 'version.locale': { equals: 'en' } },
    });

    await fixture.payload.db.deleteMany({
      collection: 'site-navigation',

      where: { locale: { equals: 'en' } },
    });

    await expect(
      fixture.payload.update({
        collection: 'site-navigation',

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
      collection: 'site-navigation',

      id: docs.docs[0].id,

      draft: true,

      req: await fixture.request(),

      overrideAccess: false,
    });

    expect(preserved.locale).toBe('pt');
  });
});

it('exige locale válido no rascunho estrutural incompleto: site-navigation', async () => {
  await clearStructuralFixture(fixture.payload);

  for (const data of [{}, { locale: 'fr' }]) {
    await expect(
      fixture.payload.create({
        collection: 'site-navigation',
        data: data as never,
        draft: true,
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});

it('rejeita finalidade, URL livre ou currículo duplicado no header em vez de ignorar a entrada', async () => {
  const current = await fixture.payload.find({
    collection: 'site-navigation',
    draft: true,
    where: { locale: { equals: 'pt' } },
    overrideAccess: false,
    req: await fixture.request(),
  });
  for (const header of [
    { projectsHref: '/arbitrary' },
    { items: [{ purpose: 'external', href: 'javascript:alert(1)' }] },
    { resume: 'duplicated.pdf' },
  ]) {
    await expect(
      fixture.payload.update({
        collection: 'site-navigation',
        id: current.docs[0].id,
        data: { header } as never,
        draft: true,
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});
