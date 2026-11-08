import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  profilePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { clearStructuralFixture } from '../../../../testing/fixtures/editorial-payload';
import { retryPublicationUpdate } from '@/helpers/payload/publication-updates';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { getPublishedProfile } from './get-published-profile';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.8-confirmed-profile-reader');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('lê exclusivamente a geração confirmada explícita enquanto o Native contém publicação nova pendente', async () => {
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const saved = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'published',
    } as never,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(
    await retryPublicationUpdate(saved.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const all = (await readPublicRoot(runtimePublication().directory))!;
  const key = `professional-profiles/${saved.id}`;
  const generation = { ...all, subjects: { [key]: all.subjects[key] } };
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: saved.id,
    data: {
      _status: 'published',
      identity: { name: 'PRIVATE pending profile', role: 'Pending role' },
    },
    overrideAccess: false,
    req: await observedRequest('professional-profiles', saved.id, await fixture.request()),
  });
  expect(await getPublishedProfile('pt', fixture.payload, generation)).toMatchObject({
    ok: true,
    value: { identity: { name: 'Synthetic name' } },
  });
});

import { navigationFixture } from '../../../../testing/fixtures/editorial-lifecycle';
import { getPublishedNavigation } from '@/features/site-navigation/server';
it('compõe navegação e currículo somente da mesma geração confirmada enquanto a navegação Native é pendente', async () => {
  const saved = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'published' } as never,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(
    await retryPublicationUpdate(saved.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const all = (await readPublicRoot(runtimePublication().directory))!;
  const generation = {
    ...all,
    subjects: Object.fromEntries(
      Object.entries(all.subjects).filter(
        ([key]) =>
          key.startsWith('professional-profiles/') || key === `site-navigation/${saved.id}`,
      ),
    ),
  };
  await fixture.payload.update({
    collection: 'site-navigation',
    id: saved.id,
    data: {
      _status: 'published',
      header: { ...saved.header, brandLabel: 'PRIVATE pending brand' },
    },
    overrideAccess: false,
    req: await observedRequest('site-navigation', saved.id, await fixture.request()),
  });
  expect(await getPublishedNavigation('pt', fixture.payload, generation)).toMatchObject({
    ok: true,
    value: {
      brand: { label: 'Synthetic brandLabel' },
      contacts: { email: 'synthetic@example.invalid' },
    },
  });
});
