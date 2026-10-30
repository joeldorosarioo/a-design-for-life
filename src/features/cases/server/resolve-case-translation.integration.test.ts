import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { resolveCaseTranslation } from './resolve-case-translation';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-case-translation-availability');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('classifies healthy draft-only translations through Native metadata while missing public coverage stays unavailable', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic translation metadata' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(parent, await fixture.request());
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  const captured = (await readPublicRoot(runtimePublication().directory))!;
  await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: parent.id,
      locale: 'en',
      slug: `private-${randomUUID()}`,
      title: 'PRIVATE untranslated body',
      _status: 'draft',
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await resolveCaseTranslation({ caseId: parent.id, targetLocale: 'en', root: captured }),
  ).toEqual({ ok: true, value: { kind: 'not-public' } });
  const incomplete = { ...captured, subjects: { ...captured.subjects } };
  delete incomplete.subjects[`case-content/${published.id}`];
  expect(
    await resolveCaseTranslation({ caseId: parent.id, targetLocale: 'pt', root: incomplete }),
  ).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});

it('uses a captured confirmed withdrawal even when a newer root is present on disk', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic captured withdrawal' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(parent, await fixture.request());
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'en',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  const directory = runtimePublication().directory;
  const before = (await readPublicRoot(directory))!;
  const withdrawn = await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    data: { _status: 'draft' },
    req: await observedRequest('case-content', published.id, await fixture.request()),
    overrideAccess: false,
  });
  await confirmTestPublication(withdrawn, await fixture.request());
  const captured = (await readPublicRoot(directory))!;
  try {
    await withPublicRootWriter(directory, async (_, commit) =>
      commit({ ...before, generation: randomUUID() }),
    );
    expect(
      await resolveCaseTranslation({ caseId: parent.id, targetLocale: 'en', root: captured }),
    ).toEqual({ ok: true, value: { kind: 'not-public' } });
  } finally {
    await withPublicRootWriter(directory, async (_, commit) =>
      commit({ ...captured, generation: randomUUID() }),
    );
  }
});
