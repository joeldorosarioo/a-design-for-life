import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  createReadingPortfolioFixture,
  type ReadingLocale,
} from '../../../../testing/fixtures/reading-portfolio';
import {
  browserStorage,
  committed,
  decodedVisibleImage,
  keyed,
  languageButton,
  openPublished,
  pageTop,
  place,
  preferenceRequests,
  programmaticScrollCalls,
  readingLine,
  responseGate,
  samePosition,
  settled,
  startChoice,
  startFont,
  switchTo,
  viewports,
} from './reading-position.browser-support';

type Portfolio = Awaited<ReturnType<typeof createReadingPortfolioFixture>>;
let portfolio: Portfolio;

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(120_000);
  const serialRunner = testInfo.config.workers === 1 && !testInfo.config.fullyParallel;
  if (!serialRunner) throw new Error('Expanded reading tests require one serial owned worker.');
  portfolio = await createReadingPortfolioFixture('e2-reading-expanded', serialRunner);
});
test.afterAll(async () => {
  await portfolio?.destroy();
});

const opposite = (locale: ReadingLocale): ReadingLocale => (locale === 'pt' ? 'en' : 'pt');
function pathFor(kind: 'home' | 'about' | 'list' | 'detail', locale: ReadingLocale) {
  if (kind === 'detail') return portfolio.cases.first.locales[locale].path;
  return portfolio.locales[locale][
    kind === 'home' ? 'homePath' : kind === 'about' ? 'aboutPath' : 'listingPath'
  ];
}
function keyFor(kind: 'home' | 'about' | 'list' | 'detail') {
  return kind === 'home'
    ? 'home-approach'
    : kind === 'about'
      ? 'about-approach'
      : kind === 'list'
        ? `case-card:${portfolio.cases.first.caseId}`
        : portfolio.readingKeys.imagePair;
}
async function titleFor(
  page: import('@playwright/test').Page,
  kind: 'home' | 'about' | 'list' | 'detail',
  locale: ReadingLocale,
) {
  const copy = portfolio.locales[locale];
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    kind === 'home'
      ? `${copy.homeTitle} ${copy.homeEmphasis}`
      : kind === 'about'
        ? copy.aboutTitle
        : kind === 'list'
          ? copy.listingTitle
          : portfolio.cases.first.locales[locale].title,
  );
}

// Every row traverses PT→EN→PT. The original first journey remains a separate,
// unchanged test. These rows add other pages/viewports rather than replace it.
for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const kind of ['home', 'about', 'list', 'detail'] as const) {
    test(`@matrix ${viewportName} ${kind}: shared identity survives both language directions`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      if (viewportName === 'mobile') await page.emulateMedia({ reducedMotion: 'reduce' });
      const requests = preferenceRequests(page);
      await openPublished(page, pathFor(kind, 'pt'), 'pt');
      await titleFor(page, kind, 'pt');
      const storage = await browserStorage(page);
      const key = keyFor(kind);
      if (kind === 'list') {
        const ids = await page
          .locator('main [data-reading-key^="case-card:"]')
          .evaluateAll((nodes) =>
            nodes.slice(0, 4).map((node) => (node as HTMLElement).dataset.readingKey),
          );
        expect(ids).toEqual(
          [
            portfolio.cases.ptOnly.caseId,
            portfolio.paddingPt.caseId,
            portfolio.cases.first.caseId,
            portfolio.cases.second.caseId,
          ].map((id) => `case-card:${id}`),
        );
      }
      const source = await place(page, key, kind === 'list' ? 'card' : 'section');
      await switchTo(page, 'pt', pathFor(kind, 'en'));
      await titleFor(page, kind, 'en');
      await samePosition(page, key, source.top);
      expect(
        Math.abs((await page.evaluate(() => scrollY)) - source.scrollY),
        'different pre-target heights require real compensation',
      ).toBeGreaterThan(2);
      if (kind === 'list') {
        const ids = await page
          .locator('main [data-reading-key^="case-card:"]')
          .evaluateAll((nodes) =>
            nodes.slice(0, 3).map((node) => (node as HTMLElement).dataset.readingKey),
          );
        expect(ids).toEqual(
          [
            portfolio.cases.first.caseId,
            portfolio.cases.second.caseId,
            portfolio.enOnly.caseId,
          ].map((id) => `case-card:${id}`),
        );
      }
      await switchTo(page, 'en', pathFor(kind, 'pt'));
      await titleFor(page, kind, 'pt');
      await samePosition(page, key, source.top);
      expect(requests).toHaveLength(2);
      expect(requests.map((request) => request.postDataJSON())).toEqual([
        { locale: 'en' },
        { locale: 'pt' },
      ]);
      expect(await browserStorage(page)).toEqual(storage);
      expect(
        (await context.cookies()).filter((cookie) => cookie.name === 'portfolio_locale'),
      ).toMatchObject([{ value: 'pt' }]);
      await expect(page.getByRole('status')).toBeEmpty();
    });
  }
}

