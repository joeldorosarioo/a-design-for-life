import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { createPublicPortfolioFixture } from '../../../testing/fixtures/public-portfolio';

const capturePath = '/__e3_analytics_capture';
const harnessPath = '/__e3_analytics_harness';
const scriptPath = harnessPath + '.js';
const measurementId = 'G-E3OFFLINE';
const canonical = 'https://portfolio-e3.example.invalid';
const consentUi =
  /consent|cookie|accept all|reject all|aceitar|recusar|preferências de privacidade/i;

test.use({ serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' });

const browserHarness = `
  import { mountDocumentAnalytics } from './document-analytics';
  const runtime = {
    environment: 'production',
    area: 'public',
    preview: false,
    publicSiteEnabled: true,
    measurementId: '${measurementId}',
    siteOrigin: '${canonical}',
  };
  let release = () => {};
  let sequence = 0;
  Object.defineProperty(document, 'cookie', {
    get() { throw new Error('The analytics fixture must never read the language cookie'); },
    set() { throw new Error('The analytics fixture must never write a cookie'); },
  });
  function loadScript(script) {
    // Do not attach the Google script. Capture the actual queue at the injection seam.
    document.body.dataset.scriptRequest = script.src;
    const queue = window.dataLayer;
    for (const entry of queue) capture(entry);
    queue.push = function (entry) {
      capture(entry);
      return Array.prototype.push.call(this, entry);
    };
  }
  function capture(entry) {
    void fetch('${capturePath}', {
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify({ sequence: sequence++, command: Array.from(entry) }),
    });
  }
  window.commitAnalyticsPage = (context, overrides) => {
    release();
    release = mountDocumentAnalytics({
      document,
      runtime: { ...runtime, ...overrides },
      context,
      loadScript,
    });
  };
  document.getElementById('cancel').addEventListener('click', (event) => event.preventDefault());
`;

test('the document transport sends only canonical approved events to an offline capture', async ({
  page,
  context,
  baseURL,
}, info) => {
  const origin = new URL(baseURL!).origin;
  async function bundle(contents: string) {
    const { outputFiles } = await build({
      stdin: {
        contents,
        resolveDir: path.resolve('src/features/analytics/browser'),
        loader: 'ts',
      },
      platform: 'browser',
      format: 'iife',
      bundle: true,
      minify: true,
      write: false,
    });
    return outputFiles[0]!.text;
  }
  const [script, baseline] = await Promise.all([
    bundle(browserHarness),
    bundle(
      browserHarness.replace(
        "import { mountDocumentAnalytics } from './document-analytics';",
        'const mountDocumentAnalytics = () => () => {};',
      ),
    ),
  ]);
  const capturedRequests: { sequence: number; command: unknown[]; cookie?: string }[] = [];
  const captureCommands = () =>
    [...capturedRequests]
      .sort((first, second) => first.sequence - second.sequence)
      .map(({ command }) => command);
  const external: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      external.push(url.hostname);
      await route.abort();
    } else if (url.pathname === capturePath && route.request().method() === 'POST') {
      const capture = route.request().postDataJSON() as { sequence: number; command: unknown[] };
      capturedRequests.push({ ...capture, cookie: route.request().headers().cookie });
      await route.fulfill({ status: 204, body: '' });
    } else if (url.pathname === scriptPath) {
      await route.fulfill({ contentType: 'text/javascript', body: script });
    } else if (url.pathname === harnessPath) {
      await route.fulfill({
        headers: { 'Permissions-Policy': 'ch-ua-high-entropy-values=()' },
        contentType: 'text/html',
        body: `<!doctype html><title>Synthetic title: must not leave the browser</title>
          <a id="email" href="#synthetic-contact@example.invalid" data-analytics-purpose="email">Email</a>
          <a id="linkedin" href="#synthetic-linkedin" data-analytics-purpose="linkedin">LinkedIn</a>
          <a id="resume" href="#synthetic-resume" data-analytics-purpose="resume">Resume</a>
          <a id="cancel" href="#synthetic-cancel" data-analytics-purpose="resume">Cancelled action</a>
          <a id="other" href="#synthetic-unapproved">Another action</a>
          <script src="${scriptPath}"></script>`,
      });
    } else {
      await route.abort();
    }
  });
  await context.addCookies([{ name: 'portfolio_locale', value: 'pt', url: origin }]);
  await page.goto(harnessPath + '?token=synthetic-url-secret');
  const localeEn = { locale: 'en', pagePath: '/en' };
  const localePt = { locale: 'pt', pagePath: '/pt/cases/synthetic-case' };
  const commit = (value: { locale: string; pagePath: string }, runtime?: Record<string, unknown>) =>
    page.evaluate(
      ([next, overrides]) => {
        const harness = window as Window & {
          commitAnalyticsPage?: (
            next: { locale: string; pagePath: string },
            overrides?: Record<string, unknown>,
          ) => void;
        };
        if (!harness.commitAnalyticsPage) throw new Error('Analytics harness did not load.');
        harness.commitAnalyticsPage(next, overrides);
      },
      [value, runtime] as const,
    );
  for (const overrides of [
    { environment: 'test' },
    { environment: 'staging' },
    { area: 'admin' },
    { preview: true },
    { publicSiteEnabled: false },
  ]) {
    await commit(localeEn, overrides);
    await expect(page.locator('body')).not.toHaveAttribute('data-script-request', /./);
  }
  await commit({ locale: 'en', pagePath: '/en?token=invalid' });
  await expect(page.locator('body')).not.toHaveAttribute('data-script-request', /./);
  await commit(localeEn);
  await commit(localeEn);
  await page.locator('#email').click();
  await page.locator('#linkedin').click();
  await page.locator('#resume').click({ button: 'middle' });
  await page.locator('#cancel').click();
  await page.locator('#other').click();
  await commit(localePt);
  await commit(localeEn);
  await expect.poll(() => captureCommands().filter(([kind]) => kind === 'event')).toHaveLength(6);
  const captures = captureCommands();
  expect(capturedRequests.every(({ cookie }) => cookie === undefined)).toBe(true);

  const eventCommands = captures.filter(([kind]) => kind === 'event');
  const event = (name: string, locale: string, pagePath: string) => [
    'event',
    name,
    {
      send_to: measurementId,
      page_location: canonical + pagePath,
      page_referrer: '',
      page_title: '',
      language: locale,
    },
  ];
  expect(eventCommands).toEqual([
    event('page_view', 'en', '/en'),
    event('contact_email_click', 'en', '/en'),
    event('contact_linkedin_click', 'en', '/en'),
    event('resume_open', 'en', '/en'),
    event('page_view', 'pt', '/pt/cases/synthetic-case'),
    event('page_view', 'en', '/en'),
  ]);
  expect(captures[0]).toEqual([
    'consent',
    'default',
    {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
  ]);
  expect(captures.filter(([kind]) => kind === 'consent')).toHaveLength(1);
  expect(captures.filter(([kind]) => kind === 'config')).toEqual([
    ['config', measurementId, { send_page_view: false }],
  ]);
  await expect(page.locator('body')).toHaveAttribute(
    'data-script-request',
    'https://www.googletagmanager.com/gtag/js?id=' + measurementId,
  );
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  expect(external).toEqual([]);
  expect((await context.cookies()).map(({ name, value }) => ({ name, value }))).toEqual([
    { name: 'portfolio_locale', value: 'pt' },
  ]);
  const state = await context.storageState({ indexedDB: true });
  expect(state.origins).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await expect(page.getByRole('dialog', { name: consentUi })).toHaveCount(0);
  await expect(page.getByRole('button', { name: consentUi })).toHaveCount(0);
  await info.attach('analytics-offline-contract.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      eventCommands,
      commandKinds: captures.map(([kind]) => kind),
      consentDefault: captures[0],
      config: captures.filter(([kind]) => kind === 'config'),
      externalRequests: external.length,
      cookieNames: state.cookies.map(({ name }) => name),
      browserStorageOrigins: state.origins.length,
      syntheticHarnessJavaScriptBytes: Buffer.byteLength(script),
      syntheticHarnessJavaScriptGzipBytes: gzipSync(script).byteLength,
      syntheticBaselineJavaScriptBytes: Buffer.byteLength(baseline),
      syntheticBaselineJavaScriptGzipBytes: gzipSync(baseline).byteLength,
    }),
  });
});

