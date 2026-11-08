import { expect, test } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../../../testing/fixtures/public-portfolio';

let portfolio: Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
test.beforeAll(async ({}, info) => {
  test.setTimeout(120_000);
  portfolio = await createPublicPortfolioFixture('e2-seo-http', {
    serialRunner: info.config.workers === 1 && !info.config.fullyParallel,
  });
});
test.afterAll(async () => {
  await portfolio?.destroy();
});
for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: emits its own canonical and only confirmed alternates in server HTML`, async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Expected local test origin.');
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const copy = portfolio.locales[locale];
      const other = locale === 'pt' ? 'en' : 'pt';
      for (const [pathname, alternate] of [
        [copy.homePath, portfolio.locales[other].homePath],
        [copy.aboutPath, portfolio.locales[other].aboutPath],
        [copy.listingPath, portfolio.locales[other].listingPath],
        [portfolio.cases.first.locales[locale].path, portfolio.cases.first.locales[other].path],
      ]) {
        const response = await page.goto(pathname);
        expect(response?.status()).toBe(200);
        expect(response!.headers()['set-cookie']).toBeUndefined();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          new URL(pathname, baseURL).href,
        );
        await expect(page.locator(`link[rel="alternate"][hreflang="${locale}"]`)).toHaveAttribute(
          'href',
          new URL(pathname, baseURL).href,
        );
        await expect(page.locator(`link[rel="alternate"][hreflang="${other}"]`)).toHaveAttribute(
          'href',
          new URL(alternate, baseURL).href,
        );
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
          'content',
          new URL(pathname, baseURL).href,
        );
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        expect(await response!.text()).toContain(new URL(pathname, baseURL).href);
      }
    } finally {
      await context.close();
    }
  });
}
test('does not advertise a private English case translation through HTML metadata', async ({
  browser,
  baseURL,
  request,
}) => {
  if (!baseURL) throw new Error('Expected local test origin.');
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const subject = portfolio.cases.ptOnly;
    expect((await page.goto(subject.locales.pt.path))?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new URL(subject.locales.pt.path, baseURL).href,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="pt"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
    const denied = await request.get(subject.locales.en.path);
    expect(denied.status()).toBe(404);
    expect(await denied.text()).not.toContain(subject.locales.en.title);
    expect(denied.headers()['x-robots-tag']).toContain('noindex');
  } finally {
    await context.close();
  }
});
test('keeps nonproduction robots and sitemap closed even when synthetic public pages exist', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['set-cookie']).toBeUndefined();
  const policy = await robots.text();
  expect(policy).toContain('User-Agent: *');
  expect(policy).toContain('Disallow: /');
  expect(policy).not.toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['set-cookie']).toBeUndefined();
  expect(sitemap.headers()['content-type']).toContain('xml');
  const xml = await sitemap.text();
  expect(xml).toContain('<urlset');
  expect(xml).not.toContain('<url>');
  expect(xml).not.toContain('/preview');
  expect(xml).not.toContain(portfolio.cases.first.locales.pt.path);
});
