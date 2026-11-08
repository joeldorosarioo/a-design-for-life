import { randomUUID } from 'node:crypto';
import { expect, test, type APIResponse } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../../../testing/fixtures/public-portfolio';
import { observedRequest } from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';

type Locale = 'pt' | 'en';
type Portfolio = Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
let portfolio: Portfolio;
let privatePt: { path: string; title: string };
const messages = {} as Record<
  Locale,
  {
    notFoundTitle: string;
    caseUnavailableTitle: string;
    temporaryFailureTitle: string;
    footerTitle: string;
  }
>;
const guardedHeaders = [
  'content-type',
  'cache-control',
  'x-robots-tag',
  'location',
  'etag',
  'retry-after',
] as const;
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off', video: 'off' });

test.beforeAll(async ({}, info) => {
  test.setTimeout(120_000);
  portfolio = await createPublicPortfolioFixture('e2-negative-cases-http', {
    serialRunner: info.config.workers === 1 && !info.config.fullyParallel,
  });
  for (const locale of ['pt', 'en'] as const) {
    const prefix = `${portfolio.namespace} ${locale.toUpperCase()} EDITORIAL`;
    messages[locale] = {
      notFoundTitle: `${prefix}404`,
      caseUnavailableTitle: `${prefix}410`,
      temporaryFailureTitle: `${prefix}503`,
      footerTitle: `${prefix} CURRENT FOOTER`,
    };
    const selected = await portfolio.payload.find({
      collection: 'site-navigation',
      where: { locale: { equals: locale } },
      draft: true,
      depth: 0,
      limit: 2,
      req: await portfolio.request(),
      overrideAccess: false,
    });
    const navigation = selected.docs[0];
    expect(selected.totalDocs).toBe(1);
    expect(navigation.header?.brandLabel).toBe(portfolio.locales[locale].brand);
    const req = await observedRequest('site-navigation', navigation.id, await portfolio.request());
    const token = req.headers.get('x-editorial-lease');
    try {
      const description = Array.from(
        { length: 16 },
        (_, index) => `${prefix} synthetic state paragraph ${index + 1}; test material only.`,
      ).join('\n\n');
      const saved = await portfolio.payload.update({
        collection: 'site-navigation',
        id: navigation.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
        req,
        data: {
          _status: 'published',
          footer: { ...navigation.footer, title: messages[locale].footerTitle },
          messages: {
            ...navigation.messages,
            notFoundTitle: messages[locale].notFoundTitle,
            notFoundDescription: description,
            caseUnavailableTitle: messages[locale].caseUnavailableTitle,
            caseUnavailableDescription: description,
            temporaryFailureTitle: messages[locale].temporaryFailureTitle,
            temporaryFailureDescription: description,
          },
        },
      });
      await confirmTestPublication(saved, await portfolio.request());
    } finally {
      if (token)
        await releaseEditorialLease(
          'site-navigation',
          navigation.id,
          token,
          await portfolio.request(),
        );
    }
  }
  const parent = await portfolio.payload.create({
    collection: 'cases',
    draft: true,
    data: { internalTitle: `${portfolio.namespace} private negative fixture` },
    req: await portfolio.request(),
    overrideAccess: false,
  });
  expect(parent.latestPublicationIntent).toBeFalsy();
  const slug = `${portfolio.namespace}-private-pt`;
  const title = `PRIVATE NEGATIVE MARKER ${randomUUID()}`;
  const draft = await portfolio.payload.create({
    collection: 'case-content',
    draft: true,
    data: { case: parent.id, locale: 'pt', slug, title, _status: 'draft' },
    req: await portfolio.request(),
    overrideAccess: false,
  });
  expect(draft.latestPublicationIntent).toBeFalsy();
  privatePt = { path: `/pt/cases/${slug}`, title };
});
test.afterAll(async () => {
  await portfolio?.destroy();
});

