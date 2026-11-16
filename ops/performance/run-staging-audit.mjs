import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parse } from 'dotenv';
import { createStagingRelay } from './staging-relay.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireFromApp = createRequire(path.join(root, 'package.json'));
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
  await fs.writeFile(path.join(directory, filename), JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}

async function performanceAudit(input) {
  const lighthousePath = requireFromApp.resolve('lighthouse');
  const { default: lighthouse } = await import(pathToFileURL(lighthousePath));
  const requireFromLighthouse = createRequire(lighthousePath);
  const chromeLauncher = await import(
    pathToFileURL(requireFromLighthouse.resolve('chrome-launcher'))
  );
  const browserParent = path.join(root, '.work/playwright-browsers');
  const shell = (await fs.readdir(browserParent)).find((name) =>
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
  await fs.access(chromePath);
  const rows = [];
  for (const { target, profile, repeat } of input.plan) {
    const session = path.join(input.directory, `${target.id}-${profile.id}-${repeat}-profile`);
    await fs.mkdir(session, { mode: 0o700 });
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
      await fs.rm(session, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // This CLI is a read-only laboratory consumer. It cannot select a production origin.
  const stagingOrigin = 'https://1tiveqtdwa1kxsjfhtugcjdp.200.141.19.143.sslip.io';
  const [configFile, outputDirectory, mode, ...extra] = process.argv.slice(2);
  assert(
    configFile && outputDirectory && ['--preflight', '--run'].includes(mode) && extra.length === 0,
    'Usage: node ops/performance/run-staging-audit.mjs <config.json> <new-output-directory> --preflight|--run',
  );
  assert.equal(process.versions.node, '26.13.1');
  const configBytes = await fs.readFile(configFile);
  const config = JSON.parse(configBytes.toString());
  assert.equal(config.origin, stagingOrigin);
  assert.match(config.sourceSha, /^[a-f0-9]{40}$/);
  assert.match(config.imageDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(config.environment, 'staging');
  const profilesBytes = await fs.readFile(new URL('./profiles.json', import.meta.url));
  const settings = JSON.parse(profilesBytes.toString());
  const profileSha256 = createHash('sha256').update(profilesBytes).digest('hex');
  assert.equal(config.profileSha256, profileSha256);
  const targets = config.targets;
  const plan = measurementPlan(settings, targets);
  assert.equal(targets.length, settings.performanceKinds.length * settings.locales.length);
  for (const target of targets) {
    assert.equal(target.id, `${target.kind}-${target.locale}`);
    const localePath = `/${target.locale}`;
    if (target.kind === 'case') {
      const prefix = `${localePath}/cases/`;
      assert(target.path.startsWith(prefix));
      assert.match(target.path.slice(prefix.length), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    } else {
      assert.equal(target.path, target.kind === 'home' ? localePath : `${localePath}/cases`);
    }
  }
  const directory = path.resolve(outputDirectory);
  assert(directory.startsWith(path.resolve('.work/local-audits') + path.sep));
  await assert.rejects(fs.access(directory), { code: 'ENOENT' });
  await fs.access('documentation/OPERATIONS.md');
  if (mode === '--preflight') {
    console.log(
      JSON.stringify({
        ready: true,
        origin: stagingOrigin,
        sourceSha: config.sourceSha,
        imageDigest: config.imageDigest,
        profileSha256,
        runs: plan.length,
        scenarios: 12,
        cache: settings.cache,
        configurationSha256: createHash('sha256').update(configBytes).digest('hex'),
      }),
    );
  } else {
    const env = parse(await fs.readFile('.env', 'utf8'));
    assert(env.STAGING_BASIC_AUTH_USERNAME && env.STAGING_BASIC_AUTH_PASSWORD);
    const authorization =
      'Basic ' +
      Buffer.from(env.STAGING_BASIC_AUTH_USERNAME + ':' + env.STAGING_BASIC_AUTH_PASSWORD).toString(
        'base64',
      );
    const relay = createStagingRelay({ origin: stagingOrigin, authorization });
    const methods = new Set();
    let relayRequests = 0;
    relay.on('request', (request) => {
      relayRequests++;
      methods.add(request.method);
    });
    relay.listen(0, '127.0.0.1');
    await once(relay, 'listening');
    const localOrigin = 'http://127.0.0.1:' + relay.address().port;
    await fs.mkdir(directory, { recursive: false, mode: 0o700 });
    await fs.writeFile(path.join(directory, 'profiles.json'), profilesBytes, { flag: 'wx' });
    await fs.writeFile(path.join(directory, 'run-config.json'), configBytes, { flag: 'wx' });
    const startedAt = new Date().toISOString();
    const httpChecks = [];
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('.work/playwright-browsers');
    const { chromium } = await import('@playwright/test');
    let browser;
    try {
      // Warm the exact target/profile resources. Every measured run still uses a fresh browser profile.
      browser = await chromium.launch({ headless: true });
      const browserVersion = browser.version();
      for (const target of targets) {
        for (const profile of settings.profiles) {
          const context = await browser.newContext({
            viewport: { width: profile.width, height: profile.height },
            deviceScaleFactor: profile.deviceScaleFactor,
            isMobile: profile.formFactor === 'mobile',
            serviceWorkers: 'block',
          });
          const externalOrigins = [];
          await context.route('**/*', async (route) => {
            if (new URL(route.request().url()).origin !== localOrigin) {
              externalOrigins.push(new URL(route.request().url()).origin);
              await route.abort();
            } else await route.continue();
          });
          const page = await context.newPage();
          const response = await page.goto(localOrigin + target.path, {
            waitUntil: 'networkidle',
            timeout: 60000,
          });
          assert.equal(response.status(), 200);
          assert.equal(externalOrigins.length, 0);
          httpChecks.push({
            path: target.path,
            profile: profile.id,
            status: response.status(),
            bodySha256: createHash('sha256')
              .update(await response.body())
              .digest('hex'),
            noindex: response.headers()['x-robots-tag'] ?? null,
          });
          await context.close();
        }
      }
      await browser.close();
      browser = null;
      await fs.writeFile(
        path.join(directory, 'premeasurement.json'),
        JSON.stringify(
          {
            startedAt,
            browserVersion,
            profileSha256,
            httpChecks,
            authentication:
              'Upstream Basic Auth injected by GET/HEAD-only loopback relay; no editorial session',
            relayPreservesCompressedBytes: true,
            protocolFixedBeforeMeasurements: true,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
      const result = await performanceAudit({
        origin: localOrigin,
        targets,
        settings,
        plan,
        directory,
      });
      assert.equal(
        createHash('sha256')
          .update(await fs.readFile(new URL('./profiles.json', import.meta.url)))
          .digest('hex'),
        profileSha256,
      );
      assert([...methods].every((method) => method === 'GET' || method === 'HEAD'));
      const summary = {
        version: 1,
        kind: 'staging-laboratory-through-authenticated-read-only-relay',
        startedAt,
        completedAt: new Date().toISOString(),
        config,
        profileSha256,
        browserVersion,
        machine: {
          platform: process.platform,
          cpu: cpus()[0].model,
          logicalProcessors: cpus().length,
          memoryBytes: totalmem(),
        },
        relay: {
          browserOrigin: localOrigin,
          upstreamOrigin: stagingOrigin,
          requests: relayRequests,
          methods: [...methods],
          credentialExposedToBrowser: false,
          compressedUpstreamBytesPreserved: true,
        },
        performance: result,
        analytics: { loadScript: null, googleRequestsForwarded: 0 },
        fieldInp: 'unavailable-no-public-production-traffic',
        limitations: [
          'Browser uses loopback relay; each request traverses real staging network and TLS upstream plus local forwarding overhead.',
          'Browser-side Lighthouse throttling is applied to relay traffic, not to the shared VPS.',
          'Staging has Basic Auth, private noindex policy and disabled Analytics; production is not measured.',
          'Bind the run to independent SSH receipts for candidate digest and publication root before and after measurement.',
        ],
      };
      await fs.writeFile(
        path.join(directory, 'summary.json'),
        JSON.stringify(summary, null, 2) + '\n',
        { flag: 'wx' },
      );
      console.log(
        JSON.stringify({
          complete: true,
          measurements: result.runs,
          passingScenarios: result.scenarios.filter((row) => row.budgetPass).length,
          totalScenarios: result.scenarios.length,
          output: directory,
        }),
      );
    } finally {
      if (browser) await browser.close();
      relay.closeAllConnections();
      await new Promise((resolve) => relay.close(resolve));
    }
  }
}
