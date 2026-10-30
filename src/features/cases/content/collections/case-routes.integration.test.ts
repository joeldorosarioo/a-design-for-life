import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-case-routes');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('o registro físico rejeita duas reservas concorrentes de cases diferentes para locale/slug', async () => {
  const candidates = await Promise.all(
    ['A', 'B'].map(async (label) => {
      const shared = await fixture.payload.create({
        collection: 'cases',
        data: { internalTitle: `Synthetic route fixture ${label}` },
        overrideAccess: false,
        req: await fixture.request(),
      });
      const content = await fixture.payload.create({
        collection: 'case-content',
        data: { case: shared.id, locale: 'pt', _status: 'draft' },
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      });
      return { case: shared.id, content: content.id };
    }),
  );
  const slug = `synthetic-${randomUUID()}`;
  // Privileged Local API seeds only the private route registry in an isolated test database.
  const results = await Promise.allSettled(
    candidates.map(async (candidate) =>
      fixture.payload.create({
        collection: 'case-routes',
        data: { ...candidate, locale: 'pt', slug, everPublished: false, state: 'draft' },
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const english = await fixture.payload.create({
    collection: 'case-routes',
    data: { ...candidates[0], locale: 'en', slug, everPublished: false, state: 'draft' },
    overrideAccess: true,
    req: await fixture.request(),
  });
  expect(english.locale).toBe('en');
});
