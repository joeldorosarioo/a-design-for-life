import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq } from 'payload';
import type { CaseContent } from '@/payload-types';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import {
  installPublicationProvider,
  runtimePublication,
} from '@/helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import { pinPublicRoot, readPinnedPublicRoot } from '@/helpers/payload/render-snapshot';
import { portfolioPublicationCoordinator } from '@/config/publication';
import {
  preparePublicRenderRequest,
  readPublicRenderContext,
  PUBLIC_RENDER_CONTEXT_HEADER,
} from '@/config/public-render-context';
import { getPublishedCase } from './get-published-case';
import { getPreviewCase } from './get-preview-case';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
let previousDirectory: string;
let mediaId: string;

beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-cover-presentation-' + randomUUID());
  previousDirectory = runtimePublication().directory;
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-cover-presentation-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  mediaId = (await mediaMetadataFixture(fixture.payload)).id;
});
afterAll(async () => {
  if (previousDirectory)
    installPublicationProvider(() => portfolioPublicationCoordinator(previousDirectory));
  await fixture?.payload.destroy();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function parent() {
  const saved = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic cover presentation' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(saved, await fixture.request());
  return saved.id;
}
async function create(
  caseId: string,
  locale: 'pt' | 'en',
  coverPresentation?: CaseContent['coverPresentation'],
  published = false,
) {
  const saved = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(mediaId),
      case: caseId,
      locale,
      coverPresentation,
      _status: published ? 'published' : 'draft',
    } as never,
    draft: !published,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
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
async function confirmed(locale: 'pt' | 'en', slug: string) {
  return getPublishedCase(locale, slug, await readPublicRoot(directory));
}

it('persists the closed cover choice in private Native content, versions and authenticated preview', async () => {
  const caseId = await parent();
  const before = await readPublicRoot(directory);
  const draft = await create(caseId, 'pt', 'contained-soft');
  const reread = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(reread).toMatchObject({ coverPresentation: 'contained-soft' });
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: draft.id } },
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(versions.docs[0].version).toMatchObject({ coverPresentation: 'contained-soft' });
  expect(await getPreviewCase('pt', draft.id, await fixture.request())).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-soft' },
  });
  expect(await readPublicRoot(directory)).toEqual(before);
  expect(
    await getPreviewCase('pt', draft.id, await createLocalReq({}, fixture.payload)),
  ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
});

it('keeps published cover choices independent by locale and leaves the confirmed snapshot unchanged by draft edits', async () => {
  const caseId = await parent();
  const pt = await create(caseId, 'pt', 'contained-soft', true);
  const en = await create(caseId, 'en', 'contained-cherry', true);
  const captured = await readPublicRoot(directory);
  await save(pt.id, { coverPresentation: 'contained-cherry' });
  expect(await confirmed('pt', pt.slug!)).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-soft' },
  });
  expect(await confirmed('en', en.slug!)).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
  expect(await getPreviewCase('pt', pt.id, await fixture.request())).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
  expect(await readPublicRoot(directory)).toEqual(captured);
});

it('allows clearing the optional choice while preserving the old publication until explicit republish', async () => {
  const published = await create(await parent(), 'en', 'contained-soft', true);
  const captured = await readPublicRoot(directory);
  expect(await save(published.id, { coverPresentation: null })).toMatchObject({
    coverPresentation: null,
  });
  expect(await getPreviewCase('en', published.id, await fixture.request())).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
  expect(await readPublicRoot(directory)).toEqual(captured);
  await save(published.id, {}, true);
  expect(await confirmed('en', published.slug!)).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
});

it('rejects arbitrary presentations before Native sanitization without advancing the revision', async () => {
  const draft = await create(await parent(), 'en', 'contained-cherry');
  for (const coverPresentation of ['cover', '#ffc9d4', { background: 'pink' }])
    await expect(save(draft.id, { coverPresentation } as never)).rejects.toMatchObject({
      status: 400,
    });
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: draft.id,
      draft: true,
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).toMatchObject({
    coverPresentation: 'contained-cherry',
    editorialRevision: draft.editorialRevision,
  });
});

it('reads a real legacy confirmed body through the digest-checked pin without mutating its stored projection', async () => {
  const published = await create(await parent(), 'en', undefined, true);
  const captured = await readPublicRoot(directory);
  if (!captured) throw new Error('Expected the real confirmed test generation.');
  const legacy = structuredClone(captured);
  legacy.generation = randomUUID();
  const stored = legacy.subjects[`case-content/${published.id}`].value;
  if (
    !stored ||
    typeof stored !== 'object' ||
    Array.isArray(stored) ||
    !stored.detail ||
    typeof stored.detail !== 'object' ||
    Array.isArray(stored.detail)
  )
    throw new Error('Expected the confirmed detail projection.');
  delete stored.detail.coverPresentation;
  await withPublicRootWriter(directory, async (_current, commit) => commit(legacy));
  const pin = await pinPublicRoot(directory, legacy);
  const checked = await readPinnedPublicRoot(directory, pin);
  expect(await getPublishedCase('en', published.slug!, checked)).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
  expect(await readPinnedPublicRoot(directory, pin)).toEqual(legacy);
  expect(stored.detail).not.toHaveProperty('coverPresentation');
  const pathname = `/en/cases/${published.slug}`;
  const options = {
    publicationDirectory: directory,
    secret: 'synthetic-cover-render-secret-never-used-outside-tests',
  };
  const decision = await preparePublicRenderRequest(
    new Request(`http://127.0.0.1:3100${pathname}`),
    options,
  );
  expect(decision).toMatchObject({ status: 200 });
  if (!decision || !('requestHeaders' in decision))
    throw new Error('Expected signed render headers.');
  const render = await readPublicRenderContext(decision.requestHeaders, options, { pathname });
  expect(render.root).toEqual(legacy);
  expect(await getPublishedCase('en', published.slug!, render.root)).toMatchObject({
    ok: true,
    value: { coverPresentation: 'contained-cherry' },
  });
  const corrupted = new Headers(decision.requestHeaders);
  const token = corrupted.get(PUBLIC_RENDER_CONTEXT_HEADER)!;
  corrupted.set(
    PUBLIC_RENDER_CONTEXT_HEADER,
    token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'),
  );
  await expect(readPublicRenderContext(corrupted, options, { pathname })).rejects.toThrow(
    'Invalid public render context signature.',
  );
  stored.detail.coverPresentation = 'arbitrary-css';
  legacy.generation = randomUUID();
  await withPublicRootWriter(directory, async (_current, commit) => commit(legacy));
  expect(await confirmed('en', published.slug!)).toMatchObject({
    ok: false,
    error: { code: 'unavailable' },
  });
});
