import { expect, type Page, type Request, type Route, type TestInfo } from '@playwright/test';
import type { ReadingLocale } from '../../../../testing/fixtures/reading-portfolio';

export const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

export async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => image.complete)
        .map((image) => image.decode().catch(() => undefined)),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}
export async function openPublished(page: Page, path: string, locale: ReadingLocale) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  expect((await response!.allHeaders())['set-cookie']).toBeUndefined();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  await settled(page);
}
export function keyed(page: Page, key: string) {
  return page.getByRole('main').locator(`[data-reading-key="${key}"]`);
}
export async function readingLine(page: Page) {
  return page
    .locator('[data-portfolio-header]:visible')
    .evaluate((element) => Math.max(0, element.getBoundingClientRect().bottom) + 24);
}
export async function place(page: Page, key: string, mode: 'section' | 'card' = 'section') {
  const anchor = keyed(page, key);
  await expect(anchor).toHaveCount(1);
  const top = mode === 'card' ? await readingLine(page) : Math.max(200, await readingLine(page));
  await anchor.evaluate((element, desiredTop) => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({
      top: element.getBoundingClientRect().top - desiredTop,
      behavior: 'instant',
    });
  }, top);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(anchor).toBeInViewport();
  // A clamp in fixture placement is a setup defect. Do not silently move the
  // target or weaken the production contract to make a short document pass.
  const actual = await anchor.evaluate((element) => element.getBoundingClientRect().top);
  expect(
    Math.abs(actual - top),
    `source ${key} can be positioned without bottom clamp`,
  ).toBeLessThanOrEqual(2);
  return { top: actual, scrollY: await page.evaluate(() => window.scrollY) };
}
export function languageButton(page: Page, source: ReadingLocale) {
  return page.getByRole('button', {
    name: source === 'pt' ? 'English' : 'Português',
    exact: true,
  });
}
export async function startChoice(
  page: Page,
  source: ReadingLocale,
  activation: 'click' | 'keyboard' = 'click',
) {
  const button = languageButton(page, source);
  await expect(button).toBeInViewport();
  await expect(button).toBeEnabled();
  const response = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/language-preference' &&
      response.request().method() === 'POST',
  );
  if (activation === 'keyboard') {
    await button.focus();
    await expect(button).toBeFocused();
    await button.press('Enter');
  } else await button.click();
  return { saved: response };
}
export async function committed(page: Page, locale: ReadingLocale, path: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  expect(new URL(page.url()).search).toBe('');
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  await expect(languageButton(page, locale)).toBeEnabled();
  await settled(page);
}
export async function switchTo(page: Page, source: ReadingLocale, path: string) {
  const choice = await startChoice(page, source);
  const saved = await choice.saved;
  expect(saved.status()).toBe(204);
  const locale = source === 'pt' ? 'en' : 'pt';
  expect((await saved.allHeaders())['set-cookie']).toMatch(
    new RegExp(`portfolio_locale=${locale};.*Max-Age=15552000`, 'i'),
  );
  await committed(page, locale, path);
}
export async function samePosition(page: Page, key: string, expectedTop: number) {
  await expect(keyed(page, key)).toHaveCount(1);
  await expect(keyed(page, key)).toBeInViewport();
  await expect
    .poll(
      async () =>
        Math.abs(
          (await keyed(page, key).evaluate((element) => element.getBoundingClientRect().top)) -
            expectedTop,
        ),
      {
        message: `same reading key ${key} retains its viewport top within 2 CSS pixels`,
      },
    )
    .toBeLessThanOrEqual(2);
}
export async function pageTop(page: Page) {
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}
export function preferenceRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/language-preference' && request.method() === 'POST')
      requests.push(request);
  });
  return requests;
}
export async function browserStorage(page: Page) {
  return page.evaluate(() => ({
    local: Object.entries(localStorage).sort(),
    session: Object.entries(sessionStorage).sort(),
  }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

/** Holds an actual response after route.fetch completed. No timer is used to
 * guess when the browser is waiting. Font bytes are the only test-only response. */
export async function responseGate(
  page: Page,
  match: (url: URL) => boolean,
  accept: (request: Request) => boolean = () => true,
  font?: { bytes: Buffer; contentType: string },
) {
  const held = deferred<{ status: number; url: string }>();
  const release = deferred<void>();
  const finished = deferred<void>();
  const tasks = new Set<Promise<void>>();
  const events: { url: string; status?: number; cancelled?: boolean }[] = [];
  const handler = (route: Route) => {
    if (!accept(route.request())) return route.continue();
    const task = (async () => {
      const record: { url: string; status?: number; cancelled?: boolean } = {
        url: route.request().url(),
      };
      events.push(record);
      try {
        const response = font ? null : await route.fetch();
        record.status = response?.status() ?? 200;
        held.resolve({ status: record.status, url: record.url });
        await release.promise;
        if (font)
          await route.fulfill({
            status: 200,
            contentType: font.contentType,
            body: font.bytes,
          });
        else await route.fulfill({ response: response! });
      } catch (error) {
        if (!route.request().failure()) throw error;
        record.cancelled = true;
      } finally {
        finished.resolve();
      }
    })();
    tasks.add(task);
    void task.then(
      () => tasks.delete(task),
      () => tasks.delete(task),
    );
    return task;
  };
  await page.route(match, handler);
  return {
    held: held.promise,
    finished: finished.promise,
    release: () => release.resolve(),
    events,
    async close() {
      release.resolve();
      await Promise.allSettled([...tasks]);
      if (!page.isClosed()) await page.unroute(match, handler);
    },
    async attach(testInfo: TestInfo) {
      await testInfo.attach('reading-response-gate', {
        body: JSON.stringify(events, null, 2),
        contentType: 'application/json',
      });
    },
  };
}

/** Test-only observation of native API calls. It forwards unchanged arguments
 * and exports no application/session state or production capture hook. Native
 * browser scroll anchoring is deliberately not counted as a controller call. */
export async function programmaticScrollCalls(page: Page) {
  const calls: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'debug' && message.text().startsWith('READING_E2E_SCROLL '))
      calls.push(message.text());
  });
  await page.evaluate(() => {
    for (const name of ['scrollBy', 'scrollTo'] as const) {
      const original = window[name];
      window[name] = ((...args: unknown[]) => {
        console.debug(`READING_E2E_SCROLL ${name}`, JSON.stringify(args));
        Reflect.apply(original, window, args);
      }) as typeof original;
    }
  });
  return calls;
}

export async function startFont(page: Page) {
  await page.evaluate(() => {
    const font = new FontFace('ReadingE2EStress', 'url("/__e2e__/reading-font.ttf")');
    document.fonts.add(font);
    const style = document.createElement('style');
    style.textContent = 'html[lang="en"] main { font-family: ReadingE2EStress, monospace; }';
    document.head.append(style);
    void font.load();
  });
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
}
export async function decodedVisibleImage(page: Page, mediaId: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          Array.from(document.images).some((image) => {
            const url = new URL(image.currentSrc || image.src, location.href);
            const original = url.searchParams.get('url') ?? url.pathname;
            const rect = image.getBoundingClientRect();
            return (
              original === `/media/${id}/original` &&
              image.closest('[data-reading-key]')?.getAttribute('data-reading-key') ===
                'about-approach' &&
              rect.bottom > 0 &&
              rect.top < innerHeight &&
              image.complete &&
              image.naturalWidth > 0
            );
          }),
        mediaId,
      ),
    )
    .toBe(true);
}