for (const source of ['pt', 'en'] as const) {
  const target = opposite(source);
  test(`@equivalence ${source}→${target}: entire missing case opens the target list and does not replay its notice`, async ({
    page,
  }) => {
    await page.setViewportSize(source === 'pt' ? viewports.desktop : viewports.mobile);
    const missing = source === 'pt' ? portfolio.cases.ptOnly : portfolio.enOnly;
    const requests = preferenceRequests(page);
    await openPublished(page, missing.locales[source].path, source);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
      missing.locales[source].title,
    );
    await page.evaluate(() => scrollTo({ top: 300, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await switchTo(page, source, portfolio.locales[target].listingPath);
    await titleFor(page, 'list', target);
    await pageTop(page);
    await expect(page.getByRole('status')).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText(portfolio.notices[target].missing);
    await expect(page.getByRole('status')).not.toBeFocused();
    await expect(page.locator('main')).not.toContainText(missing.locales[target].title);
    const reload = await page.reload();
    expect(reload?.status()).toBe(200);
    expect((await reload!.allHeaders())['set-cookie']).toBeUndefined();
    await expect(page.getByRole('status')).toBeEmpty();
    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe(missing.locales[source].path);
    await settled(page);
    await expect(page.getByRole('status')).toBeEmpty();
    await page.goForward();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(portfolio.locales[target].listingPath);
    await settled(page);
    await expect(page.getByRole('status')).toBeEmpty();
    expect(requests).toHaveLength(1);
  });

  test(`@equivalence ${source}→${target}: missing block uses only its explicit ancestor and target-locale partial notice`, async ({
    page,
  }) => {
    const translated = portfolio.cases.first.locales[target];
    const current = await portfolio.payload.findByID({
      collection: 'case-content',
      id: translated.contentId,
      draft: false,
      depth: 0,
      req: await portfolio.request(),
      overrideAccess: false,
    });
    const original = structuredClone(current.sections);
    try {
      await portfolio.publishSections(
        translated.contentId,
        original?.map((section) => ({
          ...section,
          blocks: section.blocks?.filter(
            (block) => block.readingKey !== portfolio.readingKeys.imagePair,
          ),
        })),
      );
      await page.setViewportSize(source === 'pt' ? viewports.mobile : viewports.desktop);
      await openPublished(page, portfolio.cases.first.locales[source].path, source);
      await place(page, portfolio.readingKeys.imagePair);
      await switchTo(page, source, translated.path);
      await titleFor(page, 'detail', target);
      await expect(keyed(page, portfolio.readingKeys.imagePair)).toHaveCount(0);
      await samePosition(page, portfolio.readingKeys.context, await readingLine(page));
      await expect(page.getByRole('status')).toHaveText(portfolio.notices[target].adjusted);
      await expect(page.getByRole('status')).not.toHaveText(portfolio.notices[target].missing);
      await expect(page.getByRole('status')).not.toBeFocused();
    } finally {
      await portfolio.publishSections(translated.contentId, original);
    }
  });

  test(`@equivalence ${source}→${target}: absent section has no shared ancestor and uses the same page top`, async ({
    page,
  }) => {
    const translated = portfolio.cases.first.locales[target];
    const current = await portfolio.payload.findByID({
      collection: 'case-content',
      id: translated.contentId,
      draft: false,
      depth: 0,
      req: await portfolio.request(),
      overrideAccess: false,
    });
    const original = structuredClone(current.sections);
    try {
      await portfolio.publishSections(
        translated.contentId,
        original?.filter((section) => section.readingKey !== portfolio.readingKeys.context),
      );
      await page.setViewportSize(source === 'pt' ? viewports.desktop : viewports.mobile);
      await openPublished(page, portfolio.cases.first.locales[source].path, source);
      await place(page, portfolio.readingKeys.imagePair);
      await switchTo(page, source, translated.path);
      await titleFor(page, 'detail', target);
      await expect(keyed(page, portfolio.readingKeys.context)).toHaveCount(0);
      await pageTop(page);
      await expect(page.getByRole('status')).toHaveText(portfolio.notices[target].adjusted);
    } finally {
      await portfolio.publishSections(translated.contentId, original);
    }
  });

  test(`@equivalence ${source}→${target}: missing list card stays on the translated list and uses its explicit list ancestor`, async ({
    page,
  }) => {
    await page.setViewportSize(source === 'pt' ? viewports.desktop : viewports.mobile);
    const missing = source === 'pt' ? portfolio.cases.ptOnly : portfolio.enOnly;
    await openPublished(page, portfolio.locales[source].listingPath, source);
    await place(page, `case-card:${missing.caseId}`, 'card');
    await switchTo(page, source, portfolio.locales[target].listingPath);
    await expect(keyed(page, `case-card:${missing.caseId}`)).toHaveCount(0);
    await samePosition(page, 'cases-list', await readingLine(page));
    await expect(page.getByRole('status')).toHaveText(portfolio.notices[target].adjusted);
  });
}

test('@equivalence missing featured card uses the Home projects ancestor rather than an unrelated card', async ({
  page,
}) => {
  await page.setViewportSize(viewports.mobile);
  await openPublished(page, '/pt', 'pt');
  await place(page, `case-card:${portfolio.cases.ptOnly.caseId}`, 'card');
  await switchTo(page, 'pt', '/en');
  await titleFor(page, 'home', 'en');
  await expect(keyed(page, `case-card:${portfolio.cases.ptOnly.caseId}`)).toHaveCount(0);
  await samePosition(page, 'home-projects', await readingLine(page));
  await expect(page.getByRole('status')).toHaveText(portfolio.notices.en.adjusted);
});

test('@lifecycle Back and Forward retain native reading positions without another manual preference', async ({
  page,
  context,
}) => {
  const requests = preferenceRequests(page);
  await openPublished(page, '/pt', 'pt');
  const before = await place(page, 'home-approach');
  await switchTo(page, 'pt', '/en');
  await samePosition(page, 'home-approach', before.top);
  const cookie = (await context.cookies()).find((cookie) => cookie.name === 'portfolio_locale');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/pt');
  await settled(page);
  await samePosition(page, 'home-approach', before.top);
  await expect(page.getByRole('status')).toBeEmpty();
  await page.goForward();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en');
  await settled(page);
  await samePosition(page, 'home-approach', before.top);
  await expect(page.getByRole('status')).toBeEmpty();
  expect(requests).toHaveLength(1);
  expect((await context.cookies()).find((item) => item.name === 'portfolio_locale')).toEqual(
    cookie,
  );
});

test('@lifecycle direct entry and refresh do not invent a missing-translation notice or renew preference', async ({
  page,
  context,
}) => {
  await page.setViewportSize(viewports.mobile);
  const requests = preferenceRequests(page);
  await context.addCookies([
    {
      name: 'portfolio_locale',
      value: 'pt',
      url: test.info().project.use.baseURL as string,
      expires: Math.floor(Date.now() / 1000) + 600,
    },
  ]);
  const cookie = (await context.cookies()).find((item) => item.name === 'portfolio_locale');
  const response = await page.goto('/en/cases?translation=missing#contact');
  expect(response?.status()).toBe(200);
  expect((await response!.allHeaders())['set-cookie']).toBeUndefined();
  expect(await response!.text()).toMatch(/<html\b[^>]*\slang="en"(?=[\s>])/);
  await titleFor(page, 'list', 'en');
  await expect(page.getByRole('status')).toBeEmpty();
  const storage = await browserStorage(page);
  const reload = await page.reload();
  expect(reload?.status()).toBe(200);
  expect((await reload!.allHeaders())['set-cookie']).toBeUndefined();
  await expect(page.getByRole('status')).toBeEmpty();
  expect(requests).toHaveLength(0);
  expect((await context.cookies()).find((item) => item.name === 'portfolio_locale')).toEqual(
    cookie,
  );
  expect(await browserStorage(page)).toEqual(storage);
});

test('@lifecycle keyboard language choice does not focus the reading text or toast and keeps Tab usable', async ({
  page,
}) => {
  await openPublished(page, '/pt', 'pt');
  const before = await place(page, 'home-approach');
  const choice = await startChoice(page, 'pt', 'keyboard');
  expect((await choice.saved).status()).toBe(204);
  await committed(page, 'en', '/en');
  await samePosition(page, 'home-approach', before.top);
  await expect(page.getByRole('status')).not.toBeFocused();
  await expect(page.getByRole('main')).not.toBeFocused();
  // The browser may naturally leave focus on body when the source node is
  // removed. The approved contract does not require an invented autofocus.
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  expect(
    await focused.evaluate((element) => element.matches('a[href], button:not(:disabled)')),
  ).toBe(true);
});

test('@lifecycle rapid real double click produces one POST and one language navigation', async ({
  page,
}, testInfo) => {
  await openPublished(page, '/pt', 'pt');
  const before = await place(page, 'home-approach');
  const requests = preferenceRequests(page);
  const gate = await responseGate(
    page,
    (url) => url.pathname === '/language-preference',
    (request) => request.method() === 'POST',
  );
  try {
    await languageButton(page, 'pt').dblclick();
    expect((await gate.held).status).toBe(204);
    await expect(languageButton(page, 'pt')).toBeDisabled();
    expect(requests).toHaveLength(1);
    gate.release();
    await committed(page, 'en', '/en');
    await samePosition(page, 'home-approach', before.top);
    expect(requests).toHaveLength(1);
  } finally {
    await gate.close();
    await gate.attach(testInfo);
  }
});

test('@lifecycle browser Back cancels a pending preference before its delayed response can navigate', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports.mobile);
  await openPublished(page, '/pt/sobre', 'pt');
  await openPublished(page, '/pt', 'pt');
  await place(page, 'home-approach');
  const requests = preferenceRequests(page);
  const gate = await responseGate(
    page,
    (url) => url.pathname === '/language-preference',
    (request) => request.method() === 'POST',
  );
  try {
    await languageButton(page, 'pt').click();
    expect((await gate.held).status).toBe(204);
    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/pt/sobre');
    gate.release();
    await gate.finished;
    await settled(page);
    await titleFor(page, 'about', 'pt');
    await expect(page.getByRole('status')).toBeEmpty();
    expect(requests).toHaveLength(1);
    expect(new URL(page.url()).pathname).toBe('/pt/sobre');
    await page.goForward();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/pt');
    await settled(page);
    await titleFor(page, 'home', 'pt');
    await expect(page.getByRole('status')).toBeEmpty();
    expect(requests).toHaveLength(1);
  } finally {
    await gate.close();
    await gate.attach(testInfo);
  }
});

