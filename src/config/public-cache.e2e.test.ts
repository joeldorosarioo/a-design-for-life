import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
} from '@playwright/test';
import { createPublicPortfolioFixture } from '../../testing/fixtures/public-portfolio';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';
import {
  inspectOwnedTestDatabase,
  setOwnedTestDatabaseNetwork,
} from '../../testing/setup/owned-test-database';
import { startOwnedNextServer } from '../../testing/setup/owned-next-server';
import { readPublicRoot } from '../helpers/payload/public-root';
import { publicRootDirectory } from '../helpers/payload/public-root-directory';
import { readServerEnv } from './server-env';

type Portfolio = Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
type OwnedNext = Awaited<ReturnType<typeof startOwnedNextServer>>;
type Phase = 'warm' | 'origin-outage' | 'cold-restart' | 'recovered' | 'revoked-outage';
type PublicResponse = Pick<APIResponse, 'status' | 'headers' | 'body'>;
type PageSnapshot = {
  heading: string;
  title: string;
  canonical: string | null;
  alternates: { locale: string | null; href: string | null }[];
  cards: string[];
};

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// This is a production-Next contract proof, not a replacement cache strategy.
// Real execution is coordinated separately because it disconnects the acquired DB.
test('serves confirmed PT/EN data and shared media across full origin outage and same-build Next restart, then denies cached bytes after final revocation', async ({
  browser,
  playwright,
}, info) => {
  test.setTimeout(300_000);
  let portfolio: Portfolio | undefined;
  let server: OwnedNext | undefined;
  let context: BrowserContext | undefined;
  let api: APIRequestContext | undefined;
  let interruptionAttempted = false;
  let primaryError: unknown;
  const evidence: Record<string, unknown>[] = [];
  const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

  async function observe(phase: Phase, url: string, response: PublicResponse) {
    const bytes = await response.body();
    const headers = response.headers();
    evidence.push({
      phase,
      path: url,
      status: response.status(),
      bytes: bytes.length,
      sha256: hash(bytes),
      cacheControl: headers['cache-control'],
      robots: headers['x-robots-tag'],
      retryAfter: headers['retry-after'],
      optimizerCache: headers['x-nextjs-cache'],
    });
    return bytes;
  }

  function interruptOrigin() {
    const owned = inspectOwnedTestDatabase();
    // Set before the command: even a failed post-disconnect check needs recovery.
    interruptionAttempted = true;
    setOwnedTestDatabaseNetwork('disconnect');
    inspectOwnedTestDatabase(false);
    evidence.push({
      event: 'owned-origin-disconnected',
      containerId: owned.containerId,
      networkId: owned.networkId,
    });
  }

  function restoreOrigin() {
    const owned = inspectOwnedTestDatabase('cleanup');
    if (!Object.hasOwn(owned.network.Containers, owned.containerId))
      setOwnedTestDatabaseNetwork('connect');
    inspectOwnedTestDatabase();
    interruptionAttempted = false;
    evidence.push({ event: 'same-owned-origin-reconnected' });
  }

  try {
    const env = readServerEnv(process.env);
    const owned = inspectOwnedTestDatabase();
    const serialRunner = info.config.workers === 1 && !info.config.fullyParallel;
    portfolio = await createPublicPortfolioFixture('e3-production-cache-proof', { serialRunner });
    const fixture = portfolio;
    const directory = publicRootDirectory(env);
    const sharedMedia = await mediaMetadataFixture(fixture.payload);
    const privateMedia = await mediaMetadataFixture(fixture.payload);
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic E3 shared image owner', sortOrder: 50, featured: false },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(parent, await fixture.request());
    const sharedContents: { id: string; path: string; locale: 'pt' | 'en' }[] = [];
    for (const locale of ['pt', 'en'] as const) {
      const slug = `e3-shared-${locale}-${randomUUID()}`;
      const saved = await fixture.payload.create({
        collection: 'case-content',
        data: {
          ...casePublicationFixture(sharedMedia.id),
          title: `Synthetic ${locale} E3 shared image`,
          case: parent.id,
          locale,
          slug,
          _status: 'published',
        },
        req: await fixture.request(),
        overrideAccess: false,
      });
      const receipt = await confirmTestPublication(saved, await fixture.request());
      evidence.push({ event: 'shared-owner-confirmed', locale, ...receipt });
      sharedContents.push({ id: saved.id, path: `/${locale}/cases/${slug}`, locale });
    }
    const privateDraftTitle = `PRIVATE unpublished revision ${randomUUID()}`;
    const drafted = fixture.cases.first.locales.pt;
    await fixture.payload.update({
      collection: 'case-content',
      id: drafted.contentId,
      data: { title: privateDraftTitle },
      draft: true,
      req: await observedRequest('case-content', drafted.contentId, await fixture.request()),
      overrideAccess: false,
    });

    // The existing global setup builds once. This helper starts only a secondary
    // child from that completed run/dist, keeping the canonical namespace intact.
    server = await startOwnedNextServer({ env: process.env });
    const next = server;
    api = await playwright.request.newContext({ baseURL: next.origin, timeout: 20_000 });
    const http = api;
    context = await browser.newContext({
      baseURL: next.origin,
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    // No resource request in this proof may reach an external service.
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === next.origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const sources = [
      'src/config/public-cache.e2e.test.ts',
      'testing/setup/owned-next-server.ts',
      'src/helpers/payload/public-root.ts',
      'src/helpers/payload/render-snapshot.ts',
      'src/config/public-render-context.ts',
      'src/config/public-page-request.ts',
      'src/proxy.ts',
      'next.config.ts',
    ];
    const installedVersions = {
      next: JSON.parse(await readFile('node_modules/next/package.json', 'utf8')).version as string,
      payload: JSON.parse(await readFile('node_modules/payload/package.json', 'utf8'))
        .version as string,
    };
    expect(installedVersions).toEqual({ next: '16.4.3', payload: '3.92.1' });
    evidence.push({
      event: 'production-process-provenance',
      node: process.versions.node,
      ...installedVersions,
      appEnvironment: env.APP_ENV,
      canonicalOrigin: env.SITE_ORIGIN,
      physicalOrigin: next.origin,
      internalHttpOrigin: next.origin,
      databasePort: new URL(env.DATABASE_URI).port,
      runId: process.env.ADFL_TEST_RUN_ID,
      containerId: owned.containerId,
      networkId: owned.networkId,
      distDirectory: next.distDirectory,
      buildId: next.buildId,
      sourceSha256: Object.fromEntries(
        await Promise.all(sources.map(async (file) => [file, hash(await readFile(file))])),
      ),
    });

    const original = `/media/${sharedMedia.id}/original`;
    const derivative = `/media/${sharedMedia.id}/w16`;
    const optimizer = `/_next/image?url=${encodeURIComponent(original)}&w=64&q=75`;
    const bytePaths = [original, derivative, optimizer];
    const byteHashes = new Map<string, string>();

    async function expectPublicBytes(phase: Phase) {
      for (const url of bytePaths) {
        const response = await http.get(url, {
          headers: { Accept: 'image/webp', 'If-None-Match': '*' },
          maxRedirects: 0,
        });
        expect(response.status(), `${phase} ${url}`).toBe(200);
        expect(response.headers()['content-type']).toContain('image/');
        expect(response.headers()['cache-control']).toContain('no-store');
        const bytes = await observe(phase, url, response);
        expect(bytes.length).toBeGreaterThan(0);
        if (byteHashes.has(url)) expect(hash(bytes)).toBe(byteHashes.get(url));
        else byteHashes.set(url, hash(bytes));
        const head = await http.head(url, { headers: { Accept: 'image/webp' }, maxRedirects: 0 });
        expect(head.status()).toBe(200);
        expect(await head.body()).toHaveLength(0);
      }
      const hit = await http.get(optimizer, { headers: { Accept: 'image/webp' } });
      expect(hit.status()).toBe(200);
      expect(hit.headers()['x-nextjs-cache']).toBe('HIT');
      expect(hash(await observe(phase, optimizer, hit))).toBe(byteHashes.get(optimizer));
    }

    async function withdraw(subject: (typeof sharedContents)[number]) {
      const saved = await fixture.payload.update({
        collection: 'case-content',
        id: subject.id,
        data: { _status: 'draft' },
        req: await observedRequest('case-content', subject.id, await fixture.request()),
        overrideAccess: false,
      });
      const receipt = await confirmTestPublication(saved, await fixture.request());
      const root = await readPublicRoot(directory);
      expect(root?.subjects[`case-content/${subject.id}`]).toMatchObject({
        operationId: receipt.operationId,
        targetRevision: receipt.targetRevision,
      });
      const response = await http.get(subject.path, { maxRedirects: 0 });
      expect(response.status()).toBe(410);
      evidence.push({
        event: 'withdrawal-root-and-http-confirmed',
        locale: subject.locale,
        ...receipt,
      });
    }

    await expectPublicBytes('warm');
    // One approved EN owner still authorizes the asset after PT withdrawal.
    await withdraw(sharedContents[0]);
    await expectPublicBytes('warm');
    const confirmed = await readPublicRoot(directory);
    expect(confirmed).not.toBeNull();
    const firstSubject = confirmed!.subjects[`case-content/${drafted.contentId}`];
    evidence.push({
      event: 'outage-baseline-confirmed-root',
      generation: confirmed!.generation,
      firstCaseOperation: firstSubject.operationId,
      firstCaseRevision: firstSubject.targetRevision,
    });

    const warmSnapshots = new Map<string, PageSnapshot>();
    async function expectKnownPages(phase: Phase) {
      for (const locale of ['pt', 'en'] as const) {
        const copy = fixture.locales[locale];
        const first = fixture.cases.first.locales[locale];
        const second = fixture.cases.second.locales[locale];
        const other = locale === 'pt' ? 'en' : 'pt';
        const entries = [
          {
            pathname: copy.homePath,
            heading: `${copy.homeTitle} ${copy.homeEmphasis}`,
            alternate: fixture.locales[other].homePath,
            cards: '[data-reading-key="home-projects"] article',
          },
          {
            pathname: copy.listingPath,
            heading: copy.listingTitle,
            alternate: fixture.locales[other].listingPath,
            cards: '[data-reading-key="cases-list"] article',
          },
          {
            pathname: first.path,
            heading: first.title,
            alternate: fixture.cases.first.locales[other].path,
            cards: null,
          },
        ];
        for (const entry of entries) {
          const response = await page.goto(entry.pathname, { waitUntil: 'domcontentloaded' });
          expect(response?.status(), `${phase} ${entry.pathname}`).toBe(200);
          const body = await observe(phase, entry.pathname, response!);
          expect(body.toString()).not.toContain(privateDraftTitle);
          expect(body.toString()).not.toContain(fixture.cases.ptOnly.locales.en.title);
          await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
            entry.heading,
          );
          await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            new URL(entry.pathname, env.SITE_ORIGIN).href,
          );
          await expect(page.locator(`link[rel="alternate"][hreflang="${other}"]`)).toHaveAttribute(
            'href',
            new URL(entry.alternate, env.SITE_ORIGIN).href,
          );
          await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
            'content',
            new URL(entry.pathname, env.SITE_ORIGIN).href,
          );
          const cards = entry.cards ? page.locator(entry.cards) : null;
          const titles = cards ? await cards.getByRole('heading').allTextContents() : [];
          if (cards) {
            expect(titles).toContain(first.title);
            expect(titles).toContain(second.title);
            expect(titles.indexOf(first.title)).toBeLessThan(titles.indexOf(second.title));
            if (entry.pathname === copy.listingPath)
              await expect(page.locator('[data-reading-key="cases-opening"]')).toContainText(
                `${titles.length} ${copy.projects}`,
              );
          }
          const snapshot: PageSnapshot = {
            heading: (await page
              .getByRole('main')
              .getByRole('heading', { level: 1 })
              .textContent())!,
            title: await page.title(),
            canonical: await page.locator('link[rel="canonical"]').getAttribute('href'),
            alternates: await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) =>
              links.map((link) => ({
                locale: link.getAttribute('hreflang'),
                href: link.getAttribute('href'),
              })),
            ),
            cards: titles,
          };
          if (phase === 'warm') warmSnapshots.set(entry.pathname, snapshot);
          else expect(snapshot).toEqual(warmSnapshots.get(entry.pathname));
          const head = await http.head(entry.pathname);
          expect(head.status()).toBe(200);
          expect(await head.body()).toHaveLength(0);
        }
      }
      expect((await readPublicRoot(directory))?.generation).toBe(confirmed!.generation);
    }

    const uncovered = `/pt/cases/no-confirmed-e3-snapshot-${randomUUID()}`;
    const privateTranslation = fixture.cases.ptOnly.locales.en.path;
    const privateOriginal = `/media/${privateMedia.id}/original`;
    async function expectUncovered(phase: Phase, status: 404 | 503) {
      for (const url of [uncovered, privateTranslation])
        for (const method of ['GET', 'HEAD'] as const) {
          const response = await http.fetch(url, { method, maxRedirects: 0 });
          expect(response.status(), `${phase} ${method} ${url}`).toBe(status);
          expect(response.headers()['cache-control']).toContain('no-store');
          expect(response.headers()['x-robots-tag']).toContain('noindex');
          if (status === 503) expect(response.headers()['retry-after']).toBe('60');
          const body = await observe(phase, url, response);
          if (method === 'HEAD') expect(body).toHaveLength(0);
          expect(body.toString()).not.toContain(privateDraftTitle);
          expect(body.toString()).not.toContain(fixture.cases.ptOnly.locales.en.title);
        }
      for (const method of ['GET', 'HEAD'] as const) {
        const response = await http.fetch(privateOriginal, { method, maxRedirects: 0 });
        expect(response.status()).toBe(status);
        expect(await observe(phase, privateOriginal, response)).toHaveLength(0);
      }
    }

    await expectKnownPages('warm');
    // No request to second EN's detail has occurred. Its confirmed data is already
    // cached in Root; URL warmth must never be confused with snapshot coverage.
    const neverVisitedConfirmed = fixture.cases.second.locales.en;
    interruptOrigin();
    await expectKnownPages('origin-outage');
    await expectPublicBytes('origin-outage');
    await expectUncovered('origin-outage', 503);
    const unvisited = await http.get(neverVisitedConfirmed.path);
    expect(unvisited.status()).toBe(200);
    expect(
      (await observe('origin-outage', neverVisitedConfirmed.path, unvisited)).toString(),
    ).toContain(neverVisitedConfirmed.title);
    const forged = await http.get(drafted.path, {
      headers: { 'x-portfolio-render-context': 'visitor-cannot-select-another-generation' },
    });
    expect(forged.status()).toBe(200);
    const forgedBody = (await observe('origin-outage', drafted.path, forged)).toString();
    expect(forgedBody).toContain(drafted.title);
    expect(forgedBody).not.toContain(privateDraftTitle);

    await next.restart();
    expect((await readFile(path.join(next.distDirectory, 'BUILD_ID'), 'utf8')).trim()).toBe(
      next.buildId,
    );
    evidence.push({
      event: 'same-build-cold-next-restarted-while-origin-offline',
      buildId: next.buildId,
    });
    await expectKnownPages('cold-restart');
    await expectPublicBytes('cold-restart');
    await expectUncovered('cold-restart', 503);
    restoreOrigin();
    await expectKnownPages('recovered');
    await expectUncovered('recovered', 404);

    // The optimized HIT bytes remain on disk. Removing the last approved owner
    // must deny every new request without deleting the byte cache to pass.
    await withdraw(sharedContents[1]);
    async function expectRevokedBytes(phase: Phase, status: 404 | 503) {
      for (const url of bytePaths)
        for (const method of ['GET', 'HEAD'] as const) {
          const response = await http.fetch(url, {
            method,
            maxRedirects: 0,
            headers: { Accept: 'image/webp', 'If-None-Match': '*', Range: 'bytes=0-10' },
          });
          expect(response.status(), `${phase} ${method} ${url}`).toBe(status);
          expect(response.headers()['cache-control']).toContain('no-store');
          expect(await observe(phase, url, response)).toHaveLength(0);
        }
    }
    await expectRevokedBytes('recovered', 404);
    interruptOrigin();
    await next.restart();
    // Missing-grant SQL classification can return503 during outage; no cache HIT,
    // 200/206/304 or bytes are permitted to turn stale bytes into authorization.
    await expectRevokedBytes('revoked-outage', 503);
    restoreOrigin();
    await expectRevokedBytes('recovered', 404);
    await expectUncovered('recovered', 404);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    if (interruptionAttempted)
      try {
        restoreOrigin();
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const close of [
      () => server?.stop(),
      () => context?.close(),
      () => api?.dispose(),
      // Never issue fixture SQL cleanup unless the exact origin is restored.
      () => (interruptionAttempted ? undefined : portfolio?.destroy()),
    ])
      try {
        await close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    await info.attach('E3-confirmed-cache-proof.json', {
      body: JSON.stringify({ evidence, cleanupFailures: cleanupErrors.length }, null, 2),
      contentType: 'application/json',
    });
    if (server)
      await info.attach('E3-owned-next-output.txt', {
        body: server.logs(),
        contentType: 'text/plain',
      });
    if (cleanupErrors.length)
      throw new AggregateError(
        primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
        'Cache proof cleanup could not fully restore its owned resources.',
      );
  }
});
