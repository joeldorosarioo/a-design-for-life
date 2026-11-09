import { expect, test, type Locator, type Page } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../../../testing/fixtures/public-portfolio';
import { responseGate } from '../../../features/language-switcher/components/reading-position.browser-support';

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

test('public fragment scrolling respects the motion preference', async ({ page }) => {
  const copy = portfolio.locales.en;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(copy.aboutPath);
  const root = page.locator('html');
  await expect(root).toHaveCSS('scroll-behavior', 'smooth');
  await siteHeader(page, copy).getByRole('link', { name: copy.contact, exact: true }).click();
  await expect(page).toHaveURL(`${copy.aboutPath}#contact`);
  await expect(page.locator('footer #contact')).toBeInViewport();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(root).toHaveCSS('scroll-behavior', 'auto');
});

test('a slow case opening shows a skeleton only in the selected card', async ({ page }) => {
  const copy = portfolio.locales.pt;
  const first = portfolio.cases.first.locales.pt;
  const second = portfolio.cases.second.locales.pt;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(copy.listingPath);
  await page.waitForFunction(() =>
    document.documentElement.style.getPropertyValue('--portfolio-header-height'),
  );
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const listing = page.getByRole('main');
  const firstCard = listing.getByRole('article').filter({
    has: page.getByRole('link', { name: first.title, exact: true }),
  });
  const secondCard = listing.getByRole('article').filter({
    has: page.getByRole('link', { name: second.title, exact: true }),
  });
  const pending = '[data-case-opening-pending]';
  const gate = await responseGate(
    page,
    (url) => url.pathname === first.path,
    (request) => request.headers().rsc === '1',
  );

  try {
    await expect(listing.locator(pending)).toHaveCount(0);
    await firstCard.getByRole('link', { name: first.title, exact: true }).click();
    expect((await gate.held).status).toBe(200);
    await expect(listing.getByRole('heading', { level: 1, name: copy.listingTitle })).toBeVisible();
    await expect(firstCard.getByRole('img', { name: 'Synthetic cover' })).toBeVisible();
    await expect(firstCard.locator(pending)).toBeVisible();
    await expect(firstCard.locator(pending).locator('[data-slot="skeleton"]').first()).toHaveCSS(
      'animation-name',
      'none',
    );
    await expect(
      firstCard.locator('[aria-live="polite"]').filter({ hasText: /abrindo/i }),
    ).toHaveCount(1);
    await expect(secondCard).toBeVisible();
    await expect(secondCard.locator(pending)).toHaveCount(0);
    await expect(
      secondCard.locator('[aria-live="polite"]').filter({ hasText: /abrindo/i }),
    ).toHaveCount(0);
    await expect(listing.locator(pending)).toHaveCount(1);

    gate.release();
    await expect(page).toHaveURL(first.path);
    await expect(listing.getByRole('heading', { level: 1, name: first.title })).toBeVisible();
    await expect(listing.locator(pending)).toHaveCount(0);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  } finally {
    await gate.close();
  }
});

