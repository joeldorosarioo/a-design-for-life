import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { decodeGoogleCollectRequest, inspectGoogleEventSequence } from './google-wire.ts';
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('.work/playwright-browsers');
const { chromium } = await import('@playwright/test');
const [manifestPath, outputPath, ...extra] = process.argv.slice(2);
assert(
  manifestPath && outputPath && extra.length === 0,
  'Pass an SDK manifest and a new output JSON path.',
);
const manifestFile = path.resolve(manifestPath),
  outputFile = path.resolve(outputPath);
const directory = path.dirname(manifestFile);
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const source = new URL(manifest.sourceUrl);
assert.equal(source.origin, 'https://www.googletagmanager.com');
assert.equal(source.pathname, '/gtag/js');
assert(!source.username && !source.password && !source.hash);
const measurementId = source.searchParams.get('id');
assert.match(measurementId ?? '', /^G-[A-Z0-9]{4,32}$/);
assert.equal(source.searchParams.size, 1);
const sdk = await fs.readFile(path.join(directory, 'gtag.js'));
assert.equal(createHash('sha256').update(sdk).digest('hex'), manifest.sha256);
assert.equal(sdk.length, manifest.byteLength);
assert.equal(manifest.httpStatus, 200);
const origin = 'https://analytics-fixture.example.invalid';
const canonical = 'https://portfolio-e3.example.invalid';
const harness = `import {mountDocumentAnalytics} from './document-analytics';
const runtime={environment:'production',area:'public',preview:false,publicSiteEnabled:true,measurementId:'${measurementId}',siteOrigin:'${canonical}'};
let release=()=>{};
const loadScript=(script)=>document.head.appendChild(script);
window.commit=(context)=>{release();release=mountDocumentAnalytics({document,runtime,context,loadScript});};
`;
const bundled = await build({
  stdin: {
    contents: harness,
    resolveDir: path.resolve('src/features/analytics/browser'),
    loader: 'ts',
  },
  platform: 'browser',
  format: 'iife',
  bundle: true,
  minify: true,
  write: false,
});
const bundle = bundled.outputFiles[0].text;
const proxyRequests = [];
const proxy = http.createServer((req, res) => {
  proxyRequests.push({ method: req.method });
  res.writeHead(502);
  res.end();
});
proxy.on('connect', (req, socket) => {
  proxyRequests.push({ method: 'CONNECT' });
  socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const proxyPort = proxy.address().port;
const browser = await chromium.launch({
  headless: true,
  proxy: { server: `http://127.0.0.1:${proxyPort}` },
  args: [
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--no-first-run',
    '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  ],
});
const context = await browser.newContext({
  serviceWorkers: 'block',
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
const requests = [],
  errors = [],
  pages = [],
  failedRequests = [],
  consoleErrors = [];
try {
  await context.addInitScript(() => {
    const state = {
      cookieReads: 0,
      cookieWrites: [],
      storageReads: [],
      storageWrites: [],
      indexedDbOpens: 0,
    };
    window.observedStorage = state;
    const c = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (c?.get && c?.set)
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get() {
          state.cookieReads++;
          return c.get.call(document);
        },
        set(value) {
          state.cookieWrites.push(String(value).split('=')[0]);
          return c.set.call(document, value);
        },
      });
    for (const name of ['getItem', 'key']) {
      const fn = Storage.prototype[name];
      Storage.prototype[name] = function (...args) {
        state.storageReads.push(name);
        return fn.apply(this, args);
      };
    }
    for (const name of ['setItem', 'removeItem', 'clear']) {
      const fn = Storage.prototype[name];
      Storage.prototype[name] = function (...args) {
        state.storageWrites.push(name);
        return fn.apply(this, args);
      };
    }
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = function (...args) {
      state.indexedDbOpens++;
      return open(...args);
    };
  });
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin === origin) {
      if (url.pathname === '/harness.js')
        await route.fulfill({ contentType: 'text/javascript', body: bundle });
      else
        await route.fulfill({
          contentType: 'text/html',
          headers: { 'Permissions-Policy': 'ch-ua-high-entropy-values=()' },
          body: `<!doctype html><title>Synthetic private title: do not transmit</title><a id="email" href="#synthetic-contact@example.invalid" data-analytics-purpose="email">Email</a><a id="linkedin" href="#synthetic-linkedin" data-analytics-purpose="linkedin">LinkedIn</a><a id="resume" href="#synthetic-resume" data-analytics-purpose="resume">Resume</a><script src="/harness.js"></script>`,
        });
    } else if (req.url() === manifest.sourceUrl) {
      requests.push({ kind: 'sdk', host: url.hostname, path: url.pathname, method: req.method() });
      await route.fulfill({ contentType: 'application/javascript', body: sdk });
    } else {
      requests.push({
        kind: 'intercepted-external',
        host: url.hostname,
        path: url.pathname,
        method: req.method(),
        url: req.url(),
        body: req.postData(),
        headers: req.headers(),
      });
      if (req.resourceType() === 'script') await route.abort();
      else
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-allow-headers': '*',
          },
        });
    }
  });
  await context.routeWebSocket('**/*', (socket) => {
    requests.push({ kind: 'blocked-websocket' });
    socket.close();
  });
  await context.addCookies([
    { name: 'portfolio_locale', value: 'pt-synthetic-language-sentinel', url: origin },
  ]);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push({ name: e.name }));
  page.on('requestfailed', (r) =>
    failedRequests.push({
      host: new URL(r.url()).hostname,
      path: new URL(r.url()).pathname,
      error: r.failure()?.errorText,
    }),
  );
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push('browser-console-error');
  });
  await page.goto(origin + '/harness?token=synthetic-never-send');
  await page.evaluate(() => window.commit({ locale: 'en', pagePath: '/en' }));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.commit({ locale: 'pt', pagePath: '/pt/cases/synthetic-case' }));
  for (const id of ['email', 'linkedin', 'resume']) {
    await page.locator('#' + id).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(12000);
  const storage = await page.evaluate(() => ({
    observed: window.observedStorage,
    localStorageLength: localStorage.length,
    sessionStorageLength: sessionStorage.length,
  }));
  const browserStorage = await context.storageState({ indexedDB: true });
  pages.push({
    storage,
    cookieNames: browserStorage.cookies.map((x) => x.name),
    browserStorageOrigins: browserStorage.origins.length,
  });
  await page.goto(origin + '/after');
  await page.waitForTimeout(1200);
  const events = [];
  for (const r of requests.filter((r) => r.kind === 'intercepted-external')) {
    const query = new URL(r.url).searchParams;
    const bodies = r.body?.trim().split(/\r?\n/).filter(Boolean) ?? [''];
    for (const body of bodies) {
      const p = new URLSearchParams(query);
      for (const [k, v] of new URLSearchParams(body)) p.set(k, v);
      events.push({
        host: r.host,
        path: r.path,
        method: r.method,
        event: p.get('en'),
        keys: [...p.keys()].sort(),
        pageLocation: p.get('dl'),
        language: p.get('ul'),
        cookieHeaderPresent: !!r.headers.cookie,
        bodyContainsSyntheticPrivateMarker:
          JSON.stringify({ url: r.url, body: r.body }).includes('synthetic-never-send') ||
          JSON.stringify({ url: r.url, body: r.body }).includes('Synthetic private title') ||
          JSON.stringify({ url: r.url, body: r.body }).includes('pt-synthetic-language-sentinel'),
        sequence: p.get('_s'),
        consentStorageCode: p.get('gcs'),
        consentDetailCode: p.get('gcd'),
        nonPersonalizedAds: p.get('npa'),
        externalEventFlag: p.get('_ee'),
        clientIdPresent: p.has('cid'),
        sessionIdPresent: p.has('sid'),
        screenResolutionPresent: p.has('sr'),
        userIdPresent: p.has('uid'),
        eventFirstVisit: p.get('_fv'),
        sessionStart: p.get('_ss'),
      });
    }
  }
  const wire = requests
    .filter((r) => r.kind === 'intercepted-external' && r.path === '/g/collect')
    .flatMap((r) => decodeGoogleCollectRequest({ url: r.url, body: r.body }));
  const expected = [
    { name: 'page_view', locale: 'en', pagePath: '/en' },
    { name: 'page_view', locale: 'pt', pagePath: '/pt/cases/synthetic-case' },
    ...['contact_email_click', 'contact_linkedin_click', 'resume_open'].map((name) => ({
      name,
      locale: 'pt',
      pagePath: '/pt/cases/synthetic-case',
    })),
  ];
  const sequenceCheck = inspectGoogleEventSequence({
    wire,
    expected,
    origin: canonical,
    measurementId,
  });
  const proof = {
    version: 1,
    kind: 'real-google-sdk-completely-intercepted-inspection',
    activationPermitted: false,
    eventSequenceCheck: sequenceCheck,
    propertySettingsVerified: false,
    checkedAt: new Date().toISOString(),
    sdk: manifest,
    sdkGzipBytes: gzipSync(sdk).length,
    harnessBytes: Buffer.byteLength(bundle),
    harnessGzipBytes: gzipSync(bundle).length,
    externalRequestsForwarded: 0,
    rejectingProxyConnections: proxyRequests.length,
    interceptedRequests: requests.filter((x) => x.kind !== 'sdk').length,
    sdkRequests: requests.filter((x) => x.kind === 'sdk').length,
    unknownScriptRequests: requests
      .filter((x) => x.kind === 'intercepted-external' && x.path !== '/g/collect')
      .map((x) => ({ host: x.host, path: x.path, method: x.method })),
    events,
    pages,
    errors,
    failedRequests,
    consoleErrors,
  };
  await fs.writeFile(outputFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      status: sequenceCheck.matches
        ? 'sequence-passed-review-still-required'
        : 'sequence-mismatch-activation-blocked',
      sdkRequests: proof.sdkRequests,
      interceptedRequests: proof.interceptedRequests,
      eventSequenceCheck: sequenceCheck,
      sdkBytes: sdk.length,
      sdkGzipBytes: proof.sdkGzipBytes,
      externalRequestsForwarded: 0,
      output: outputFile,
    }),
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => proxy.close(resolve));
}