test('@lifecycle user scroll during delayed Flight cancels restoration without claiming to cancel the accepted navigation', async ({
  page,
}, testInfo) => {
  await openPublished(page, '/pt', 'pt');
  const before = await place(page, 'home-approach');
  const gate = await responseGate(
    page,
    (url) => url.pathname === '/en',
    (request) => request.headers().rsc === '1',
  );
  try {
    const choice = await startChoice(page, 'pt');
    expect((await choice.saved).status()).toBe(204);
    expect((await gate.held).status).toBe(200);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.scrollY + 100);
    const userY = await page.evaluate(() => scrollY);
    await expect(languageButton(page, 'pt')).toBeEnabled();
    gate.release();
    await committed(page, 'en', '/en');
    expect(Math.abs((await page.evaluate(() => scrollY)) - userY)).toBeLessThanOrEqual(2);
    await expect(page.getByRole('status')).toBeEmpty();
  } finally {
    await gate.close();
    await gate.attach(testInfo);
  }
});

test('@resource actual delayed Next image completes before exact reading restoration is certified', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports.mobile);
  await openPublished(page, '/pt/sobre', 'pt');
  const before = await place(page, 'about-approach');
  const gate = await responseGate(
    page,
    (url) =>
      url.pathname === '/_next/image' &&
      url.searchParams.get('url') === `/media/${portfolio.imageEnId}/original`,
  );
  try {
    const choice = await startChoice(page, 'pt');
    expect((await choice.saved).status()).toBe(204);
    expect((await gate.held).status).toBe(200);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/en/about');
    await expect(languageButton(page, 'en')).toBeDisabled();
    gate.release();
    await decodedVisibleImage(page, portfolio.imageEnId);
    await committed(page, 'en', '/en/about');
    await samePosition(page, 'about-approach', before.top);
    await expect(page.getByRole('status')).toBeEmpty();
  } finally {
    await gate.close();
    await gate.attach(testInfo);
  }
});

