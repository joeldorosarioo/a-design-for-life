import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { decodeGoogleCollectRequest, inspectGoogleEventSequence } from './google-wire.ts';

// Explicit, offline-only diagnostic. The SDK and browser APIs keep their real behavior.
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('.work/playwright-browsers');
const { chromium } = await import('@playwright/test');
const [manifestPath, outputPath, modeArgument, ...extra] = process.argv.slice(2);
const mode = modeArgument ?? 'document-policy';
assert(
  [
    'document-policy',
    'document-without-policy',
    'restrict-device-empty',
    'restrict-device-null',
    'restrict-device-without-policy',
  ].includes(mode),
  'Unknown diagnostic mode.',
);
assert(manifestPath && outputPath && extra.length === 0, 'Pass an SDK manifest and new JSON path.');
const manifestFile = path.resolve(manifestPath);
const outputFile = path.resolve(outputPath);
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const source = new URL(manifest.sourceUrl);
assert.equal(source.origin, 'https://www.googletagmanager.com');
assert.equal(source.pathname, '/gtag/js');
assert(!source.username && !source.password && !source.hash);
assert.equal(source.searchParams.size, 1);
const measurementId = source.searchParams.get('id');
assert.match(measurementId ?? '', /^G-[A-Z0-9]{4,32}$/);
assert.equal(manifest.httpStatus, 200);
const sdk = await fs.readFile(path.join(path.dirname(manifestFile), 'gtag.js'));
assert.equal(sdk.length, manifest.byteLength);
assert.equal(createHash('sha256').update(sdk).digest('hex'), manifest.sha256);
const sdkText = sdk.toString('utf8');
const diagnosticMode = mode;
const origin = 'https://analytics-fixture.example.invalid';
const canonical = 'https://portfolio-e3.example.invalid';
const expectedMain = [
  { name: 'page_view', locale: 'en', pagePath: '/en' },
  { name: 'page_view', locale: 'pt', pagePath: '/pt/cases/synthetic-case' },
  ...['contact_email_click', 'contact_linkedin_click', 'resume_open'].map((name) => ({
    name,
    locale: 'pt',
    pagePath: '/pt/cases/synthetic-case',
  })),
];
const expectedSingle = [{ name: 'page_view', locale: 'en', pagePath: '/en' }];
const privateMarkers = [
  'synthetic-private-token',
  'Synthetic private title',
  'diagnostic-language-marker',
  '987654321.123456789',
  '1730000000',
];
const legacyCookies = [
  { name: '_ga', value: 'GA1.1.987654321.123456789', url: origin },
  {
    name: '_ga_' + measurementId.slice(2),
    value: 'GS2.1.s1730000000$o9$g1$t1730000099$j0$l0$h0',
    url: origin,
  },
  { name: '_gcl_au', value: '1.1.987654321.1730000000', url: origin },
];
const bundled = await build({
  stdin: {
    contents: `import {mountDocumentAnalytics} from './document-analytics';
const runtime={environment:'production',area:'public',preview:false,publicSiteEnabled:true,measurementId:'${measurementId}',siteOrigin:'${canonical}'};
let release=()=>{};
const loadScript=(script)=>document.head.appendChild(script);
window.commit=(context)=>{release();release=mountDocumentAnalytics({document,runtime,context,loadScript});};`,
    resolveDir: path.resolve('src/features/analytics/browser'),
    loader: 'ts',
  },
  platform: 'browser',
  format: 'iife',
  bundle: true,
  minify: true,
  write: false,
});
let bundle = bundled.outputFiles[0].text;
if (mode.startsWith('restrict-device')) {
  // An explicit configuration experiment: real session, standard Google queue, no SDK/request mutation.
  const screenResolution = mode === 'restrict-device-null' ? 'null' : "''";
  const restricted = await build({
    stdin: {
      contents: `import {createGtagSession} from '../gtag-session';
const runtime={environment:'production',area:'public',preview:false,publicSiteEnabled:true,measurementId:'${measurementId}',siteOrigin:'${canonical}'};
window.dataLayer=[];window.gtag=function(){window.dataLayer.push(arguments);};
const policy=document.featurePolicy;const feature='ch-ua-high-entropy-values';
window.boundaryProof={featureSupported:typeof policy?.features==='function'&&typeof policy?.allowsFeature==='function'&&policy.features().includes(feature),featureAllowed:typeof policy?.allowsFeature==='function'?policy.allowsFeature(feature):true};
let requested=false,context;
const session=createGtagSession({runtime,dispatch(...command){
if(!window.boundaryProof.featureSupported||window.boundaryProof.featureAllowed)return;
if(command[0]==='set'&&command[1]?.ads_data_redaction===true)command[1]={...command[1],screen_resolution:${screenResolution}};
window.gtag(...command);if(command[0]==='event'&&!requested){requested=true;const script=document.createElement('script');script.src='${manifest.sourceUrl}';document.head.appendChild(script);}}});
window.commit=value=>{context=value;session.completeNavigation(context);};
document.addEventListener('click',event=>{const anchor=event.target.closest('a[data-analytics-purpose]');if(anchor)session.trackContact(anchor.dataset.analyticsPurpose,context);});`,
      resolveDir: path.resolve('src/features/analytics/browser'),
      loader: 'ts',
    },
    platform: 'browser',
    format: 'iife',
    bundle: true,
    minify: true,
    write: false,
  });
  bundle = restricted.outputFiles[0].text;
}
const proxyRequests = [];
const proxy = http.createServer((req, res) => {
  proxyRequests.push(req.method);
  res.writeHead(502).end();
});
proxy.on('connect', (req, socket) => {
  proxyRequests.push('CONNECT');
  socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
let browser;
const contexts = [];
const documents = [];
const debugCookieSelectors = [];
const diagnosticErrors = [];
const decodeErrors = new Map();
const requests = [];
const labels = new WeakMap();
try {
  browser = await chromium.launch({
    headless: true,
    proxy: { server: `http://127.0.0.1:${proxy.address().port}` },
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--no-first-run',
      '--disable-quic',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ],
  });
  async function newContext() {
    const context = await browser.newContext({ serviceWorkers: 'block', ignoreHTTPSErrors: true });
    contexts.push(context);
    await context.addInitScript(() => {
      const state = {
        cookieReads: [],
        cookieWrites: [],
        storageCalls: [],
        indexedDbOpens: 0,
        highEntropyCalls: [],
        highEntropyResultKeys: [],
      };
      window.privacyObservation = state;
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      if (descriptor?.get && descriptor?.set)
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          get() {
            state.cookieReads.push(new Error().stack?.split('\n').slice(2, 8));
            return descriptor.get.call(document);
          },
          set(value) {
            state.cookieWrites.push(String(value).split('=')[0]);
            return descriptor.set.call(document, value);
          },
        });
      for (const name of ['getItem', 'key', 'setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function (...args) {
          state.storageCalls.push(name);
          return original.apply(this, args);
        };
      }
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = function (...args) {
        state.indexedDbOpens++;
        return open(...args);
      };
      const uaData = navigator.userAgentData;
      if (uaData?.getHighEntropyValues) {
        const prototype = Object.getPrototypeOf(uaData);
        const original = prototype.getHighEntropyValues;
        prototype.getHighEntropyValues = function (hints) {
          state.highEntropyCalls.push([...hints]);
          return original.call(this, hints).then((value) => {
            state.highEntropyResultKeys.push(Object.keys(value).sort());
            return value;
          });
        };
      }
    });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let label;
      try {
        label = labels.get(request.frame().page());
      } catch {
        label = 'unowned';
      }
      if (url.origin === origin) {
        if (url.pathname === '/harness.js')
          await route.fulfill({ contentType: 'text/javascript', body: bundle });
        else
          await route.fulfill({
            contentType: 'text/html',
            headers: !mode.endsWith('without-policy')
              ? { 'Permissions-Policy': 'ch-ua-high-entropy-values=()' }
              : {},
            body: '<!doctype html><title>Synthetic private title</title><a id="email" href="#private-email" data-analytics-purpose="email">Email</a><a id="linkedin" href="#private-linkedin" data-analytics-purpose="linkedin">LinkedIn</a><a id="resume" href="#private-resume" data-analytics-purpose="resume">Resume</a><script src="/harness.js"></script>',
          });
      } else if (request.url() === manifest.sourceUrl) {
        requests.push({ kind: 'sdk', label });
        await route.fulfill({ contentType: 'application/javascript', body: sdk });
      } else {
        requests.push({
          kind: 'external',
          label,
          url: request.url(),
          body: request.postData(),
          method: request.method(),
          headers: await request.allHeaders(),
        });
        if (request.resourceType() === 'script') await route.abort();
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
      diagnosticErrors.push('websocket-attempt');
      socket.close();
    });
    return context;
  }
  async function observeCookieSelectors(context, page) {
    // Debugger observes arguments to the intact SDK's cookie reader, without rewriting it.
    const reader = sdkText.indexOf('var wq=function(){');
    assert(reader >= 0, 'Pinned SDK cookie reader changed: review diagnostic breakpoint.');
    const brace = sdkText.indexOf('{', reader) + 1;
    const prefix = sdkText.slice(0, brace).split('\n');
    const session = await context.newCDPSession(page);
    await session.send('Debugger.enable');
    await session.send('Debugger.setBreakpointByUrl', {
      url: manifest.sourceUrl,
      lineNumber: prefix.length - 1,
      columnNumber: prefix.at(-1).length,
    });
    const optOutReader = sdkText.indexOf('var JS=function(a){');
    assert(optOutReader >= 0, 'Pinned SDK opt-out reader changed: review breakpoint.');
    const optOutPrefix = sdkText.slice(0, sdkText.indexOf('{', optOutReader) + 1).split('\n');
    await session.send('Debugger.setBreakpointByUrl', {
      url: manifest.sourceUrl,
      lineNumber: optOutPrefix.length - 1,
      columnNumber: optOutPrefix.at(-1).length,
    });
    session.on('Debugger.paused', async ({ callFrames }) => {
      try {
        const named = callFrames.find((frame) => frame.functionName === 'tq');
        const result =
          named &&
          (await session.send('Debugger.evaluateOnCallFrame', {
            callFrameId: named.callFrameId,
            expression: "typeof a === 'string' ? a : null",
            returnByValue: true,
            silent: true,
          }));
        debugCookieSelectors.push({
          cookieName: result?.result?.value ?? null,
          cookiePredicate:
            callFrames[0]?.functionName === 'JS'
              ? (
                  await session.send('Debugger.evaluateOnCallFrame', {
                    callFrameId: callFrames[0].callFrameId,
                    expression: 'String(a)',
                    returnByValue: true,
                    silent: true,
                  })
                ).result.value
              : null,
          functions: callFrames.slice(0, 7).map((frame) => frame.functionName),
        });
      } catch {
        diagnosticErrors.push('cookie-selector-debugger-error');
      } finally {
        await session.send('Debugger.resume').catch(() => {});
      }
    });
  }
  function wireFor(label) {
    return requests
      .filter((request) => request.kind === 'external' && request.label === label)
      .flatMap((request) => {
        try {
          return decodeGoogleCollectRequest({ url: request.url, body: request.body });
        } catch {
          const url = new URL(request.url);
          const key = url.origin + url.pathname;
          decodeErrors.set(key, {
            origin: url.origin,
            path: url.pathname,
            method: request.method,
            queryKeys: [...url.searchParams.keys()].sort(),
          });
          return [];
        }
      });
  }
  async function runDocument(context, page, label, mode = 'single') {
    const before = await context.cookies();
    await page.goto(origin + '/harness?private=synthetic-private-token');
    labels.set(page, label);
    await page.evaluate(() => window.commit({ locale: 'en', pagePath: '/en' }));
    if (mode === 'main') {
      await page.waitForTimeout(1800);
      await page.evaluate(() =>
        window.commit({ locale: 'pt', pagePath: '/pt/cases/synthetic-case' }),
      );
      for (const id of ['email', 'linkedin', 'resume']) await page.locator('#' + id).click();
    }
    const expected = diagnosticMode.endsWith('without-policy')
      ? []
      : mode === 'main'
        ? expectedMain
        : expectedSingle;
    const deadline = Date.now() + 15000;
    while (wireFor(label).length < expected.length && Date.now() < deadline)
      await page.waitForTimeout(100);
    await page.waitForTimeout(1300);
    const observation = await page.evaluate(async () => ({
      ...window.privacyObservation,
      boundaryProof: window.boundaryProof ?? {
        featureSupported: !!document.featurePolicy
          ?.features()
          .includes('ch-ua-high-entropy-values'),
        featureAllowed: document.featurePolicy?.allowsFeature('ch-ua-high-entropy-values') ?? true,
      },
      analyticsGlobals: { dataLayerPresent: 'dataLayer' in window, gtagPresent: 'gtag' in window },
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
      indexedDbDatabases: (await indexedDB.databases()).length,
      cacheNames: (await caches.keys()).length,
      windowName: window.name,
    }));
    const state = await context.storageState({ indexedDB: true });
    const unchangedCookies = JSON.stringify(before) === JSON.stringify(await context.cookies());
    const check = inspectGoogleEventSequence({
      wire: wireFor(label),
      expected,
      origin: canonical,
      measurementId,
    });
    documents.push({
      label,
      eventSequenceCheck: check,
      observation,
      unchangedCookies,
      cookieNames: state.cookies.map((cookie) => cookie.name),
      storedOrigins: state.origins.length,
    });
    await page.goto(origin + '/neutral');
    await page.waitForTimeout(1000);
  }
  const shared = await newContext();
  await shared.addCookies([{ name: 'portfolio_locale', value: 'pt', url: origin }]);
  const page = await shared.newPage();
  page.on('pageerror', (error) => diagnosticErrors.push(error.name));
  await observeCookieSelectors(shared, page);
  await runDocument(shared, page, 'same-context-first-document', 'main');
  await runDocument(shared, page, 'same-context-new-document');
  await shared.addCookies([{ name: 'portfolio_locale', value: 'en', url: origin }]);
  const newTab = await shared.newPage();
  await runDocument(shared, newTab, 'same-context-new-tab-locale-en');
  await shared.clearCookies({ name: 'portfolio_locale' });
  await runDocument(shared, newTab, 'same-context-locale-absent');
  const seeded = await newContext();
  await seeded.addCookies([
    ...legacyCookies,
    { name: 'portfolio_locale', value: 'diagnostic-language-marker', url: origin },
  ]);
  await runDocument(seeded, await seeded.newPage(), 'new-context-existing-analytics-cookies');

  const wires = documents.map(({ label }) => wireFor(label));
  // Unload may flush a late event. Validate the final capture, not an earlier snapshot.
  documents.forEach((document, index) => {
    const expected = mode.endsWith('without-policy')
      ? []
      : index === 0
        ? expectedMain
        : expectedSingle;
    document.eventSequenceCheck = inspectGoogleEventSequence({
      wire: wires[index],
      expected,
      origin: canonical,
      measurementId,
    });
  });
  const identifierComparison = (key) => ({
    presentInAllEvents: wires.every(
      (wire) => wire.length > 0 && wire.every((event) => !!event[key]),
    ),
    constantWithinEachDocument: wires.every(
      (wire) => new Set(wire.map((event) => event[key])).size === 1,
    ),
    distinctAcrossDocuments: new Set(wires.map((wire) => wire[0]?.[key])).size === wires.length,
    equalsSeededCookieIdentifier: wires
      .flat()
      .some((event) => privateMarkers.slice(3).some((marker) => event[key]?.includes(marker))),
  });
  const outgoing = requests.filter((request) => request.kind === 'external');
  const unknownDestinations = outgoing
    .filter(
      (request) =>
        !/^(?:(?:www|region\d+)\.)?google-analytics\.com$/.test(new URL(request.url).hostname) ||
        new URL(request.url).pathname !== '/g/collect',
    )
    .map((request) => ({
      origin: new URL(request.url).origin,
      path: new URL(request.url).pathname,
    }));
  const unattributedExternalRequests = outgoing
    .filter((request) => !documents.some((document) => document.label === request.label))
    .map((request) => ({
      origin: new URL(request.url).origin,
      path: new URL(request.url).pathname,
    }));
  const httpHeaderNames = [
    ...new Set(outgoing.flatMap((request) => Object.keys(request.headers))),
  ].sort();
  const highEntropyHttpHeaders = [
    'sec-ch-ua-arch',
    'sec-ch-ua-bitness',
    'sec-ch-ua-full-version',
    'sec-ch-ua-full-version-list',
    'sec-ch-ua-model',
    'sec-ch-ua-platform-version',
    'sec-ch-ua-wow64',
  ];
  const sequenceAndDestinationCheckPassed =
    documents.every((document) => document.eventSequenceCheck.matches) &&
    !decodeErrors.size &&
    !unknownDestinations.length &&
    !unattributedExternalRequests.length &&
    !diagnosticErrors.length;
  const events = wires.flat().map((event) => ({
    name: event.en,
    keys: Object.keys(event).sort(),
    locale: event.ul,
    pageLocation: event.dl,
    consentStorageCode: event.gcs,
    nonPersonalizedAds: event.npa,
    userIdPresent: 'uid' in event,
    nonemptyDeviceFields: ['sr', 'uaa', 'uab', 'uafvl', 'uam', 'uamb', 'uap', 'uapv', 'uaw'].filter(
      (key) => !!event[key],
    ),
  }));
  const proof = {
    version: 1,
    kind: 'real-sdk-cross-document-privacy-inspection',
    checkedAt: new Date().toISOString(),
    activationPermitted: false,
    propertySettingsVerified: false,
    browserVersion: browser.version(),
    experiment: mode
      ? {
          mode,
          permissionPolicyHeader: mode.endsWith('without-policy')
            ? null
            : 'ch-ua-high-entropy-values=()',
          screenResolutionOverride: mode === 'restrict-device-null' ? null : '',
          applicationRuntimeChanged: false,
          usesDocumentAdapter: mode.startsWith('document'),
        }
      : null,
    sdk: manifest,
    networkIsolation: {
      externalRequestsForwarded: 0,
      rejectingProxyConnections: proxyRequests.length,
      everyBrowserRequestRouted: true,
      sdkFulfilledFromPinnedBytes: true,
      sdkModified: false,
      requestsFilteredOrRewritten: false,
    },
    sdkRequests: requests.filter((request) => request.kind === 'sdk').length,
    externalRequests: outgoing.length,
    sequenceAndDestinationCheckPassed,
    unknownDestinations,
    unattributedExternalRequests,
    httpHeaders: {
      examinedRequests: outgoing.length,
      names: httpHeaderNames,
      highEntropyClientHints: Object.fromEntries(
        highEntropyHttpHeaders.map((name) => [
          name,
          outgoing.some((request) => !!request.headers[name]),
        ]),
      ),
      userAgentHeaderPresentInAll:
        outgoing.length > 0 && outgoing.every((request) => !!request.headers['user-agent']),
    },
    cookieHeaderPresent: outgoing.some((request) => !!request.headers.cookie),
    privateMarkerPresent: outgoing.some((request) =>
      privateMarkers.some((marker) => JSON.stringify(request).includes(marker)),
    ),
    identifiers: { clientId: identifierComparison('cid'), sessionId: identifierComparison('sid') },
    cookieReadSelectors: debugCookieSelectors,
    documents,
    events,
    decodeErrors: [...decodeErrors.values()],
    diagnosticErrors,
    limitation:
      'Observed relationships apply to these intact pinned bytes and synthetic Chromium documents; no server processing or reports were exercised. Raw identifiers remain only in memory.',
  };
  await fs.writeFile(outputFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      status: 'privacy-inspected-activation-blocked',
      documents: documents.length,
      events: events.length,
      identifiers: proof.identifiers,
      sequencesPass: sequenceAndDestinationCheckPassed,
      privateMarkerPresent: proof.privateMarkerPresent,
      output: outputFile,
    }),
  );
} finally {
  for (const context of contexts) await context.close();
  if (browser) await browser.close();
  await new Promise((resolve) => proxy.close(resolve));
}