test('clicking a project cover expands that cover into the case detail', async ({ page }) => {
  const { caseId, locales } = portfolio.cases.first;
  const first = locales.en;
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(portfolio.locales.en.listingPath);
  await page.waitForFunction(() =>
    document.documentElement.style.getPropertyValue('--portfolio-header-height'),
  );
  const main = page.getByRole('main');
  const card = main.getByRole('article').filter({
    has: page.getByRole('link', { name: first.title, exact: true }),
  });
  const cover = card.getByRole('img', { name: 'Synthetic cover' });
  await cover.scrollIntoViewIfNeeded();
  await cover.evaluate((image) => (image as HTMLImageElement).decode());
  const source = await cover.boundingBox();
  if (!source) throw new Error('Expected a visible source cover.');

  const gate = await responseGate(
    page,
    (url) => url.pathname === first.path,
    (request) => request.headers().rsc === '1',
  );
  try {
    const navigation = page.waitForRequest(
      (request) => new URL(request.url()).pathname === first.path && request.headers().rsc === '1',
      { timeout: 5_000 },
    );
    await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2);
    await navigation;
    expect((await gate.held).status).toBe(200);

    gate.release();
    const observed = await page.waitForFunction((prefix) => {
      const effects = document
        .getAnimations()
        .flatMap(({ effect }) => (effect instanceof KeyframeEffect ? [effect] : []));
      const groupSelector = '::view-transition-group(';
      const group = effects.find(({ pseudoElement }) =>
        pseudoElement?.startsWith(`${groupSelector}${prefix}`),
      );
      const name = group?.pseudoElement?.slice(groupSelector.length, -1);
      const duration = group?.getTiming().duration;
      if (!group || !name || typeof duration !== 'number' || duration <= 360) return null;

      const entrance = effects.find(
        (effect) =>
          effect.pseudoElement?.startsWith('::view-transition-new(') &&
          effect.pseudoElement !== `::view-transition-new(${name})` &&
          (effect.getTiming().delay ?? 0) > 0,
      );
      if (!entrance) return null;

      return {
        old: effects.some(
          ({ pseudoElement }) => pseudoElement === `::view-transition-old(${name})`,
        ),
        next: effects.some(
          ({ pseudoElement }) => pseudoElement === `::view-transition-new(${name})`,
        ),
        widths: group
          .getKeyframes()
          .map(({ width }) => Number.parseFloat(String(width)))
          .filter(Number.isFinite),
      };
    }, `case-cover-en-${caseId}-`);

    await expect(page).toHaveURL(first.path);
    await expect(main.getByRole('heading', { name: first.title, level: 1 })).toBeVisible();
    const detailCover = main.getByRole('img', { name: 'Synthetic cover' });
    const destination = await detailCover.boundingBox();
    if (!destination) throw new Error('Expected a visible destination cover.');
    const expansion = await observed.jsonValue();
    if (!expansion) throw new Error('Expected an animated case cover.');
    expect(expansion).toMatchObject({ old: true, next: true });
    expect(expansion.widths.length).toBeGreaterThanOrEqual(2);
    expect(expansion.widths[0]).toBeCloseTo(source.width, 0);
    const expandedWidth = expansion.widths.at(-1)!;
    expect(expandedWidth).toBeGreaterThan(source.width);
    expect(expandedWidth).toBeCloseTo(destination.width, 0);
  } finally {
    await gate.close();
  }
});

for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: public links navigate without replacing the document`, async ({ page }) => {
    const copy = portfolio.locales[locale];
    const first = portfolio.cases.first.locales[locale];
    await page.goto(copy.homePath);
    await page.waitForFunction(() =>
      document.documentElement.style.getPropertyValue('--portfolio-header-height'),
    );
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    const expectSameDocument = async () => {
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    };

    await test.step('Navigate from the desktop header to the project list', async () => {
      await siteHeader(page, copy).getByRole('link', { name: copy.projects, exact: true }).click();
      await expect(page).toHaveURL(copy.listingPath);
      await expect(page.getByRole('heading', { level: 1, name: copy.listingTitle })).toBeVisible();
      await expectSameDocument();
    });

    await test.step('Open a case and return with browser history', async () => {
      await page.getByRole('link', { name: first.title, exact: true }).click();
      await expect(page).toHaveURL(first.path);
      await expect(page.getByRole('heading', { level: 1, name: first.title })).toBeVisible();
      await expectSameDocument();
      await page.goBack();
      await expect(page).toHaveURL(copy.listingPath);
      await expectSameDocument();
    });

    await test.step('Navigate from the mobile menu to About', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await siteHeader(page, copy)
        .getByRole('button', { name: copy.openMenu, exact: true })
        .click();
      await page.getByRole('dialog').getByRole('link', { name: copy.about, exact: true }).click();
      await expect(page).toHaveURL(copy.aboutPath);
      await expect(page.getByRole('heading', { level: 1, name: copy.aboutTitle })).toBeVisible();
      await expectSameDocument();
    });
  });

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