test('@resource user scroll while the destination image is pending prevents later observer corrections', async ({
  page,
}, testInfo) => {
  await openPublished(page, '/pt/sobre', 'pt');
  await place(page, 'about-approach');
  const gate = await responseGate(
    page,
    (url) =>
      url.pathname === '/_next/image' &&
      url.searchParams.get('url') === `/media/${portfolio.imageEnId}/original`,
  );
  try {
    const choice = await startChoice(page, 'pt');
    expect((await choice.saved).status()).toBe(204);
    expect((await gate.held).status).toBe(200);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/en/about');
    await expect(languageButton(page, 'en')).toBeDisabled();
    const oldY = await page.evaluate(() => scrollY);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(oldY + 100);
    const userY = await page.evaluate(() => scrollY);
    await expect(languageButton(page, 'en')).toBeEnabled();
    gate.release();
    await decodedVisibleImage(page, portfolio.imageEnId);
    await settled(page);
    expect(Math.abs((await page.evaluate(() => scrollY)) - userY)).toBeLessThanOrEqual(2);
    await expect(page.getByRole('status')).toBeEmpty();
  } finally {
    await gate.close();
    await gate.attach(testInfo);
  }
});

async function fontBytes() {
  const filename = process.env.READING_E2E_FONT_FILE;
  if (!filename)
    throw new Error(
      'Resource tests require READING_E2E_FONT_FILE pointing to an existing readable local TTF; missing prerequisite is not a behavior RED.',
    );
  return readFile(filename);
}
for (const deadline of [false, true]) {
  test(`@resource real FontFace ${deadline ? 'deadline reports failure and late loading cannot resume correction' : 'loading delays completion until actual font settlement'}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(20_000);
    const bytes = await fontBytes();
    await openPublished(page, '/pt', 'pt');
    const before = await place(page, 'home-approach');
    const gate = await responseGate(
      page,
      (url) => url.pathname === '/__e2e__/reading-font.ttf',
      () => true,
      { bytes, contentType: 'font/ttf' },
    );
    try {
      await startFont(page);
      expect((await gate.held).status).toBe(200);
      const calls = await programmaticScrollCalls(page);
      const choice = await startChoice(page, 'pt');
      expect((await choice.saved).status()).toBe(204);
      await expect.poll(() => new URL(page.url()).pathname).toBe('/en');
      expect(
        await page.getByRole('main').evaluate((element) => getComputedStyle(element).fontFamily),
        'font stress setup applies its real pending family to the destination',
      ).toContain('ReadingE2EStress');
      await expect(languageButton(page, 'en')).toBeDisabled();
      if (deadline) {
        // Wait for the product's explicit8s deadline, not an arbitrary sleep.
        await expect(page.getByRole('status')).toHaveText(portfolio.notices.pt.failure, {
          timeout: 12_000,
        });
        await expect(languageButton(page, 'en')).toBeEnabled();
        const oldY = await page.evaluate(() => scrollY);
        await page.mouse.move(700, 400);
        await page.mouse.wheel(0, 240);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(oldY + 100);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
      }
      const callsBeforeRelease = calls.length;
      gate.release();
      await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
      expect(
        await page.evaluate(() =>
          Array.from(document.fonts).some(
            (font) => font.family === 'ReadingE2EStress' && font.status === 'loaded',
          ),
        ),
      ).toBe(true);
      await committed(page, 'en', '/en');
      if (deadline) {
        expect(
          calls.slice(callsBeforeRelease),
          'expired controller must not resume programmatic scrolling after the font settles',
        ).toEqual([]);
        await expect(page.getByRole('status')).toHaveText(portfolio.notices.pt.failure);
      } else {
        await samePosition(page, 'home-approach', before.top);
        await expect(page.getByRole('status')).toBeEmpty();
      }
    } finally {
      await gate.close();
      await gate.attach(testInfo);
    }
  });
}

for (const [viewportName, viewport] of Object.entries(viewports)) {
  test(`@anchors ${viewportName}: native contact and case TOC targets stay below the measured sticky Header`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPublished(page, '/pt', 'pt');
    if (viewportName === 'mobile') {
      await page
        .getByRole('button', {
          name: portfolio.locales.pt.openMenu,
          exact: true,
        })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('link', { name: portfolio.locales.pt.contact, exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('#contact')).toBeFocused();
    } else {
      await page
        .locator('[data-portfolio-header]')
        .getByRole('link', { name: portfolio.locales.pt.contact, exact: true })
        .click();
    }
    await expect.poll(() => new URL(page.url()).hash).toBe('#contact');
    const headerBottom = await page
      .locator('[data-portfolio-header]')
      .evaluate((node) => node.getBoundingClientRect().bottom);
    await expect
      .poll(() => page.locator('#contact').evaluate((node) => node.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(headerBottom);
    // Direct hash hydration exercises the measured-height initial correction.
    const direct = await page.goto(
      `${portfolio.cases.first.locales.pt.path}#section-${portfolio.readingKeys.context}`,
    );
    expect(direct?.status()).toBe(200);
    await settled(page);
    await expect
      .poll(() =>
        keyed(page, portfolio.readingKeys.context).evaluate(
          (node) => node.getBoundingClientRect().top,
        ),
      )
      .toBeGreaterThanOrEqual(
        await page
          .locator('[data-portfolio-header]')
          .evaluate((node) => node.getBoundingClientRect().bottom),
      );
    const contents = page.getByRole('navigation', {
      name: portfolio.locales.pt.contents,
      exact: true,
    });
    await contents
      .getByRole('link', {
        name: portfolio.locales.pt.comparisonHeading,
        exact: true,
      })
      .click();
    await expect
      .poll(() => new URL(page.url()).hash)
      .toBe(`#section-${portfolio.readingKeys.comparison}`);
    await expect
      .poll(() =>
        keyed(page, portfolio.readingKeys.comparison).evaluate(
          (node) => node.getBoundingClientRect().top,
        ),
      )
      .toBeGreaterThanOrEqual(
        await page
          .locator('[data-portfolio-header]')
          .evaluate((node) => node.getBoundingClientRect().bottom),
      );
  });
}

