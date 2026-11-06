import { assertIsolatedTestEnvironment } from '../../../../testing/setup/test-environment';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { CaseContent } from '@/payload-types';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { editorialHead, releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import {
  installPublicationProvider,
  runtimePublication,
} from '@/helpers/payload/publication-runtime';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { portfolioPublicationCoordinator } from '@/config/publication';
import { getPublishedCases } from './get-published-cases';
import { getPublishedCase } from './get-published-case';
import { getFeaturedCases } from './get-featured-cases';
import { getPreviewCases } from './get-preview-cases';
import { restoreCaseDraft } from './restore-case-draft';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
let previousDirectory: string;
let mediaId: string;
const owned: { collection: 'cases' | 'case-content'; id: string }[] = [];

beforeAll(async () => {
  assertIsolatedTestEnvironment(process.env);
  fixture = await createEditorialPayloadFixture('e2-card-copy-' + randomUUID());
  previousDirectory = runtimePublication().directory;
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-card-copy-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  mediaId = (await mediaMetadataFixture(fixture.payload)).id;
});

afterAll(async () => {
  if (fixture) {
    try {
      for (const item of owned) {
        const req = await fixture.request();
        const head = await editorialHead(item.collection, item.id, req);
        if (head.leaseToken && head.leaseOwner === fixture.user.id)
          await releaseEditorialLease(item.collection, item.id, head.leaseToken, req);
      }
    } finally {
      if (previousDirectory)
        installPublicationProvider(() => portfolioPublicationCoordinator(previousDirectory));
      await fixture.payload.destroy();
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
});

async function parent() {
  const saved = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic card-copy test identity', featured: true },
    req: await fixture.request(),
    overrideAccess: false,
  });
  owned.push({ collection: 'cases', id: saved.id });
  await confirmTestPublication(saved, await fixture.request());
  return saved.id;
}
async function create(
  caseId: string,
  locale: 'pt' | 'en',
  extra: Partial<CaseContent> = {},
  published = false,
) {
  const saved = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(mediaId),
      case: caseId,
      locale,
      title: `Synthetic ${locale} detail`,
      eyebrow: `Synthetic ${locale} detail eyebrow`,
      titleEmphasis: 'emphasis',
      ...extra,
      _status: published ? 'published' : 'draft',
    } as never,
    draft: !published,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  owned.push({ collection: 'case-content', id: saved.id });
  if (published) await confirmTestPublication(saved, await fixture.request());
  return saved;
}
async function save(id: string, data: Partial<CaseContent>, published = false) {
  const req = await observedRequest('case-content', id, await fixture.request());
  const token = req.headers.get('x-editorial-lease');
  try {
    const saved = await fixture.payload.update({
      collection: 'case-content',
      id,
      data: { ...data, _status: published ? 'published' : 'draft' } as never,
      draft: !published,
      depth: 0,
      req,
      overrideAccess: false,
    });
    if (published) await confirmTestPublication(saved, await fixture.request());
    return saved;
  } finally {
    if (token) await releaseEditorialLease('case-content', id, token, await fixture.request());
  }
}
async function root() {
  const captured = await readPublicRoot(directory);
  if (!captured) throw new Error('Expected real Native-confirmed Root.');
  return captured;
}
async function card(locale: 'pt' | 'en', caseId: string) {
  const result = await getPublishedCases(locale, await root());
  if (!result.ok) throw new Error('Confirmed cards unavailable.');
  return result.value.find((item) => item.caseId === caseId);
}

it('persists optional card fields in Native drafts and versions without publishing them', async () => {
  const caseId = await parent();
  const before = await root();
  const draft = await create(caseId, 'pt', {
    cardTitle: 'Synthetic private card title',
    cardEyebrow: 'Synthetic private card eyebrow',
  });
  const reread = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(reread).toMatchObject({
    cardTitle: 'Synthetic private card title',
    cardEyebrow: 'Synthetic private card eyebrow',
  });
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: draft.id } },
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(versions.docs[0].version).toMatchObject({
    cardTitle: draft.cardTitle,
    cardEyebrow: draft.cardEyebrow,
  });
  const preview = await getPreviewCases('pt', await fixture.request());
  expect(preview).toMatchObject({
    ok: true,
    value: {
      cases: expect.arrayContaining([
        expect.objectContaining({ caseId, title: draft.cardTitle, eyebrow: draft.cardEyebrow }),
      ]),
    },
  });
  expect(await readPublicRoot(directory)).toEqual(before);
  expect(await card('pt', caseId)).toBeUndefined();
});

