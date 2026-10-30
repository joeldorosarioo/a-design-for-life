import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { retryPublicationUpdate } from '@/helpers/payload/publication-updates';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import { portfolioPublicationCoordinator } from './publication';
import { readPublishedPortfolio } from './read-published-portfolio';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.8-native-portfolio-read');
  await clearStructuralFixture(fixture.payload);
  directory = await mkdtemp(path.join(tmpdir(), 'e18-native-reader-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory) {
    if (!directory.startsWith(path.join(tmpdir(), 'e18-native-reader-')))
      throw new Error('Unsafe fixture cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});
async function confirm(saved: {
  latestPublicationIntent?: string | null;
  editorialRevision?: string | null;
}) {
  expect(
    await retryPublicationUpdate(saved.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({
    ok: true,
    value: { state: 'public', targetRevision: saved.editorialRevision },
  });
}
it('projeta dois cases e dependências da mesma geração, preservando drafts privados e gerações anteriores', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'published',
    } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(profile);
  const navigation = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'published' } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(navigation);
  const a = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic A', sortOrder: 8, featured: true },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const b = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic B', sortOrder: 2, featured: false },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const oldSlug = `aggregate-old-${randomUUID()}`;
  const bSlug = `aggregate-b-${randomUUID()}`;
  const first = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: a.id,
      locale: 'pt',
      title: 'Confirmed A',
      slug: oldSlug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(first);
  const second = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: b.id,
      locale: 'pt',
      title: 'Confirmed B',
      slug: bSlug,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(second);
  await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: a.id,
      locale: 'en',
      title: 'PRIVATE English draft',
      slug: `private-en-${randomUUID()}`,
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const privateCase = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'PRIVATE PT' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: privateCase.id,
      locale: 'pt',
      title: 'PRIVATE Portuguese draft',
      slug: `private-pt-${randomUUID()}`,
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const oldRoot = (await readPublicRoot(directory))!;
  const before = await readPublishedPortfolio('pt', oldRoot);
  expect(before).toMatchObject({
    ok: true,
    value: {
      generation: oldRoot.generation,
      count: 2,
      cases: [{ title: 'Confirmed B' }, { title: 'Confirmed A' }],
      featured: [{ title: 'Confirmed A' }],
      navigation: { contacts: { email: 'synthetic@example.invalid' } },
    },
  });
  const newSlug = `aggregate-new-${randomUUID()}`;
  const pending = await fixture.payload.update({
    collection: 'case-content',
    id: first.id,
    data: { _status: 'published', title: 'Confirmed replacement A', slug: newSlug },
    req: await observedRequest('case-content', first.id, await fixture.request()),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: profile.id,
    data: { _status: 'draft', identity: { ...profile.identity, name: 'PRIVATE profile draft' } },
    draft: true,
    req: await observedRequest('professional-profiles', profile.id, await fixture.request()),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'site-navigation',
    id: navigation.id,
    data: { _status: 'draft', header: { ...navigation.header, brandLabel: 'PRIVATE brand draft' } },
    draft: true,
    req: await observedRequest('site-navigation', navigation.id, await fixture.request()),
    overrideAccess: false,
  });
  const reordered = await fixture.payload.update({
    collection: 'cases',
    id: a.id,
    data: { sortOrder: 0, featured: false },
    req: await observedRequest('cases', a.id, await fixture.request()),
    overrideAccess: false,
  });
  await confirm(reordered);
  const newRoot = (await readPublicRoot(directory))!;
  expect(newRoot.generation).not.toBe(oldRoot.generation);
  expect(await readPublishedPortfolio('pt', oldRoot)).toEqual(before);
  const afterOrder = await readPublishedPortfolio('pt', newRoot);
  expect(afterOrder).toMatchObject({
    ok: true,
    value: {
      generation: newRoot.generation,
      count: 2,
      cases: [{ title: 'Confirmed A' }, { title: 'Confirmed B' }],
      featured: [],
      profile: { identity: { name: 'Synthetic name' } },
      navigation: { brand: { label: 'Synthetic brandLabel' } },
    },
  });
  expect(JSON.stringify(afterOrder)).not.toContain('PRIVATE');
  expect(JSON.stringify(afterOrder)).not.toContain(newSlug);
  await confirm(pending);
  const confirmed = await readPublishedPortfolio('pt');
  expect(confirmed).toMatchObject({
    ok: true,
    value: { count: 2, cases: [{ title: 'Confirmed replacement A' }, { title: 'Confirmed B' }] },
  });
  if (!confirmed.ok) throw new Error('Expected confirmed aggregate');
  const route = confirmed.value.routes.find((item) => item.caseId === a.id)!;
  expect(route).toMatchObject({
    path: `/pt/cases/${newSlug}`,
    canonical: `/pt/cases/${newSlug}`,
    history: [`/pt/cases/${oldSlug}`],
    alternates: { pt: `/pt/cases/${newSlug}` },
    seo: { title: 'Confirmed replacement A' },
  });
  expect(route.alternates).not.toHaveProperty('en');
  expect(confirmed.value.sitemap).toContain(`/pt/cases/${newSlug}`);
  expect(confirmed.value.sitemap).not.toContain(`/pt/cases/${oldSlug}`);
  expect(JSON.stringify(confirmed)).not.toContain('PRIVATE');
  expect(await readPublishedPortfolio('pt', oldRoot)).toEqual(before);
});
