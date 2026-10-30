import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let rootBefore: PublicRoot | null;
let imageId: string;
let pdfId: string;
const ids = {} as Record<'pt' | 'en', { profile: string; navigation: string; content: string }>;
const password = 'Synthetic-editorial-test-password-123!';
const privateTitle = (locale: string, page: string) =>
  `PRIVATE ${locale.toUpperCase()} ${page} HTTP`;
const pathFor = (locale: 'pt' | 'en', page: 'home' | 'about' | 'cases' | 'case') =>
  page === 'case'
    ? `/preview-ui/${locale}/case-content/${ids[locale].content}/case`
    : `/preview-ui/${locale}/professional-profiles/${ids[locale].profile}/${page}`;
const origin = () => process.env.SITE_ORIGIN!;

test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off',
  extraHTTPHeaders: { origin: process.env.SITE_ORIGIN! },
});
test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(120_000);
  if (testInfo.config.workers !== 1 || testInfo.config.fullyParallel)
    throw new Error('Private structural fixtures require the owned serial test runner.');
  fixture = await createEditorialPayloadFixture('e2-private-pages-http');
  await clearStructuralFixture(fixture.payload);
  rootBefore = await readPublicRoot(runtimePublication().directory);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  imageId = image.id;
  pdfId = pdf.id;
  const parent = await fixture.payload.create({
    collection: 'cases',
    draft: true,
    data: { internalTitle: 'PRIVATE HTTP SOURCE', featured: true },
    req: await fixture.request(),
    overrideAccess: false,
  });
  for (const locale of ['pt', 'en'] as const) {
    const base = profilePublicationFixture(image.id, pdf.id);
    const profile = await fixture.payload.create({
      collection: 'professional-profiles',
      draft: true,
      data: {
        ...base,
        locale,
        home: {
          ...(base.home as Record<string, unknown>),
          title: privateTitle(locale, 'home'),
          titleEmphasis: null,
        },
        listing: {
          ...(base.listing as Record<string, unknown>),
          title: privateTitle(locale, 'cases'),
        },
        about: { ...(base.about as Record<string, unknown>), title: privateTitle(locale, 'about') },
        _status: 'draft',
      } as never,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const navigation = await fixture.payload.create({
      collection: 'site-navigation',
      draft: true,
      data: { ...navigationFixture(), locale, _status: 'draft' } as never,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const content = await fixture.payload.create({
      collection: 'case-content',
      draft: true,
      data: {
        ...casePublicationFixture(image.id),
        case: parent.id,
        locale,
        slug: null,
        title: privateTitle(locale, 'case'),
        _status: 'draft',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    ids[locale] = { profile: profile.id, navigation: navigation.id, content: content.id };
  }
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(rootBefore);
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});

async function login(request: APIRequestContext) {
  const response = await request.post('/api/users/login', {
    data: { email: fixture.user.email, password },
  });
  expect(response.status()).toBe(200);
  expect(Object.hasOwn(await response.json(), 'token')).toBe(false);
}
function expectPrivate(headers: Record<string, string>) {
  expect(headers['cache-control']).toContain('private');
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['set-cookie']).toBeUndefined();
}
async function flight(request: APIRequestContext, pathname: string, prefetch = false) {
  const headers: Record<string, string> = { rsc: '1' };
  if (prefetch) headers['next-router-prefetch'] = '1';
  let response = await request.get(pathname, { headers, maxRedirects: 0 });
  if (response.status() === 307) {
    const target = new URL(response.headers()['location'], origin());
    expect(target.origin).toBe(origin());
    expect(target.pathname).toBe(new URL(pathname, origin()).pathname);
    expect([...target.searchParams.keys()]).toEqual(['_rsc']);
    response = await request.get(target.href, { headers, maxRedirects: 0 });
  }
  return response;
}

test('denies anonymous HTML, HEAD and Flight before any private document can stream', async ({
  request,
}) => {
  for (const pathname of [pathFor('pt', 'home'), pathFor('pt', 'case'), '/preview-ui/invalid']) {
    for (const method of ['GET', 'HEAD'] as const) {
      const response = await request.fetch(pathname, {
        method,
        maxRedirects: 0,
        headers: { 'if-none-match': '*' },
      });
      expect(response.status()).toBe(401);
      expectPrivate(response.headers());
      expect(await response.text()).toBe('');
      expect(response.headers()['location']).toBeUndefined();
    }
    const response = await request.get(pathname, { maxRedirects: 0, headers: { rsc: '1' } });
    expect(response.status()).toBe(401);
    expectPrivate(response.headers());
    expect(await response.text()).toBe('');
  }
});

for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: renders all four saved draft pages without JavaScript or public media destinations`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: origin(),
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { origin: origin() },
    });
    try {
      await login(context.request);
      const page = await context.newPage();
      for (const kind of ['home', 'about', 'cases', 'case'] as const) {
        const response = await page.goto(pathFor(locale, kind));
        expect(response?.status()).toBe(200);
        expectPrivate(response!.headers());
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
          privateTitle(locale, kind),
        );
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const links = page.locator('a[href]');
        const publicHrefs = await links.evaluateAll((elements) =>
          elements
            .map((element) => element.getAttribute('href'))
            .filter((href) => /^\/(?:pt|en)(?:\/|$|[?#])/.test(href ?? '')),
        );
        expect(publicHrefs).toEqual([]);
        expect(
          await page
            .locator(
              'link[rel="canonical"], link[rel="alternate"][hreflang], meta[property^="og:"]',
            )
            .count(),
        ).toBe(0);
        const rasters = page.locator(`img[src="/preview-media/${imageId}/original"]`);
        expect(await rasters.count()).toBeGreaterThan(0);
        await expect(rasters.first()).not.toHaveAttribute('srcset');
        await expect(
          page.locator(`a[href="/preview-media/${pdfId}/original"]`).first(),
        ).toHaveAttribute('target', '_blank');
        await expect(page.locator('img[src*="/_next/image"]')).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });
}

test('keeps authorized document, HEAD and Flight private and omits Native credentials from their bodies', async ({
  request,
}) => {
  await login(request);
  const pathname = pathFor('pt', 'home');
  const document = await request.get(pathname);
  expect(document.status()).toBe(200);
  expectPrivate(document.headers());
  const head = await request.head(pathname);
  expect(head.status()).toBe(200);
  expectPrivate(head.headers());
  expect(await head.text()).toBe('');
  const rsc = await flight(request, pathname);
  expect(rsc.status()).toBe(200);
  expectPrivate(rsc.headers());
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  const prefetched = await flight(request, pathname, true);
  expect(prefetched.status()).toBe(200);
  expectPrivate(prefetched.headers());
  expect(prefetched.headers()['content-type']).toContain('text/x-component');
  for (const body of [await document.text(), await rsc.text()]) {
    expect(body).toContain(privateTitle('pt', 'home'));
    for (const forbidden of [
      fixture.user.email,
      fixture.user.id,
      password,
      '"sessions":',
      '"latestPublicationIntent":',
      '"editorialRevision":',
    ])
      expect(body.includes(forbidden)).toBe(false);
  }
  const prefetchBody = await prefetched.text();
  for (const forbidden of [fixture.user.email, fixture.user.id, password, '"sessions":'])
    expect(prefetchBody.includes(forbidden)).toBe(false);
});

test('delivers private image/PDF bytes only through authenticated preview-media and rejects optimizer bypasses', async ({
  request,
  playwright,
}) => {
  await login(request);
  const image = await request.get(`/preview-media/${imageId}/original`);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  expect(image.headers()['cache-control']).toContain('private');
  expect((await image.body()).subarray(1, 4).toString()).toBe('PNG');
  const pdf = await request.get(`/preview-media/${pdfId}/original`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  const anonymous = await playwright.request.newContext({ baseURL: origin() });
  try {
    for (const id of [imageId, pdfId]) {
      expect((await anonymous.get(`/preview-media/${id}/original`)).status()).toBe(401);
      expect((await anonymous.get(`/media/${id}/original`)).status()).toBe(404);
    }
    const optimizer = await anonymous.get(
      `/_next/image?url=${encodeURIComponent(`/preview-media/${imageId}/original`)}&w=640&q=75`,
    );
    expect(optimizer.status()).toBe(400);
    expect((await optimizer.body()).length).toBe(0);
  } finally {
    await anonymous.dispose();
  }
});

test('rejects foreign origins, forged scopes, duplicated parameters and writes before the private Page', async ({
  request,
}) => {
  await login(request);
  const pathname = pathFor('pt', 'home');
  for (const [target, headers, expected] of [
    [pathname, { origin: 'https://outside.invalid' }, 401],
    [pathname, { 'sec-fetch-site': 'cross-site' }, 403],
    [pathname.replace('/pt/', '/en/'), {}, 403],
    [`${pathname}?id=forged`, {}, 400],
    [`${pathname}?returnTo=/pt&returnTo=/en`, {}, 400],
    ['/preview-ui/pt/users/00000000-0000-4000-8000-000000000001/home', {}, 400],
  ] as const) {
    const response = await request.get(target, { headers, maxRedirects: 0 });
    expect(response.status()).toBe(expected);
    expectPrivate(response.headers());
    expect(await response.text()).toBe('');
  }
  const write = await request.post(pathname, { data: { locale: 'en' } });
  expect(write.status()).toBe(405);
  expect(write.headers()['allow']).toBe('GET, HEAD');
  expectPrivate(write.headers());
});

test('reads a newly saved draft on the same URL without mutating its confirmed public generation', async ({
  request,
}) => {
  await login(request);
  const first = await request.get(pathFor('pt', 'home'));
  expect(first.status()).toBe(200);
  expect(await first.text()).toContain(privateTitle('pt', 'home'));
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: ids.pt.profile,
    draft: true,
    data: { home: { title: 'PRIVATE NEWLY SAVED HOME HTTP' }, _status: 'draft' },
    req: await observedRequest('professional-profiles', ids.pt.profile, await fixture.request()),
    overrideAccess: false,
  });
  const next = await request.get(pathFor('pt', 'home'));
  expect(next.status()).toBe(200);
  expect(await next.text()).toContain('PRIVATE NEWLY SAVED HOME HTTP');
  expectPrivate(next.headers());
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(rootBefore);
});

test('revokes the same session for document, HEAD, Flight and original draft media', async ({
  request,
}) => {
  await login(request);
  expect((await request.get(pathFor('en', 'home'))).status()).toBe(200);
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  for (const method of ['GET', 'HEAD'] as const) {
    const response = await request.fetch(pathFor('en', 'home'), { method, maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expectPrivate(response.headers());
    expect(await response.text()).toBe('');
  }
  expect(
    (await request.get(pathFor('en', 'home'), { headers: { rsc: '1' }, maxRedirects: 0 })).status(),
  ).toBe(401);
  expect((await request.get(`/preview-media/${imageId}/original`)).status()).toBe(401);
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(rootBefore);
});
