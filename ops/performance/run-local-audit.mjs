import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { access, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireFromApp = createRequire(path.join(root, 'package.json'));
const profileFile = new URL('./profiles.json', import.meta.url);
const metricIds = [
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
  'first-contentful-paint',
  'speed-index',
];

export function measurementPlan(settings, targets) {
  assert.equal(settings.repetitions, 3);
  assert.deepEqual(settings.locales, ['pt', 'en']);
  assert.deepEqual(settings.performanceKinds, ['home', 'cases', 'case']);
  assert.equal(settings.profiles.length, 2);
  const selected = settings.performanceKinds.flatMap((kind) =>
    settings.locales.map((locale) => {
      const matches = targets.filter((target) => target.kind === kind && target.locale === locale);
      assert.equal(matches.length, 1, `Expected exactly one ${locale} ${kind} target.`);
      return matches[0];
    }),
  );
  return selected.flatMap((target) =>
    settings.profiles.flatMap((profile) =>
      Array.from({ length: settings.repetitions }, (_, index) => ({
        target,
        profile,
        repeat: index + 1,
      })),
    ),
  );
}

export function metricSummary(values, expectedRuns = 3) {
  assert.equal(values.length, expectedRuns, 'Every planned run must have a metric.');
  assert(values.every((value) => Number.isFinite(value) && value >= 0));
  const sorted = [...values].sort((left, right) => left - right);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted.at(-1),
    runs: values.length,
  };
}

