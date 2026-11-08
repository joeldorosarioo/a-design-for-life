import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq, getPayload } from 'payload';
import config from '@payload-config';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  profilePublicationFixture,
  navigationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import {
  publishedReadResponse,
  publishedReadStatus,
} from '@/helpers/payload/published-read-response';
import { portfolioPublicationCoordinator } from './publication';
import {
  preparePublicRenderRequest,
  readPublicRenderContext,
  type PublicRenderDecision,
} from './public-render-context';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
const secret = 'Synthetic-native-public-render-context-secret-12345';
const unavailable = {
  ok: false,
  error: { code: 'unavailable', message: 'Confirmed content unavailable.' },
} as const;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-public-render-native');
  const native = await getPayload({ config });
  installPayloadProvider(async () => native);
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-render-native-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory?.startsWith(path.join(tmpdir(), 'portfolio-render-native-')))
    await rm(directory, { recursive: true, force: true });
});
function prepare(pathname: string, method = 'GET') {
  return preparePublicRenderRequest(
    new Request(`https://synthetic.invalid${pathname}`, { method }),
    { publicationDirectory: directory, secret },
  );
}
function headers(decision: PublicRenderDecision | null) {
  if (!decision || !('requestHeaders' in decision)) throw new Error('Missing render context');
  return decision.requestHeaders;
}
it('preserves healthy never-published404 using Native count-only classification and the original wrapper', async () => {
  const decision = await prepare('/en');
  expect(decision?.status).toBe(404);
  expect(
    (await readPublicRenderContext(headers(decision), { publicationDirectory: directory, secret }))
      .root,
  ).toBeNull();
  const subject = {
    collection: 'professional-profiles' as const,
    where: { locale: { equals: 'en' } },
  };
  expect(await publishedReadStatus(unavailable, subject, fixture.payload)).toBe(404);
  const response = await publishedReadResponse(
    unavailable,
    subject,
    await createLocalReq({}, fixture.payload),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual(unavailable);
});
it('keeps known structural intents503 when the captured root is absent without granting any Native body', async () => {
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
  await confirmTestPublication(profile, await fixture.request());
  const nav = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'published' } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(nav, await fixture.request());
  const root = (await readPublicRoot(directory))!;
  await unlink(path.join(directory, 'current.json'));
  try {
    const decision = await prepare('/pt');
    expect(decision?.status).toBe(503);
    const read = await readPublicRenderContext(headers(decision), {
      publicationDirectory: directory,
      secret,
    });
    expect(read.root).toBeNull();
    expect(read.context.pin).toBeNull();
    expect((await prepare('/en'))?.status).toBe(404);
    expect(
      await publishedReadStatus(
        unavailable,
        { collection: 'professional-profiles', where: { locale: { equals: 'pt' } } },
        fixture.payload,
      ),
    ).toBe(503);
  } finally {
    await withPublicRootWriter(directory, async (_, commit) => commit(root));
  }
});
it('keeps a real independently published case200 and private/unknown routes identically404', async () => {
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Independent transport case' },
    req: await fixture.request(),
    overrideAccess: false,
  });
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
  const root = (await readPublicRoot(directory))!;
  const decision = await prepare(`/pt/cases/${published.slug}`, 'HEAD');
  expect(decision?.status).toBe(200);
  expect(
    (
      await readPublicRenderContext(
        headers(decision),
        { publicationDirectory: directory, secret },
        { pathname: `/pt/cases/${published.slug}`, method: 'HEAD' },
      )
    ).root,
  ).toEqual(root);
  const privateCase = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Private transport case' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.create({
    collection: 'case-content',
    draft: true,
    data: {
      ...casePublicationFixture(image.id),
      case: privateCase.id,
      locale: 'pt',
      _status: 'draft',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const privateDecision = await prepare(`/pt/cases/${draft.slug}`);
  const unknownDecision = await prepare('/pt/cases/not-a-known-route');
  expect(privateDecision).toEqual({ status: 404, caseStateLocale: 'pt' });
  expect(unknownDecision).toEqual(privateDecision);
});