test('the owned Next runtime excludes the analytics script, globals and controls in test pages', async ({
  page,
  context,
  baseURL,
}, info) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      await route.continue();
    } else {
      external.push(url.hostname);
      await route.abort();
    }
  });
  const fixture = await createPublicPortfolioFixture('e3-analytics-excluded-next', {
    serialRunner: info.config.workers === 1 && !info.config.fullyParallel,
  });
  try {
    const draft = fixture.cases.ptOnly.locales.en;
    const previewPath = '/preview-ui/en/case-content/' + draft.contentId + '/case';
    const receipts: {
      kind: string;
      status: number;
      hasGoogleGlobals: boolean;
      scriptBytes: number;
    }[] = [];
    async function inspect(kind: string, pathname: string, status: number) {
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(status);
      const publicDocument = /^\/(?:pt|en)(?:\/|$)/.test(pathname);
      if (publicDocument) {
        expect(response?.headers()['permissions-policy']).toBe('ch-ua-high-entropy-values=()');
        const policy = await page.evaluate(() => {
          const doc = document as Document & {
            featurePolicy?: { features(): string[]; allowsFeature(name: string): boolean };
          };
          const feature = 'ch-ua-high-entropy-values';
          return {
            recognized: doc.featurePolicy?.features().includes(feature) === true,
            allowed: doc.featurePolicy?.allowsFeature(feature),
          };
        });
        expect(policy).toEqual({ recognized: true, allowed: false });
      } else {
        expect(response?.headers()['permissions-policy']).toBeUndefined();
      }
      await expect(
        page.locator('script[src*="googletagmanager"],script[src*="google-analytics"]'),
      ).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: consentUi })).toHaveCount(0);
      await expect(page.getByRole('button', { name: consentUi })).toHaveCount(0);
      const runtime = await page.evaluate(() => ({
        hasGoogleGlobals: 'gtag' in window || 'dataLayer' in window,
        scriptBytes: performance
          .getEntriesByType('resource')
          .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'script')
          .reduce((size, entry) => size + (entry as PerformanceResourceTiming).decodedBodySize, 0),
      }));
      expect(runtime.hasGoogleGlobals).toBe(false);
      receipts.push({ kind, status, ...runtime });
      return response!;
    }

    await inspect('home-en', fixture.locales.en.homePath, 200);
    await inspect('home-pt', fixture.locales.pt.homePath, 200);
    await inspect('published-case', fixture.cases.first.locales.en.path, 200);
    await inspect('unpublished-case', draft.path, 404);
    await inspect('anonymous-preview', previewPath, 401);
    await inspect('admin-login', '/admin/login', 200);
    const login = await context.request.post('/api/users/login', {
      headers: { origin },
      data: { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    });
    expect(login.status()).toBe(200);
    await context.setExtraHTTPHeaders({ origin });
    const preview = await inspect('authenticated-draft-preview', previewPath, 200);
    expect(preview.headers()['cache-control']).toContain('private');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    expect(external).toEqual([]);
    expect((await context.cookies()).filter(({ name }) => /^_ga(?:_|$)|^_gid$/.test(name))).toEqual(
      [],
    );
    await info.attach('analytics-excluded-next.json', {
      contentType: 'application/json',
      body: JSON.stringify({ cases: receipts, externalRequests: external.length }),
    });
  } finally {
    await fixture.destroy();
  }
});
