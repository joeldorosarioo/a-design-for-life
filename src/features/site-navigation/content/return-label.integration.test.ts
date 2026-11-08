import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { SiteNavigation } from '@/payload-types';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  navigationFixture,
  profilePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import {
  installPublicationProvider,
  runtimePublication,
} from '@/helpers/payload/publication-runtime';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { portfolioPublicationCoordinator } from '@/config/publication';
import { getPublishedNavigation } from '../server/get-published-navigation';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
let previousDirectory: string;
const ids: Partial<Record<'pt' | 'en', string>> = {};

beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-return-label-' + randomUUID());
  previousDirectory = runtimePublication().directory;
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-return-label-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  for (const locale of ['pt', 'en'] as const) {
    const profile = await fixture.payload.create({
      collection: 'professional-profiles',
      data: {
        ...profilePublicationFixture(image.id, pdf.id),
        locale,
        _status: 'published',
      } as never,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(profile, await fixture.request());
    const navigation = await fixture.payload.create({
      collection: 'site-navigation',
      data: { locale, _status: 'draft' },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    ids[locale] = navigation.id;
  }
});
afterAll(async () => {
  if (previousDirectory)
    installPublicationProvider(() => portfolioPublicationCoordinator(previousDirectory));
  await fixture?.payload.destroy();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function save(locale: 'pt' | 'en', controls: SiteNavigation['controls'], published = false) {
  const id = ids[locale]!;
  const req = await observedRequest('site-navigation', id, await fixture.request());
  const token = req.headers.get('x-editorial-lease');
  try {
    const data = navigationFixture();
    const saved = await fixture.payload.update({
      collection: 'site-navigation',
      id,
      data: {
        ...data,
        controls: { ...(data.controls as Record<string, unknown>), ...controls },
        _status: published ? 'published' : 'draft',
      } as never,
      draft: !published,
      req,
      overrideAccess: false,
    });
    if (published) await confirmTestPublication(saved, await fixture.request());
    return saved;
  } finally {
    if (token) await releaseEditorialLease('site-navigation', id, token, await fixture.request());
  }
}
async function confirmed(locale: 'pt' | 'en') {
  return getPublishedNavigation(locale, undefined, await readPublicRoot(directory));
}

it('persists the independent return label in Native drafts and versions without changing the other language', async () => {
  const captured = await readPublicRoot(directory);
  await save('pt', {
    casesLabel: 'casos sintéticos',
    backToProjectsLabel: 'Retornar aos projetos sintéticos',
  });
  const current = await fixture.payload.findByID({
    collection: 'site-navigation',
    id: ids.pt!,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(current.controls).toMatchObject({
    casesLabel: 'casos sintéticos',
    backToProjectsLabel: 'Retornar aos projetos sintéticos',
  });
  const versions = await fixture.payload.findVersions({
    collection: 'site-navigation',
    where: { parent: { equals: ids.pt! } },
    sort: '-createdAt',
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(versions.docs[0].version.controls).toMatchObject({
    backToProjectsLabel: 'Retornar aos projetos sintéticos',
  });
  const english = await fixture.payload.findByID({
    collection: 'site-navigation',
    id: ids.en!,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(english.controls?.backToProjectsLabel ?? null).toBeNull();
  expect(await readPublicRoot(directory)).toEqual(captured);
});

it('publishes a custom return label independently and preserves it while a private draft is cleared', async () => {
  await save(
    'en',
    { casesLabel: 'case studies', backToProjectsLabel: 'Back to synthetic projects' },
    true,
  );
  const captured = await readPublicRoot(directory);
  await save('en', { casesLabel: 'case studies', backToProjectsLabel: null });
  expect(await confirmed('en')).toMatchObject({
    ok: true,
    value: {
      controls: { casesLabel: 'case studies', backToProjectsLabel: 'Back to synthetic projects' },
    },
  });
  expect(await readPublicRoot(directory)).toEqual(captured);
});

it.each([null, '', '  '])(
  'allows explicit publication with optional return copy %s',
  async (backToProjectsLabel) => {
    await save('en', { casesLabel: 'case studies', backToProjectsLabel }, true);
    expect(await confirmed('en')).toMatchObject({
      ok: true,
      value: { controls: { casesLabel: 'case studies', backToProjectsLabel } },
    });
  },
);