for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const locale of ['pt', 'en'] as const) {
    for (const kind of ['home', 'about', 'list', 'detail'] as const) {
      test(`@contact ${viewportName} ${locale} ${kind}: current-page contact is below the Header and mobile dialog restores contact focus`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        const requests = preferenceRequests(page);
        const pathname = pathFor(kind, locale);
        await openPublished(page, pathname, locale);
        await titleFor(page, kind, locale);
        // Exercise the visible sticky Header after actual document scrolling,
        // rather than accepting a contact link that only works at initial top.
        await page.evaluate(() => scrollTo({ top: 240, behavior: 'instant' }));
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
        const header = page.locator('[data-portfolio-header]:visible');
        await expect
          .poll(() => header.evaluate((element) => Math.abs(element.getBoundingClientRect().top)))
          .toBeLessThanOrEqual(2);
        if (viewportName === 'mobile') {
          await header
            .getByRole('button', { name: portfolio.locales[locale].openMenu, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await dialog
            .getByRole('link', { name: portfolio.locales[locale].contact, exact: true })
            .click();
          await expect(dialog).toBeHidden();
          await expect(page.locator('#contact:visible')).toBeFocused();
        } else {
          await header
            .getByRole('link', { name: portfolio.locales[locale].contact, exact: true })
            .click();
        }
        await expect.poll(() => new URL(page.url()).hash).toBe('#contact');
        expect(
          new URL(page.url()).pathname,
          'contact belongs to the currently displayed page',
        ).toBe(pathname);
        const contact = page.locator('#contact:visible');
        await expect(contact).toHaveCount(1);
        await expect(contact).toBeInViewport();
        await expect
          .poll(
            () =>
              contact.evaluate((element) => {
                const currentHeader = Array.from(
                  document.querySelectorAll<HTMLElement>('[data-portfolio-header]'),
                ).find((candidate) => {
                  const bounds = candidate.getBoundingClientRect();
                  return bounds.width > 0 && bounds.height > 0;
                });
                if (!currentHeader)
                  throw new Error('Visible Header is absent after contact navigation.');
                return (
                  element.getBoundingClientRect().top - currentHeader.getBoundingClientRect().bottom
                );
              }),
            {
              message:
                '#contact begins below the real current Header bottom; in-viewport alone is insufficient',
            },
          )
          .toBeGreaterThanOrEqual(0);
        expect(
          await contact.evaluate((element) => element.getBoundingClientRect().top < innerHeight),
        ).toBe(true);
        expect(requests).toHaveLength(0);
      });
    }
  }
}