function contract(response: APIResponse) {
  const headers = response.headers();
  return Object.fromEntries(guardedHeaders.map((key) => [key, headers[key] ?? null]));
}
async function expectNegative(
  response: APIResponse,
  locale: Locale,
  status: 404 | 410 | 503,
  visitedPath: string,
) {
  expect(response.status()).toBe(status);
  const headers = response.headers();
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['content-type']).toContain('text/html');
  expect(headers.etag).toBeUndefined();
  expect(headers.location).toBeUndefined();
  expect(headers['set-cookie']).toBeUndefined();
  expect(
    Object.keys(headers).some(
      (key) =>
        key.startsWith('x-portfolio-render-') ||
        key.startsWith('x-middleware-request-x-portfolio-render-'),
    ),
  ).toBe(false);
  if (status === 503) expect(headers['retry-after']).toBe('60');
  const html = await response.text();
  const title =
    status === 404
      ? messages[locale].notFoundTitle
      : status === 410
        ? messages[locale].caseUnavailableTitle
        : messages[locale].temporaryFailureTitle;
  expect(html).toContain(title);
  expect(html).toContain(messages[locale].footerTitle);
  expect(html).toContain(`<html lang="${locale}">`);
  expect(html).toContain('id="contact"');
  expect(html).toContain(`href="${portfolio.locales[locale].resumeHref}"`);
  expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  expect(html).toContain(`mailto:synthetic-${locale}-${portfolio.namespace}@example.invalid`);
  expect(html).not.toContain(visitedPath.split('/').at(-1)!);
  expect(html).not.toContain('FORGED NEGATIVE CONTEXT');
  expect(html).not.toMatch(
    /self\.__next|x-portfolio-render-context|<script|rel="canonical"|rel="alternate"/,
  );
  return html;
}
for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: unknown and real private reservations have identical editorial404 bytes for HTML,HEAD,conditionals and RSC`, async ({
    request,
  }) => {
    const privateCase = locale === 'pt' ? privatePt : portfolio.cases.ptOnly.locales.en;
    const unknown = `/${locale}/cases/${portfolio.namespace}-unknown-${locale}-${randomUUID().slice(0, 8)}`;
    const plain = await request.get(unknown, { maxRedirects: 0 });
    const expected = await expectNegative(plain, locale, 404, unknown);
    const privateResponse = await request.get(privateCase.path, { maxRedirects: 0 });
    expect(await expectNegative(privateResponse, locale, 404, privateCase.path)).toBe(expected);
    expect(contract(privateResponse)).toEqual(contract(plain));
    expect(expected).not.toContain(privateCase.title);
    for (const flight of [false, true])
      for (const pathname of [unknown, privateCase.path]) {
        const target = flight ? `${pathname}?_rsc=` : pathname;
        const headers = {
          'If-None-Match': '*',
          'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT',
          'x-portfolio-render-context': 'FORGED NEGATIVE CONTEXT',
          ...(flight ? { RSC: '1' } : { 'Next-Url': pathname }),
        };
        const get = await request.get(target, { maxRedirects: 0, headers });
        expect(await expectNegative(get, locale, 404, pathname)).toBe(expected);
        expect(contract(get)).toEqual(contract(plain));
        const head = await request.head(target, { maxRedirects: 0, headers });
        expect(head.status()).toBe(404);
        expect(contract(head)).toEqual(contract(plain));
        expect(await head.body()).toHaveLength(0);
      }
  });
}
test('real PT withdrawal retains410 editorial state while the confirmed EN detail stays200', async ({
  request,
}) => {
  const pt = portfolio.cases.first.locales.pt,
    en = portfolio.cases.first.locales.en;
  expect((await request.get(pt.path)).status()).toBe(200);
  const req = await observedRequest('case-content', pt.contentId, await portfolio.request());
  const token = req.headers.get('x-editorial-lease');
  try {
    const saved = await portfolio.payload.update({
      collection: 'case-content',
      id: pt.contentId,
      data: { _status: 'draft' },
      draft: false,
      depth: 0,
      req,
      overrideAccess: false,
    });
    await confirmTestPublication(saved, await portfolio.request());
  } finally {
    if (token)
      await releaseEditorialLease('case-content', pt.contentId, token, await portfolio.request());
  }
  const gone = await request.get(pt.path, { headers: { 'If-None-Match': '*' } });
  await expectNegative(gone, 'pt', 410, pt.path);
  expect(await gone.text()).not.toContain(pt.title);
  const head = await request.head(pt.path, {
    headers: { 'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT' },
  });
  expect(head.status()).toBe(410);
  expect(await head.body()).toHaveLength(0);
  const english = await request.get(en.path);
  expect(english.status()).toBe(200);
  expect(await english.text()).toContain(en.title);
});
test('missing root coverage for a real Native public intent is503 with retry and editorial structure, never a live body', async ({
  request,
}) => {
  const published = portfolio.cases.second.locales.pt;
  const native = await portfolio.payload.findByID({
    collection: 'case-content',
    id: published.contentId,
    draft: false,
    depth: 0,
    req: await portfolio.request(),
    overrideAccess: false,
  });
  expect(native._status).toBe('published');
  expect(native.publicConfirmed).toBe(true);
  expect(native.latestPublicationIntent).toBeTruthy();
  const directory = publicRootDirectory({
    APP_ENV: 'test',
    DATABASE_URI: process.env.DATABASE_URI!,
    SITE_ORIGIN: process.env.SITE_ORIGIN!,
  });
  const original = await readPublicRoot(directory);
  expect(original?.subjects[`case-content/${published.contentId}`]).toBeDefined();
  if (!original) throw new Error('Expected confirmed fixture root.');
  try {
    await withPublicRootWriter(directory, async (_current, commit) =>
      commit({
        generation: randomUUID(),
        subjects: Object.fromEntries(
          Object.entries(original.subjects).filter(
            ([key]) => key !== `case-content/${published.contentId}`,
          ),
        ),
      }),
    );
    const response = await request.get(published.path, {
      headers: { 'If-None-Match': '*', 'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT' },
    });
    const html = await expectNegative(response, 'pt', 503, published.path);
    expect(html).not.toContain(published.title);
    const head = await request.head(published.path);
    expect(head.status()).toBe(503);
    expect(head.headers()['retry-after']).toBe('60');
    expect(await head.body()).toHaveLength(0);
  } finally {
    await withPublicRootWriter(directory, async (_current, commit) => commit(original));
  }
  expect((await request.get(published.path)).status()).toBe(200);
});
test('compiled CSS serves200 and keeps current contact visible/focused below sticky desktop/mobile headers, including text scaling', async ({
  page,
  request,
}) => {
  const css = await request.get('/_portfolio/case-state.css');
  expect(css.status()).toBe(200);
  expect(css.headers()['content-type']).toContain('text/css');
  expect(await css.text()).not.toMatch(/@(?:import|theme|tailwind)\b/);
  const pathname = `/pt/cases/${portfolio.namespace}-geometry-unknown`;
  for (const width of [1440, 390])
    for (const scaled of [false, true]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(404);
      expect(await response!.text()).toContain(messages.pt.notFoundTitle);
      if (scaled) await page.addStyleTag({ content: 'html{font-size:200%}' });
      const header = page.locator('header.case-state-header');
      await expect(header).toHaveCSS('position', 'sticky');
      await expect(header.locator('nav a')).toHaveCount(4);
      await header.locator('a[href="#contact"]').click();
      const contact = page.locator('footer #contact');
      await expect(contact).toBeFocused();
      await expect(contact).toBeInViewport();
      const rects = await page.evaluate(() => {
        const header = document.querySelector('header.case-state-header')!.getBoundingClientRect();
        const contact = document.querySelector('footer #contact')!.getBoundingClientRect();
        return {
          headerTop: header.top,
          headerBottom: header.bottom,
          headerHeight: header.height,
          contactTop: contact.top,
          viewport: innerHeight,
        };
      });
      expect(Math.abs(rects.headerTop)).toBeLessThanOrEqual(1);
      expect(rects.headerHeight).toBeLessThanOrEqual(rects.viewport / 2 + 1);
      expect(rects.contactTop).toBeGreaterThanOrEqual(rects.headerBottom - 1);
    }
  const pdf = await request.get(portfolio.locales.pt.resumeHref);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
});
