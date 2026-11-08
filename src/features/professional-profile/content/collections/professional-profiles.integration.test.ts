import { observedRequest } from '../../../../../testing/fixtures/editorial-lifecycle';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type PostgresAdapter, sql } from '@payloadcms/db-postgres';
import * as editorialFieldsMigration from '@/migrations/20261030_190345_e2_editorial_presentation_fields';

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

        req: await observedRequest(
          'professional-profiles',
          String(docs.docs[0].id),
          await fixture.request(),
        ),

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

        req: await observedRequest(
          'professional-profiles',
          String(docs.docs[0].id),
          await fixture.request(),
        ),

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
      req: await observedRequest(
        'professional-profiles',
        String(current.docs[0].id),
        await fixture.request(),
      ),
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it('persists optional method keywords and native versions independently by locale', async () => {
  const profiles = await fixture.payload.find({
    collection: 'professional-profiles',
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const pt = profiles.docs.find((doc) => doc.locale === 'pt')!;
  const en = profiles.docs.find((doc) => doc.locale === 'en')!;
  const saved = await fixture.payload.update({
    collection: 'professional-profiles',
    id: pt.id,
    draft: true,
    data: {
      approach: {
        methods: [
          {
            title: 'Synthetic method',
            description: 'Synthetic body',
            keywords: 'Research · flows · testing',
          },
        ],
      },
      about: {
        journeyEyebrow: 'Synthetic journey eyebrow',
        approachEyebrow: 'Synthetic approach eyebrow',
        inMotionEyebrow: 'Synthetic motion eyebrow',
      },
    },
    overrideAccess: false,
    req: await observedRequest('professional-profiles', pt.id, await fixture.request()),
  });
  const reread = await fixture.payload.findByID({
    collection: 'professional-profiles',
    id: pt.id,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(reread.approach?.methods).toMatchObject([
    { id: saved.approach?.methods?.[0].id, keywords: 'Research · flows · testing' },
  ]);
  expect(reread.about).toMatchObject({
    journeyEyebrow: 'Synthetic journey eyebrow',
    approachEyebrow: 'Synthetic approach eyebrow',
    inMotionEyebrow: 'Synthetic motion eyebrow',
  });
  const versions = await fixture.payload.findVersions({
    collection: 'professional-profiles',
    where: { parent: { equals: pt.id } },
    sort: '-createdAt',
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(versions.docs[0].version.approach?.methods).toMatchObject([
    { keywords: 'Research · flows · testing' },
  ]);
  expect(versions.docs[0].version.about).toMatchObject({
    journeyEyebrow: 'Synthetic journey eyebrow',
    approachEyebrow: 'Synthetic approach eyebrow',
    inMotionEyebrow: 'Synthetic motion eyebrow',
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'professional-profiles',
        id: en.id,
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).approach?.methods ?? [],
  ).toEqual([]);
});

it('adds nullable presentation columns without replacing legacy profile rows or version identities', async () => {
  const pt = (
    await fixture.payload.find({
      collection: 'professional-profiles',
      where: { locale: { equals: 'pt' } },
      draft: true,
      overrideAccess: false,
      req: await fixture.request(),
    })
  ).docs[0];
  const saved = await fixture.payload.update({
    collection: 'professional-profiles',
    id: pt.id,
    draft: true,
    data: { approach: { methods: [{ title: 'Legacy method', description: 'Legacy body' }] } },
    overrideAccess: false,
    req: await observedRequest('professional-profiles', pt.id, await fixture.request()),
  });
  const req = await fixture.request();
  const transaction = await fixture.payload.db.beginTransaction();
  if (!transaction) throw new Error('Native transaction required');
  req.transactionID = transaction;
  const db = (fixture.payload.db as unknown as PostgresAdapter).sessions[String(transaction)]!.db;
  const rows = async () =>
    (
      await db.execute(
        sql`SELECT id, _parent_id, reading_key, title, description FROM profiles_approach_methods ORDER BY id`,
      )
    ).rows;
  const versions = async () =>
    (
      await db.execute(
        sql`SELECT id, parent_id, version_locale, version_editorial_revision FROM _profiles_v ORDER BY id`,
      )
    ).rows;
  try {
    const before = { rows: await rows(), versions: await versions() };
    await editorialFieldsMigration.down({ db, payload: fixture.payload, req });
    expect(await rows()).toEqual(before.rows);
    expect(await versions()).toEqual(before.versions);
    await editorialFieldsMigration.up({ db, payload: fixture.payload, req });
    expect(await rows()).toEqual(before.rows);
    expect(await versions()).toEqual(before.versions);
    const reread = await fixture.payload.findByID({
      collection: 'professional-profiles',
      id: pt.id,
      draft: true,
      overrideAccess: false,
      req,
    });
    expect(reread.approach?.methods).toMatchObject([
      {
        id: saved.approach?.methods?.[0].id,
        title: 'Legacy method',
        description: 'Legacy body',
        keywords: null,
      },
    ]);
    const columns = await db.execute(
      sql`SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND ((table_name IN ('profiles_approach_methods', '_profiles_v_version_approach_methods') AND column_name='keywords') OR (table_name='site_navigation' AND column_name='controls_case_link_label') OR (table_name='_site_navigation_v' AND column_name='version_controls_case_link_label') OR (table_name='profiles' AND column_name IN ('about_journey_eyebrow','about_approach_eyebrow','about_in_motion_eyebrow')) OR (table_name='_profiles_v' AND column_name IN ('version_about_journey_eyebrow','version_about_approach_eyebrow','version_about_in_motion_eyebrow'))) ORDER BY table_name`,
    );
    expect(columns.rows).toHaveLength(10);
    expect(columns.rows.every((column) => column.is_nullable === 'YES')).toBe(true);
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
});
