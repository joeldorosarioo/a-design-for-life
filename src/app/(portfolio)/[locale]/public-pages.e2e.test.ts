import { expect, test, type Locator, type Page } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../../../testing/fixtures/public-portfolio';

type Portfolio = Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
type LocaleCopy = Portfolio['locales']['pt'] | Portfolio['locales']['en'];
let portfolio: Portfolio;

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(120_000);
  // Shared structural singletons can only be reset within the owned serial runner.
  const serialRunner = testInfo.config.workers === 1 && !testInfo.config.fullyParallel;
  portfolio = await createPublicPortfolioFixture('e2-public-pages', { serialRunner });
});

test.afterAll(async () => {
  await portfolio?.destroy();
});

function siteHeader(page: Page, copy: LocaleCopy) {
  // A local article/header is not the global banner. Identify the shell by its brand.
  return page
    .locator('header')
    .filter({ has: page.getByRole('link', { name: copy.brand, exact: true }) });
}

async function expectHeaderDestinations(page: Page, copy: LocaleCopy, navigation: Locator) {
  const links = navigation.getByRole('link');
  await expect(links).toHaveCount(4);
  const expected = [
    { name: copy.projects, href: copy.listingPath },
    { name: copy.about, href: copy.aboutPath },
    { name: `${copy.resume} (${copy.newTab})`, href: copy.resumeHref },
    { name: copy.contact, href: '#contact' },
  ];
  for (const [index, item] of expected.entries()) {
    await expect(links.nth(index)).toHaveAccessibleName(item.name);
    await expect(links.nth(index)).toHaveAttribute('href', item.href);
    if (index !== 2) await expect(links.nth(index)).not.toHaveAttribute('target');
  }
  await expect(links.nth(2)).toHaveAttribute('target', '_blank');
  await expect(links.nth(2)).toHaveAttribute('rel', /noopener/);
  await expect(links.nth(2)).toHaveAttribute('rel', /noreferrer/);
  await expect(page.locator('footer #contact')).toHaveCount(1);
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 16; index++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: published Home, About, listing and case are complete in SSR without JavaScript`, async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Expected the configured public test origin.');
    const copy = portfolio.locales[locale];
    const first = portfolio.cases.first.locales[locale];
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    try {
      for (const entry of [
        {
          path: copy.homePath,
          heading: `${copy.homeTitle} ${copy.homeEmphasis}`,
          parts: [copy.homeTitle, copy.homeEmphasis],
        },
        { path: copy.aboutPath, heading: copy.aboutTitle, parts: [copy.aboutTitle] },
        { path: copy.listingPath, heading: copy.listingTitle, parts: [copy.listingTitle] },
        { path: first.path, heading: first.title, parts: [first.title, copy.contextHeading] },
      ]) {
        await test.step(entry.path, async () => {
          const response = await page.goto(entry.path);
          expect(response?.status()).toBe(200);
          const html = await response!.text();
          for (const part of entry.parts) expect(html).toContain(part);
          const main = page.getByRole('main');
          await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
          await expect(main.getByRole('heading', { level: 1 })).toHaveText(entry.heading);
          const header = siteHeader(page, copy);
          await expect(header).toHaveCount(1);
          const navigation = header.getByRole('navigation');
          await expectHeaderDestinations(page, copy, navigation);
          await navigation.getByRole('link', { name: copy.contact, exact: true }).click();
          expect(new URL(page.url()).pathname).toBe(entry.path);
          expect(new URL(page.url()).hash).toBe('#contact');
          await expect(page.locator('footer #contact')).toBeInViewport();
        });
      }
      await page.goto(first.path);
      const toc = page.getByRole('navigation', { name: copy.contents, exact: true });
      const entries = toc.getByRole('link');
      await expect(entries).toHaveCount(2);
      await expect(entries.nth(0)).toHaveAttribute(
        'href',
        `#section-${portfolio.readingKeys.context}`,
      );
      await expect(entries.nth(1)).toHaveAttribute(
        'href',
        `#section-${portfolio.readingKeys.comparison}`,
      );
      await entries.nth(1).click();
      await expect(page.locator(`#section-${portfolio.readingKeys.comparison}`)).toBeInViewport();
      await expect(
        page
          .getByRole('main')
          .getByRole('img', { name: `${copy.prefix} first paired image`, exact: true }),
      ).toHaveCount(1);
      await expect(
        page
          .getByRole('main')
          .getByRole('img', { name: `${copy.prefix} second paired image`, exact: true }),
      ).toHaveCount(1);
      const pair = page.locator(`[data-reading-key="${portfolio.readingKeys.imagePair}"]`);
      await expect(pair.getByRole('img').nth(0)).toHaveAttribute(
        'alt',
        `${copy.prefix} first paired image`,
      );
      await expect(pair.getByRole('img').nth(1)).toHaveAttribute(
        'alt',
        `${copy.prefix} second paired image`,
      );
    } finally {
      await context.close();
    }
  });

  test(`${locale}: listing count/order and Home highlights use only published current-locale translations`, async ({
    page,
  }) => {
    const copy = portfolio.locales[locale];
    const first = portfolio.cases.first.locales[locale];
    const second = portfolio.cases.second.locales[locale];
    const privateEnglish = portfolio.cases.ptOnly.locales.en;
    const listResponse = await page.goto(copy.listingPath);
    expect(listResponse?.status()).toBe(200);
    const listing = page.locator('[data-reading-key="cases-list"]');
    const cards = listing.getByRole('article');
    const count = await cards.count();
    await expect(
      page.getByRole('main').getByText(`${count} ${copy.projects}`, { exact: true }),
    ).toBeVisible();
    const titles = await cards.getByRole('heading', { level: 2 }).allTextContents();
    expect(titles.indexOf(first.title)).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf(second.title)).toBeGreaterThan(titles.indexOf(first.title));
    await expect(listing.getByRole('link', { name: first.title, exact: true })).toHaveAttribute(
      'href',
      first.path,
    );
    await expect(listing.getByRole('link', { name: second.title, exact: true })).toHaveAttribute(
      'href',
      second.path,
    );
    if (locale === 'en') {
      await expect(
        listing.getByRole('heading', { name: privateEnglish.title, exact: true }),
      ).toHaveCount(0);
      expect(await page.content()).not.toContain(privateEnglish.title);
      const privateResponse = await page.request.get(privateEnglish.path);
      expect(privateResponse.status()).toBe(404);
      expect(await privateResponse.text()).not.toContain(privateEnglish.title);
    } else {
      await expect(
        listing.getByRole('heading', {
          name: portfolio.cases.ptOnly.locales.pt.title,
          exact: true,
        }),
      ).toHaveCount(1);
    }
    const homeResponse = await page.goto(copy.homePath);
    expect(homeResponse?.status()).toBe(200);
    await expect(page.locator(`[data-reading-key="${portfolio.readingKeys.method}"]`)).toHaveCSS(
      'min-block-size',
      '266px',
    );
    const featured = page.locator('[data-reading-key="home-projects"]');
    await expect(
      featured.getByRole('heading', { level: 3, name: first.title, exact: true }),
    ).toHaveCount(1);
    await expect(
      featured.getByRole('heading', { level: 3, name: second.title, exact: true }),
    ).toHaveCount(1);
    const featuredTitles = await featured.getByRole('heading', { level: 3 }).allTextContents();
    expect(featuredTitles.indexOf(second.title)).toBeGreaterThan(
      featuredTitles.indexOf(first.title),
    );
    if (locale === 'en') {
      await expect(
        featured.getByRole('heading', { name: privateEnglish.title, exact: true }),
      ).toHaveCount(0);
      expect(await page.content()).not.toContain(privateEnglish.title);
    }
  });

  test(`${locale}: mobile keyboard opens/closes the menu and Contact returns focus to this page footer`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const copy = portfolio.locales[locale];
    const path = portfolio.cases.first.locales[locale].path;
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const trigger = siteHeader(page, copy).getByRole('button', {
      name: copy.openMenu,
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await tabTo(page, trigger);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectHeaderDestinations(page, copy, dialog.getByRole('navigation'));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    const contact = dialog.getByRole('link', { name: copy.contact, exact: true });
    await tabTo(page, contact);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.locator('footer #contact')).toBeFocused();
    await expect(page.locator('footer #contact')).toBeInViewport();
    expect(new URL(page.url()).pathname).toBe(path);
    expect(new URL(page.url()).hash).toBe('#contact');
  });
}