async function save(directory, filename, value) {
  await writeFile(path.join(directory, filename), JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}

async function loadInput(configFile, output) {
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  const origin = new URL(config.origin);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  assert.equal(origin.pathname, '/');
  assert(!origin.username && !origin.password && !origin.search && !origin.hash);
  assert(
    ['temporary-lorem-content', 'synthetic-fixture', 'editorial-content'].includes(config.dataKind),
  );
  assert.equal(config.readerStatus, 'not-exercised');
  assert(config.binding && /^sha256:[a-f0-9]{64}$/.test(config.binding.imageId));
  assert(/^[a-f0-9]{64}$/.test(config.binding.containerId));
  const targets = config.targets;
  assert(Array.isArray(targets) && targets.length === 8);
  for (const target of targets) {
    assert(/^[a-z0-9-]+$/.test(target.id));
    assert(['pt', 'en'].includes(target.locale));
    assert(['home', 'cases', 'about', 'case'].includes(target.kind));
    const selected = new URL(target.path, origin);
    assert.equal(selected.origin, origin.origin);
    assert.equal(selected.pathname, target.path);
    assert(!selected.search && !selected.hash);
    const fixedPaths = {
      home: `/${target.locale}`,
      cases: `/${target.locale}/cases`,
      about: target.locale === 'pt' ? '/pt/sobre' : '/en/about',
    };
    if (target.kind === 'case') assert(target.path.startsWith(`/${target.locale}/cases/`));
    else assert.equal(target.path, fixedPaths[target.kind]);
  }
  assert.equal(new Set(targets.map((target) => target.id)).size, targets.length);
  assert.equal(new Set(targets.map((target) => target.path)).size, targets.length);
  const publicationKinds = targets.filter((target) => target.kind === 'about');
  assert.deepEqual(publicationKinds.map((target) => target.locale).sort(), ['en', 'pt']);
  const rawProfiles = await readFile(profileFile);
  const settings = JSON.parse(rawProfiles.toString());
  const plan = measurementPlan(settings, targets);
  const directory = path.resolve(output);
  const relative = path.relative(path.join(root, '.work/local-audits'), directory);
  assert(
    relative &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
  );
  assert(
    !(await lstat(directory).catch(() => null)),
    'Use a new output directory for every audit.',
  );
  let ancestor = path.dirname(directory);
  while (!(await lstat(ancestor).catch(() => null))) ancestor = path.dirname(ancestor);
  const realAncestor = await realpath(ancestor);
  assert.equal(realAncestor.toLowerCase(), path.resolve(ancestor).toLowerCase());
  return {
    config,
    origin: origin.origin,
    targets,
    settings,
    plan,
    directory,
    profileSha256: createHash('sha256').update(rawProfiles).digest('hex'),
  };
}

async function ready(page, url) {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  assert.equal(response?.status(), 200);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function browserAudit(input, chromium, AxeBuilder) {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const target of input.targets) {
      for (const width of input.settings.browserWidths) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : input.settings.browserHeight },
          deviceScaleFactor: width === 390 ? 3 : 1,
          isMobile: width === 390,
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const externalRequests = [];
        const errors = [];
        context.on('request', (request) => {
          const url = new URL(request.url());
          if (['http:', 'https:'].includes(url.protocol) && url.origin !== input.origin)
            externalRequests.push(url.origin);
        });
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          return ['http:', 'https:'].includes(url.protocol) && url.origin !== input.origin
            ? route.abort()
            : route.continue();
        });
        page.on('pageerror', (error) => errors.push(error.name));
        try {
          await ready(page, new URL(target.path, input.origin).href);
          const metadata = await page.evaluate(() => {
            const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
            return {
              title: document.title,
              language: document.documentElement.lang,
              description: document.querySelector('meta[name="description"]')?.content ?? null,
              canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
              alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(
                (link) => ({ locale: link.hreflang, href: link.href }),
              ),
              mainCount: document.querySelectorAll('main').length,
              h1Count: document.querySelectorAll('main h1').length,
              overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
              brokenImages: [...document.images].filter(
                (image) => image.complete && image.naturalWidth === 0,
              ).length,
              pendingLazyImages: [...document.images].filter(
                (image) => !image.complete && image.loading === 'lazy',
              ).length,
              contentFingerprint:
                document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            };
          });
          const fingerprint = createHash('sha256')
            .update(metadata.contentFingerprint)
            .digest('hex');
          delete metadata.contentFingerprint;
          await page.locator('a[href="#main-content"]').focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.activeElement?.id === 'main-content');
          metadata.skipLinkMovesFocus = await page.evaluate(
            () => document.activeElement?.id === 'main-content',
          );
          await page.evaluate(() => {
            history.replaceState(null, '', location.pathname);
            window.scrollTo(0, 0);
          });
          const closed = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const menu = { applicable: false };
          const trigger = page.locator('[data-portfolio-header] button[aria-haspopup="dialog"]');
          if (await trigger.isVisible()) {
            menu.applicable = true;
            await trigger.focus();
            await page.keyboard.press('Enter');
            await page.getByRole('dialog').waitFor({ state: 'visible' });
            const opened = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
              .analyze();
            menu.violations = opened.violations.map(({ id, impact, nodes }) => ({
              id,
              impact,
              targets: nodes.flatMap((node) => node.target),
            }));
            menu.focusTrapped = true;
            for (let step = 0; step < 8; step++) {
              await page.keyboard.press('Tab');
              menu.focusTrapped &&= await page.evaluate(() =>
                document.querySelector('[role="dialog"]')?.contains(document.activeElement),
              );
            }
            for (let step = 0; step < 4; step++) {
              await page.keyboard.press('Shift+Tab');
              menu.focusTrapped &&= await page.evaluate(() =>
                document.querySelector('[role="dialog"]')?.contains(document.activeElement),
              );
            }
            await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            await page.waitForFunction(
              () =>
                document.querySelector('[data-portfolio-header] button[aria-haspopup="dialog"]') ===
                document.activeElement,
            );
            menu.focusReturned = await trigger.evaluate(
              (element) => element === document.activeElement,
            );
          }
          await page.screenshot({
            path: path.join(input.directory, `${target.id}-${width}.png`),
            fullPage: true,
            scale: 'css',
          });
          rows.push({
            target: target.id,
            path: target.path,
            width,
            deviceScaleFactor: width === 390 ? 3 : 1,
            metadata,
            contentSha256: fingerprint,
            violations: closed.violations.map(({ id, impact, nodes }) => ({
              id,
              impact,
              targets: nodes.flatMap((node) => node.target),
            })),
            incomplete: closed.incomplete.map(({ id, nodes }) => ({
              id,
              count: nodes.length,
              targets: nodes.flatMap((node) => node.target),
              reasons: [...new Set(nodes.map((node) => node.failureSummary))],
            })),
            menu,
            pageErrors: errors,
            externalOrigins: [...new Set(externalRequests)],
          });
          await save(input.directory, `${target.id}-${width}-browser.json`, rows.at(-1));
        } finally {
          await context.close();
        }
      }
    }
    const http = [];
    for (const target of [
      '/robots.txt',
      '/sitemap.xml',
      '/pt/cases/audit-missing-route',
      '/en/cases/audit-missing-route',
      '/admin/login',
    ]) {
      const response = await fetch(new URL(target, input.origin), {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.text();
      http.push({
        path: target,
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
        robots: response.headers.get('x-robots-tag'),
        canonical: /<link[^>]+rel=["']canonical["']/.test(body),
        bodySha256: createHash('sha256').update(body).digest('hex'),
        sitemapUrls: target === '/sitemap.xml' ? [...body.matchAll(/<loc>/g)].length : null,
        blocksAllCrawlers: target === '/robots.txt' ? /^Disallow:\s*\/\s*$/im.test(body) : null,
      });
    }
    const report = { browser: browser.version(), rows, http };
    await save(input.directory, 'browser-summary.json', report);
    return report;
  } finally {
    await browser.close();
  }
}

export async function performanceAudit(input) {
  const lighthousePath = requireFromApp.resolve('lighthouse');
  const { default: lighthouse } = await import(pathToFileURL(lighthousePath));
  const requireFromLighthouse = createRequire(lighthousePath);
  const chromeLauncher = await import(
    pathToFileURL(requireFromLighthouse.resolve('chrome-launcher'))
  );
  const browserParent = path.join(root, '.work/playwright-browsers');
  const shell = (await readdir(browserParent)).find((name) =>
    name.startsWith('chromium_headless_shell-'),
  );
  assert(shell, 'Install the project-pinned Chromium before auditing.');
  const chromePath = path.join(
    browserParent,
    shell,
    process.platform === 'win32'
      ? 'chrome-headless-shell-win64/chrome-headless-shell.exe'
      : 'chrome-headless-shell-linux64/chrome-headless-shell',
  );
  await access(chromePath);
  const rows = [];
  for (const { target, profile, repeat } of input.plan) {
    const session = path.join(input.directory, `${target.id}-${profile.id}-${repeat}-profile`);
    await mkdir(session, { mode: 0o700 });
    let chrome;
    try {
      chrome = await chromeLauncher.launch({
        chromePath,
        port: 0,
        userDataDir: session,
        logLevel: 'silent',
        chromeFlags: [
          '--headless=new',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-sync',
          '--host-resolver-rules=MAP * ~NOTFOUND,EXCLUDE 127.0.0.1,EXCLUDE localhost',
        ],
      });
      const result = await lighthouse(new URL(target.path, input.origin).href, {
        port: chrome.port,
        hostname: '127.0.0.1',
        logLevel: 'silent',
        enableErrorReporting: false,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        disableFullPageScreenshot: true,
        formFactor: profile.formFactor,
        screenEmulation: {
          mobile: profile.formFactor === 'mobile',
          width: profile.width,
          height: profile.height,
          deviceScaleFactor: profile.deviceScaleFactor,
          disabled: false,
        },
        throttlingMethod: input.settings.throttlingMethod,
        throttling: {
          rttMs: profile.rttMs,
          throughputKbps: profile.downloadKbps,
          requestLatencyMs: profile.rttMs,
          downloadThroughputKbps: profile.downloadKbps,
          uploadThroughputKbps: profile.uploadKbps,
          cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
        },
        maxWaitForFcp: 30_000,
        maxWaitForLoad: 45_000,
      });
      assert(
        result?.lhr && !result.lhr.runtimeError,
        'Lighthouse did not complete the intended page.',
      );
      assert.equal(
        new URL(result.lhr.finalDisplayedUrl ?? result.lhr.finalUrl).href,
        new URL(target.path, input.origin).href,
      );
      await save(
        input.directory,
        `${target.id}-${profile.id}-${repeat}-lhr.private.json`,
        result.lhr,
      );
      const metrics = Object.fromEntries(
        metricIds.map((id) => [id, result.lhr.audits[id].numericValue]),
      );
      assert(Object.values(metrics).every(Number.isFinite));
      const failedAudits = Object.values(result.lhr.audits)
        .filter(
          (audit) =>
            audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'informative',
        )
        .map(({ id, title, score, numericValue }) => ({ id, title, score, numericValue }));
      const networkOrigins = [
        ...new Set(
          (result.lhr.audits['network-requests']?.details?.items ?? []).flatMap(({ url }) => {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol) ? [parsed.origin] : [];
          }),
        ),
      ];
      assert(
        networkOrigins.every((origin) => origin === input.origin),
        'Unexpected external resource in local audit.',
      );
      const row = {
        target: target.id,
        path: target.path,
        profile: profile.id,
        repeat,
        metrics,
        failedAudits,
        networkOrigins,
        lighthouseVersion: result.lhr.lighthouseVersion,
        userAgent: result.lhr.userAgent,
        fetchTime: result.lhr.fetchTime,
        appliedSettings: result.lhr.configSettings,
      };
      rows.push(row);
      await save(input.directory, `${target.id}-${profile.id}-${repeat}-lighthouse.json`, row);
      console.log(
        JSON.stringify({
          phase: 'lighthouse',
          completed: rows.length,
          total: input.plan.length,
          target: target.id,
          profile: profile.id,
          repeat,
        }),
      );
    } finally {
      await chrome?.kill();
      await rm(session, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
  const scenarios = input.targets
    .filter((target) => input.settings.performanceKinds.includes(target.kind))
    .flatMap((target) =>
      input.settings.profiles.map((profile) => {
        const selected = rows.filter(
          (row) => row.target === target.id && row.profile === profile.id,
        );
        const metrics = Object.fromEntries(
          metricIds.map((id) => [id, metricSummary(selected.map((row) => row.metrics[id]))]),
        );
        return {
          target: target.id,
          profile: profile.id,
          metrics,
          budgets: profile.budgets,
          budgetPass:
            metrics['largest-contentful-paint'].median <= profile.budgets.lcpMs &&
            metrics['cumulative-layout-shift'].median <= profile.budgets.cls &&
            metrics['total-blocking-time'].median <= profile.budgets.tbtMs,
        };
      }),
    );
  const summary = { runs: rows.length, scenarios };
  await save(input.directory, 'performance-summary.json', summary);
  return summary;
}

function readRuntimeBinding(expected) {
  const image = execFileSync(
    'docker',
    [
      'container',
      'inspect',
      '--format',
      '{{.Id}} {{.Image}} {{.State.Running}}',
      expected.containerId,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 10_000 },
  ).trim();
  assert.equal(image, `${expected.containerId} ${expected.imageId} true`);
  const script = `
    const {readFileSync}=require('node:fs');
    const {createHash}=require('node:crypto');
    const {resolve}=require('node:path');
    const key=createHash('sha256').update(process.env.APP_ENV+process.env.SITE_ORIGIN+new URL(process.env.DATABASE_URI).pathname).digest('hex');
    const bytes=readFileSync(resolve('.work/publication',key,'current.json'));
    const root=JSON.parse(bytes);
    console.log(JSON.stringify({generation:root.generation,sha256:createHash('sha256').update(bytes).digest('hex')}));
  `;
  const publication = JSON.parse(
    execFileSync('docker', ['exec', expected.containerId, 'node', '-e', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    }),
  );
  assert(typeof publication.generation === 'string' && /^[a-f0-9]{64}$/.test(publication.sha256));
  return { containerId: expected.containerId, imageId: expected.imageId, publication };
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length === 4 || (args.length === 5 && args[4] === '--run'));
  assert.equal(args[0], '--config');
  assert.equal(args[2], '--output');
  assert.equal(process.versions.node, '24.22.2');
  const input = await loadInput(args[1], args[3]);
  const versions = Object.fromEntries(
    await Promise.all(
      ['lighthouse', '@axe-core/playwright', '@playwright/test'].map(async (name) => {
        const metadata = JSON.parse(
          await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'),
        );
        return [name, metadata.version];
      }),
    ),
  );
  assert.equal(versions.lighthouse, '13.6.0');
  assert.equal(versions['@axe-core/playwright'], '4.14.0');
  assert.equal(versions['@playwright/test'], '1.64.1');
  if (!args.includes('--run')) {
    console.log(
      JSON.stringify({
        ready: true,
        browserPages: input.targets.length * input.settings.browserWidths.length,
        lighthouseRuns: input.plan.length,
        profileSha256: input.profileSha256,
        versions,
      }),
    );
    return;
  }
  await mkdir(input.directory, { recursive: true, mode: 0o700 });
  await save(input.directory, 'run-config.json', input.config);
  await writeFile(path.join(input.directory, 'profiles.json'), await readFile(profileFile), {
    flag: 'wx',
    mode: 0o600,
  });
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.work/playwright-browsers');
  const { chromium } = requireFromApp('@playwright/test');
  const AxeBuilder = requireFromApp('@axe-core/playwright').default;
  const runtimeBefore = readRuntimeBinding(input.config.binding);
  const started = new Date().toISOString();
  await save(input.directory, 'runtime-start.json', { started, runtimeBefore });
  const browser = await browserAudit(input, chromium, AxeBuilder);
  const performance = await performanceAudit(input);
  assert.equal(
    createHash('sha256')
      .update(await readFile(profileFile))
      .digest('hex'),
    input.profileSha256,
    'The frozen profiles changed during measurement.',
  );
  const runtimeAfter = readRuntimeBinding(input.config.binding);
  assert.deepEqual(
    runtimeAfter,
    runtimeBefore,
    'The runtime or confirmed publication changed during measurement.',
  );
  const result = {
    started,
    finished: new Date().toISOString(),
    scope: input.config.dataKind,
    binding: { configured: input.config.binding, before: runtimeBefore, after: runtimeAfter },
    profileSha256: input.profileSha256,
    versions,
    machine: {
      platform: process.platform,
      cpu: cpus()[0]?.model,
      logicalProcessors: cpus().length,
      memoryBytes: totalmem(),
    },
    browser,
    performance,
    fieldData: 'unavailable-localhost',
    readerStatus: input.config.readerStatus,
    finalEditorialApproval: 'pending',
  };
  await save(input.directory, 'summary.json', result);
  console.log(
    JSON.stringify({
      complete: true,
      output: input.directory,
      lighthouseRuns: performance.runs,
      browserPages: browser.rows.length,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
