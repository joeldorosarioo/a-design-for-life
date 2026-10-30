import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import { provisionStructuralDocuments } from './provision-structural-documents';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-provision');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

describe('provisionamento estrutural real', () => {
  // A no-op/missing group would otherwise leave the initial CMS incomplete.
  it('cria exatamente quatro documentos em rascunho e nenhum documento público', async () => {
    await provisionStructuralDocuments(await fixture.request());
    for (const collection of ['site-navigation', 'professional-profiles'] as const) {
      const result = await fixture.payload.find({
        collection,
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      });
      expect(result.totalDocs).toBe(2);
      expect(result.docs.map((doc) => doc.locale).sort()).toEqual(['en', 'pt']);
      expect(result.docs.map((doc) => doc._status)).toEqual(['draft', 'draft']);
      const published = await fixture.payload.find({
        collection,
        draft: false,
        overrideAccess: false,
      });
      expect(published.totalDocs).toBe(0);
    }
  });
  it('repete a configuração sem duplicar nem alterar os quatro documentos', async () => {
    await provisionStructuralDocuments(await fixture.request());
    const before = await Promise.all(
      ['site-navigation', 'professional-profiles'].map(async (collection) => {
        const result = await fixture.payload.find({
          collection: collection as 'site-navigation' | 'professional-profiles',
          draft: true,
          overrideAccess: false,
          req: await fixture.request(),
          sort: 'locale',
        });
        return result.docs.map((doc) => ({
          id: doc.id,
          locale: doc.locale,
          status: doc._status,
          updatedAt: doc.updatedAt,
        }));
      }),
    );
    await provisionStructuralDocuments(await fixture.request());
    const after = await Promise.all(
      ['site-navigation', 'professional-profiles'].map(async (collection) => {
        const result = await fixture.payload.find({
          collection: collection as 'site-navigation' | 'professional-profiles',
          draft: true,
          overrideAccess: false,
          req: await fixture.request(),
          sort: 'locale',
        });
        return result.docs.map((doc) => ({
          id: doc.id,
          locale: doc.locale,
          status: doc._status,
          updatedAt: doc.updatedAt,
        }));
      }),
    );
    expect(after.map((docs) => docs.length)).toEqual([2, 2]);
    expect(after).toEqual(before);
  });
  it('duas inicializações independentes concorrentes terminam nos mesmos quatro rascunhos', async () => {
    const reqA = await fixture.request();
    const reqB = await fixture.request();
    await Promise.all([provisionStructuralDocuments(reqA), provisionStructuralDocuments(reqB)]);
    for (const collection of ['site-navigation', 'professional-profiles'] as const) {
      const result = await fixture.payload.find({
        collection,
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      });
      expect(result.totalDocs).toBe(2);
      expect(result.docs.map((doc) => doc.locale).sort()).toEqual(['en', 'pt']);
    }
  });
});