it('publishes independent PT and EN card copy while preserving each detail and SEO', async () => {
  const caseId = await parent();
  for (const locale of ['pt', 'en'] as const) {
    const published = await create(
      caseId,
      locale,
      { cardTitle: `Synthetic ${locale} card`, cardEyebrow: `Synthetic ${locale} card eyebrow` },
      true,
    );
    expect(await card(locale, caseId)).toMatchObject({
      title: published.cardTitle,
      eyebrow: published.cardEyebrow,
    });
    expect(await getPublishedCase(locale, published.slug!, await root())).toMatchObject({
      ok: true,
      value: {
        title: `Synthetic ${locale} detail emphasis`,
        eyebrow: `Synthetic ${locale} detail eyebrow`,
        seo: { title: `Synthetic ${locale} detail emphasis` },
      },
    });
    expect(await getFeaturedCases(locale, await root())).toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ caseId, title: published.cardTitle }),
      ]),
    });
  }
  expect(await card('pt', caseId)).toMatchObject({ title: 'Synthetic pt card' });
});

it('publishes fallback copy when overrides are omitted or whitespace', async () => {
  const caseId = await parent();
  await create(caseId, 'pt', {}, true);
  await create(caseId, 'en', { cardTitle: '  \n ', cardEyebrow: '' }, true);
  for (const locale of ['pt', 'en'] as const)
    expect(await card(locale, caseId)).toMatchObject({
      title: `Synthetic ${locale} detail emphasis`,
      eyebrow: `Synthetic ${locale} detail eyebrow`,
    });
});

it('keeps confirmed card copy stable across private edits and clears, then publishes the fallback', async () => {
  const caseId = await parent();
  const published = await create(
    caseId,
    'pt',
    { cardTitle: 'Synthetic confirmed card', cardEyebrow: 'Synthetic confirmed eyebrow' },
    true,
  );
  const captured = await root();
  await save(published.id, {
    cardTitle: 'Synthetic private edit',
    cardEyebrow: 'Synthetic private eyebrow',
  });
  const cleared = await save(published.id, { cardTitle: null, cardEyebrow: null });
  expect(cleared).toMatchObject({ cardTitle: null, cardEyebrow: null });
  expect(await root()).toEqual(captured);
  expect(await card('pt', caseId)).toMatchObject({
    title: 'Synthetic confirmed card',
    eyebrow: 'Synthetic confirmed eyebrow',
  });
  const preview = await getPreviewCases('pt', await fixture.request());
  expect(preview).toMatchObject({
    ok: true,
    value: {
      cases: expect.arrayContaining([
        expect.objectContaining({
          caseId,
          title: 'Synthetic pt detail emphasis',
          eyebrow: 'Synthetic pt detail eyebrow',
        }),
      ]),
    },
  });
  await save(published.id, {}, true);
  expect(await card('pt', caseId)).toMatchObject({
    title: 'Synthetic pt detail emphasis',
    eyebrow: 'Synthetic pt detail eyebrow',
  });
});

it('restores historical card copy only to a draft, without changing the confirmed Root', async () => {
  const caseId = await parent();
  const first = await create(caseId, 'pt', {
    cardTitle: 'Synthetic historical card',
    cardEyebrow: 'Synthetic historical eyebrow',
  });
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: first.id } },
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const versionId = versions.docs[0].id;
  await save(
    first.id,
    { cardTitle: 'Synthetic current card', cardEyebrow: 'Synthetic current eyebrow' },
    true,
  );
  const captured = await root();
  const req = await observedRequest('case-content', first.id, await fixture.request());
  const token = req.headers.get('x-editorial-lease');
  try {
    expect(
      await restoreCaseDraft(
        {
          contentId: first.id,
          versionId,
          expectedRevision: req.headers.get('x-editorial-revision')!,
        },
        req,
      ),
    ).toMatchObject({ ok: true });
  } finally {
    if (token)
      await releaseEditorialLease('case-content', first.id, token, await fixture.request());
  }
  const restored = await fixture.payload.findByID({
    collection: 'case-content',
    id: first.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(restored).toMatchObject({
    _status: 'draft',
    cardTitle: 'Synthetic historical card',
    cardEyebrow: 'Synthetic historical eyebrow',
  });
  expect(await root()).toEqual(captured);
  expect(await card('pt', caseId)).toMatchObject({ title: 'Synthetic current card' });
});

it('rejects non-text card input before Native sanitization and preserves the draft revision', async () => {
  const caseId = await parent();
  const draft = await create(caseId, 'en', { cardTitle: 'Synthetic retained card' });
  for (const data of [{ cardTitle: { text: 'Invalid object' } }, { cardEyebrow: 3 }]) {
    const req = await observedRequest('case-content', draft.id, await fixture.request());
    const token = req.headers.get('x-editorial-lease');
    try {
      await expect(
        fixture.payload.update({
          collection: 'case-content',
          id: draft.id,
          data: data as never,
          draft: true,
          req,
          overrideAccess: false,
        }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      if (token)
        await releaseEditorialLease('case-content', draft.id, token, await fixture.request());
    }
  }
  const reread = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(reread).toMatchObject({
    cardTitle: 'Synthetic retained card',
    editorialRevision: draft.editorialRevision,
  });
});
