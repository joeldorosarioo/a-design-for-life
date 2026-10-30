import { expect, test } from '@playwright/test';
// Install at src/features/language-switcher/components/reading-position.e2e.test.ts.
// This relative import is intentional for that repository destination; do not run this C: draft directly.
import { createPublicPortfolioFixture } from '../../../../testing/fixtures/public-portfolio';

type Portfolio = Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
let portfolio: Portfolio;

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(120_000);
  const serialRunner = testInfo.config.workers === 1 && !testInfo.config.fullyParallel;
  if (!serialRunner) throw new Error('The reading journey requires one serial owned test worker.');
  portfolio = await createPublicPortfolioFixture('e2-reading-position-first', { serialRunner });
});

test.afterAll(async () => {
  await portfolio?.destroy();
});

test('keeps the visible Home section at the same viewport position when switching PT to EN', async ({
  page,
  context,
}) => {
  await context.clearCookies({ name: 'portfolio_locale' });

  // A missing control is only a genuine behavior RED after both public pages actually return200.
  const targetBaseline = await context.request.get(portfolio.locales.en.homePath);
  expect(targetBaseline.status()).toBe(200);
  expect(targetBaseline.headers()['set-cookie']).toBeUndefined();
  expect(await targetBaseline.text()).toContain(portfolio.locales.en.homeTitle);

  const sourceResponse = await page.goto(portfolio.locales.pt.homePath);
  expect(sourceResponse?.status()).toBe(200);
  expect((await sourceResponse!.allHeaders())['set-cookie']).toBeUndefined();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    `${portfolio.locales.pt.homeTitle} ${portfolio.locales.pt.homeEmphasis}`,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const section = page.getByRole('main').locator('[data-reading-key="home-approach"]');
  await expect(section).toHaveCount(1);
  const header = page.locator('header').filter({
    has: page.getByRole('link', { name: portfolio.locales.pt.brand, exact: true }),
  });
  await expect(header).toHaveCount(1);
  const desiredTop = Math.max(
    200,
    (await header.evaluate((element) => element.getBoundingClientRect().height)) + 24,
  );
  // Sticky Header on desktop/mobile was explicitly approved after this test's first draft.
  // Its CSS/controller are still unimplemented until the coordinator records actual E2E RED.
  await section.evaluate((element, top) => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({ top: element.getBoundingClientRect().top - top, behavior: 'instant' });
  }, desiredTop);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(section).toBeInViewport();
  const sourceTop = await section.evaluate((element) => element.getBoundingClientRect().top);
  const sourceScrollY = await page.evaluate(() => window.scrollY);

  const english = page.getByRole('button', { name: 'English', exact: true });
  await expect(english).toHaveCount(1);
  // Fail rather than let Playwright auto-scroll an offscreen Header and invalidate sourceTop.
  await expect(english).toBeInViewport();
  const manualPreference = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/language-preference' &&
      response.request().method() === 'POST',
  );

  await english.click();

  const saved = await manualPreference;
  expect(saved.status()).toBe(204);
  expect((await saved.allHeaders())['set-cookie']).toMatch(
    /portfolio_locale=en;.*Max-Age=15552000/i,
  );
  await expect.poll(() => new URL(page.url()).pathname).toBe(portfolio.locales.en.homePath);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    `${portfolio.locales.en.homeTitle} ${portfolio.locales.en.homeEmphasis}`,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Do not wait forever for lazy images below the reading target. Intrinsic layout is
    // already reserved; decode complete resources and allow the destination commit to lay out.
    await Promise.all(
      Array.from(document.images)
        .filter((image) => image.complete)
        .map((image) => image.decode().catch(() => undefined)),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const translatedSection = page.getByRole('main').locator('[data-reading-key="home-approach"]');
  await expect(translatedSection).toHaveCount(1);
  await expect(translatedSection).toBeInViewport();
  await expect
    .poll(async () =>
      Math.abs(
        (await translatedSection.evaluate((element) => element.getBoundingClientRect().top)) -
          sourceTop,
      ),
    )
    .toBeLessThanOrEqual(2);
  // The fixture has two PT and nine EN paragraphs before this section. Copying scrollY
  // cannot satisfy the same-key/same-viewport contract when those heights differ.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - sourceScrollY)).toBeGreaterThan(2);
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'portfolio_locale')?.value,
  ).toBe('en');
});
