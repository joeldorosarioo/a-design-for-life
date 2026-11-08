import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq } from 'payload';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../testing/fixtures/editorial-auth';
import {
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
  casePublicationFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { authorizePrivatePreviewRequest } from './prepare-private-preview-request';
import { readPrivatePageModel } from './read-private-page-model';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let profileId: string;
let navigationId: string;
let caseId: string;
let caseEnId: string;
let rootBefore: PublicRoot | null;
const origin = () => process.env.SITE_ORIGIN!;
const options = () => ({ origin: origin() });
function request(
  collection = 'professional-profiles',
  id = profileId,
  page = 'home',
  locale = 'pt',
  authenticated = true,
) {
  return new Request(`${origin()}/preview-ui/${locale}/${collection}/${id}/${page}`, {
    headers: {
      origin: origin(),
      'sec-fetch-site': 'same-origin',
      ...(authenticated ? { cookie } : {}),
    },
  });
}
async function actorRequest() {
  const headers = new Headers({ cookie, origin: origin(), 'sec-fetch-site': 'same-origin' });
  const session = await fixture.payload.auth({ headers });
  return createLocalReq({ user: session.user ?? undefined, req: { headers } }, fixture.payload);
}
async function denied(response: Awaited<ReturnType<typeof readPrivatePageModel>>, status: number) {
  expect(response.ok).toBe(false);
  if (response.ok) throw new Error('Expected closed private model failure.');
  expect(response.response.status).toBe(status);
  expect(response.response.headers.get('cache-control')).toContain('private');
  expect(response.response.headers.get('cache-control')).toContain('no-store');
  expect(response.response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(await response.response.text()).toBe('');
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-private-page-model');
  installPayloadProvider(async () => fixture.payload);
  const login = await authHTTP(
    'login',
    { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    undefined,
    'e2-private-page-model',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  expect((await actorRequest()).user?.collection).toBe('users');
  await clearStructuralFixture(fixture.payload);
  rootBefore = await readPublicRoot(runtimePublication().directory);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    draft: true,
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'draft',
      home: { title: 'PRIVATE HOME INITIAL' },
    } as never,
    req: await actorRequest(),
    overrideAccess: false,
  });
  profileId = profile.id;
  const navigation = await fixture.payload.create({
    collection: 'site-navigation',
    draft: true,
    data: { ...navigationFixture(), locale: 'pt', _status: 'draft' } as never,
    req: await actorRequest(),
    overrideAccess: false,
  });
  navigationId = navigation.id;
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'PRIVATE MODEL SOURCE', featured: true },
    req: await actorRequest(),
    overrideAccess: false,
  });
  for (const locale of ['pt', 'en'] as const) {
    const detail = await fixture.payload.create({
      collection: 'case-content',
      draft: true,
      data: {
        ...casePublicationFixture(image.id),
        case: parent.id,
        locale,
        slug: null,
        title: `PRIVATE CASE ${locale.toUpperCase()} INITIAL`,
        _status: 'draft',
      },
      req: await actorRequest(),
      overrideAccess: false,
    });
    if (locale === 'pt') caseId = detail.id;
    else caseEnId = detail.id;
  }
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('has a real independently authorized Native primary source before composing its model', async () => {
  const primary = await authorizePrivatePreviewRequest(request(), options());
  expect(primary.ok).toBe(true);
  if (primary.ok) expect(primary.value.context.document.id).toBe(profileId);
});
it.each(['home', 'about', 'cases'])(
  'composes an authorized %s profile draft with only private targets',
  async (page) => {
    const result = await readPrivatePageModel(
      request('professional-profiles', profileId, page),
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected profile draft model.');
    const base = `/preview-ui/pt/professional-profiles/${profileId}`;
    expect(result.value).toMatchObject({
      locale: 'pt',
      kind: page,
      portfolio: { profile: { home: { title: 'PRIVATE HOME INITIAL' } } },
      targets: { home: `${base}/home`, cases: `${base}/cases`, about: `${base}/about` },
      navigation: { brand: { href: `${base}/home` } },
      routeContext: {
        locale: 'pt',
        pageScope: { collection: 'professional-profiles', id: profileId },
      },
    });
  },
);
it('keeps an authorized navigation primary ID as its real structural target scope', async () => {
  const result = await readPrivatePageModel(
    request('site-navigation', navigationId, 'about'),
    options(),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected navigation draft model.');
  expect(result.value.routeContext.pageScope).toEqual({
    collection: 'site-navigation',
    id: navigationId,
  });
  expect(result.value.targets.home).toBe(`/preview-ui/pt/site-navigation/${navigationId}/home`);
});
it('composes a slugless private case with the unique real same-locale structural source ID', async () => {
  const result = await readPrivatePageModel(request('case-content', caseId, 'case'), options());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected slugless case draft model.');
  expect(result.value.kind).toBe('case');
  expect(result.value.detail).toMatchObject({
    title: 'PRIVATE CASE PT INITIAL',
    path: `/preview-ui/pt/case-content/${caseId}/case`,
  });
  expect(result.value.routeContext.pageScope).toEqual({
    collection: 'professional-profiles',
    id: profileId,
  });
  expect(result.value.targets.home).toBe(`/preview-ui/pt/professional-profiles/${profileId}/home`);
  expect(
    result.value.routeContext.routes.some(
      (route) =>
        route.contentId === caseId && route.path === `/preview-ui/pt/case-content/${caseId}/case`,
    ),
  ).toBe(true);
  expect(JSON.stringify(result.value)).not.toContain('PRIVATE CASE EN INITIAL');
});
it('independently rejects anonymous access and a selected document from another locale', async () => {
  await denied(
    await readPrivatePageModel(
      request('professional-profiles', profileId, 'home', 'pt', false),
      options(),
    ),
    401,
  );
  await denied(
    await readPrivatePageModel(
      request('professional-profiles', profileId, 'home', 'en'),
      options(),
    ),
    403,
  );
  await denied(
    await readPrivatePageModel(request('case-content', caseId, 'case', 'en'), options()),
    403,
  );
});
it('fails closed when an authorized case locale lacks its structural presentation source', async () => {
  await denied(
    await readPrivatePageModel(request('case-content', caseEnId, 'case', 'en'), options()),
    503,
  );
});
it('reauthenticates and reads fresh saved drafts on every call without publishing or replacing earlier DTOs', async () => {
  const incoming = request();
  const first = await readPrivatePageModel(incoming, options());
  expect(first.ok).toBe(true);
  const caseFirst = await readPrivatePageModel(request('case-content', caseId, 'case'), options());
  expect(caseFirst.ok).toBe(true);
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: profileId,
    draft: true,
    data: { home: { title: 'PRIVATE HOME UPDATED' }, _status: 'draft' },
    req: await observedRequest('professional-profiles', profileId, await actorRequest()),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'case-content',
    id: caseId,
    draft: true,
    data: { title: 'PRIVATE CASE UPDATED', _status: 'draft' },
    req: await observedRequest('case-content', caseId, await actorRequest()),
    overrideAccess: false,
  });
  const second = await readPrivatePageModel(incoming, options());
  const caseSecond = await readPrivatePageModel(request('case-content', caseId, 'case'), options());
  expect(second.ok).toBe(true);
  expect(caseSecond.ok).toBe(true);
  if (first.ok && second.ok) {
    expect(first.value.portfolio.profile.home.title).toBe('PRIVATE HOME INITIAL');
    expect(second.value.portfolio.profile.home.title).toBe('PRIVATE HOME UPDATED');
  }
  if (caseFirst.ok && caseSecond.ok) {
    expect(caseFirst.value.detail?.title).toBe('PRIVATE CASE PT INITIAL');
    expect(caseSecond.value.detail?.title).toBe('PRIVATE CASE UPDATED');
  }
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(rootBefore);
  for (const [collection, id] of [
    ['professional-profiles', profileId],
    ['site-navigation', navigationId],
    ['case-content', caseId],
  ] as const) {
    expect(
      (
        await fixture.payload.findByID({
          collection,
          id,
          draft: true,
          depth: 0,
          req: await actorRequest(),
          overrideAccess: false,
        })
      )._status,
    ).toBe('draft');
  }
});
it('returns only DTO presentation and contextual route data, without Native account or publication authority', async () => {
  const result = await readPrivatePageModel(request(), options());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected presentation DTO model.');
  const json = JSON.stringify(result.value);
  for (const key of [
    'payload',
    'req',
    'user',
    'document',
    'sessions',
    'editorialRevision',
    'latestPublicationIntent',
    'guardRevision',
    'generation',
    'sitemap',
    'canonical',
  ])
    expect(json).not.toContain(`"${key}":`);
  expect(json).not.toContain(fixture.user.id);
  expect(json).not.toContain(cookie);
  expect(Object.keys(result.value.portfolio).sort()).toEqual([
    'cases',
    'featured',
    'locale',
    'navigation',
    'profile',
    'routes',
  ]);
});
it('rejects the same Request after revoking its Native session instead of reusing a prior authorization', async () => {
  const incoming = request();
  expect((await readPrivatePageModel(incoming, options())).ok).toBe(true);
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  await denied(await readPrivatePageModel(incoming, options()), 401);
});
