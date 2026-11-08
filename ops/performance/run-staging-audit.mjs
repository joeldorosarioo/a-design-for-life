import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import { measurementPlan, performanceAudit } from './run-local-audit.mjs';
import { createStagingRelay } from './staging-relay.mjs';

// This CLI is a read-only laboratory consumer. It cannot select a production origin.
const stagingOrigin = 'https://1tiveqtdwa1kxsjfhtugcjdp.200.141.19.143.sslip.io';
const [configFile, outputDirectory, mode, ...extra] = process.argv.slice(2);
assert(
  configFile && outputDirectory && ['--preflight', '--run'].includes(mode) && extra.length === 0,
  'Usage: node ops/performance/run-staging-audit.mjs <config.json> <new-output-directory> --preflight|--run',
);
assert.equal(process.versions.node, '24.22.2');
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
await fs.access('docs/verification/E4.2-performance-protocol.md');
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
      config,
      origin: localOrigin,
      targets,
      settings,
      plan: measurementPlan(settings, targets),
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
      kind: 'stage4-staging-laboratory-through-authenticated-read-only-relay',
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
