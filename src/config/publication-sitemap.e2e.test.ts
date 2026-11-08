import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../testing/fixtures/public-portfolio';
import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';
import { observedRequest } from '../../testing/fixtures/editorial-lifecycle';
import { startOwnedNextServer } from '../../testing/setup/owned-next-server';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { readPublicRoot, withPublicRootWriter } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { portfolioPublicationCoordinator } from './publication';
import { readServerEnv } from './server-env';

const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const linkNamespace = 'http://www.w3.org/1999/xhtml';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('serves the indexable sitemap from the selected generation and defers acknowledgement if its XML is stale', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  const owned = inspectOwnedTestDatabase();
  const env = readServerEnv(process.env);
  const sourceDirectory = publicRootDirectory(env);
  const fixture = await createPublicPortfolioFixture('e3-indexable-publication-sitemap', {
    serialRunner: info.config.workers === 1 && !info.config.fullyParallel,
  });
  let reader: Awaited<ReturnType<typeof startOwnedNextServer>> | undefined;
  let staleRelay: ReturnType<typeof createServer> | undefined;
  let indexDirectory: string | undefined;
  const phases: Record<string, unknown>[] = [];
  const evidence: Record<string, unknown> = {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    phases,
  };

  async function editCase(
    contentId: string,
    data: { slug?: string; _status: 'published' | 'draft' },
  ) {
    const req = await observedRequest('case-content', contentId, await fixture.request());
    const token = req.headers.get('x-editorial-lease');
    try {
      const saved = await fixture.payload.update({
        collection: 'case-content',
        id: contentId,
        data,
        draft: false,
        depth: 0,
        req,
        overrideAccess: false,
      });
      await confirmTestPublication(saved, await fixture.request());
    } finally {
      if (token)
        await releaseEditorialLease('case-content', contentId, token, await fixture.request());
    }
  }

  try {
    reader = await startOwnedNextServer({ env: process.env, indexableSitemap: true });
    const { origin, siteOrigin, buildId } = reader;
    evidence.reader = { origin, siteOrigin, buildId };
    const directory = publicRootDirectory({
      ...env,
      APP_ENV: 'production',
      SITE_ORIGIN: siteOrigin,
    });
    // Reserve this run's unique namespace, refusing any previous owner's directory.
    await mkdir(directory, { mode: 0o700 });
    indexDirectory = directory;

    async function probe(phase: string, generation: string) {
      const response = await fetch(`${origin}/sitemap.xml`, {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
      const xml = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get(publicGenerationHeader)).toBe(generation);
      expect(response.headers.get('content-type')).toContain('application/xml');
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('set-cookie')).toBeNull();
      const entries = await page.evaluate(
        ({ xml, sitemapNamespace, linkNamespace }) => {
          const document = new DOMParser().parseFromString(xml, 'application/xml');
          if (
            document.querySelector('parsererror') ||
            document.documentElement.namespaceURI !== sitemapNamespace
          )
            throw new Error('Malformed sitemap XML.');
          return Array.from(document.getElementsByTagNameNS(sitemapNamespace, 'url'), (url) => ({
            url: url.getElementsByTagNameNS(sitemapNamespace, 'loc')[0]!.textContent,
            alternates: Array.from(url.getElementsByTagNameNS(linkNamespace, 'link'), (link) => [
              link.getAttribute('hreflang'),
              link.getAttribute('href'),
            ]),
          }));
        },
        { xml, sitemapNamespace, linkNamespace },
      );
      expect(entries.every((item) => item.url?.startsWith(`${siteOrigin}/`))).toBe(true);
      expect(new Set(entries.map((item) => item.url)).size).toBe(entries.length);
      phases.push({
        phase,
        generation,
        count: entries.length,
        sha256: createHash('sha256').update(xml).digest('hex'),
      });
      return { xml, entries };
    }
    async function mirror(phase: string) {
      const root = (await readPublicRoot(sourceDirectory))!;
      await withPublicRootWriter(directory, (_previous, commit) => commit(root));
      return probe(phase, root.generation);
    }
    const find = (entries: Awaited<ReturnType<typeof probe>>['entries'], path: string) =>
      entries.find((entry) => entry.url === siteOrigin + path);
    const pt = fixture.cases.first.locales.pt;
    const en = fixture.cases.first.locales.en;
    const ptOnly = fixture.cases.ptOnly.locales;
    const translated = (ptPath: string, enPath: string) => [
      ['pt', siteOrigin + ptPath],
      ['en', siteOrigin + enPath],
    ];

    const unavailable = await fetch(`${origin}/sitemap.xml`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('retry-after')).toBe('60');
    expect(await unavailable.text()).toBe('');
    const robots = await (
      await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5_000) })
    ).text();
    expect(robots).toContain(`Sitemap: ${siteOrigin}/sitemap.xml`);
    const testSitemap = await request.get('/sitemap.xml');
    expect(testSitemap.status()).toBe(200);
    expect(await testSitemap.text()).not.toContain('<loc>');

    const published = await mirror('published');
    for (const [ptPage, enPage] of [
      ['/pt', '/en'],
      ['/pt/cases', '/en/cases'],
      ['/pt/sobre', '/en/about'],
    ]) {
      for (const path of [ptPage!, enPage!])
        expect(find(published.entries, path)?.alternates).toEqual(translated(ptPage!, enPage!));
    }
    expect(find(published.entries, pt.path)?.alternates).toEqual(translated(pt.path, en.path));
    expect(find(published.entries, en.path)?.alternates).toEqual(translated(pt.path, en.path));
    expect(find(published.entries, ptOnly.pt.path)?.alternates).toEqual([
      ['pt', siteOrigin + ptOnly.pt.path],
    ]);
    expect(published.xml).not.toContain(ptOnly.en.path);

    const newSlug = `${pt.slug}-renamed`;
    const renamedPath = `/pt/cases/${newSlug}`;
    await editCase(pt.contentId, { slug: newSlug, _status: 'published' });
    const renamed = await mirror('renamed');
    expect(renamed.xml).not.toContain(`<loc>${siteOrigin}${pt.path}</loc>`);
    expect(renamed.xml).not.toContain(`href="${siteOrigin}${pt.path}"`);
    expect(find(renamed.entries, en.path)?.alternates).toEqual(translated(renamedPath, en.path));

    await editCase(en.contentId, { _status: 'draft' });
    const withdrawn = await mirror('withdrawn');
    expect(withdrawn.xml).not.toContain(en.path);
    expect(find(withdrawn.entries, renamedPath)?.alternates).toEqual([
      ['pt', siteOrigin + renamedPath],
    ]);

    // Observe a real persisted order intention against the same local reader.
    // The relay changes only the sitemap body, retaining the fresh generation.
    const saved = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic sitemap acknowledgement intention' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(saved.latestPublicationIntent).toBeTruthy();
    const observations: string[] = [];
    staleRelay = createServer(async (incoming, outgoing) => {
      if (
        incoming.method !== 'GET' ||
        !incoming.url ||
        incoming.headers.cookie ||
        incoming.headers.authorization
      ) {
        outgoing.writeHead(400).end();
        return;
      }
      try {
        const response = await fetch(origin + incoming.url, {
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'manual',
          signal: AbortSignal.timeout(4_500),
        });
        const headers = new Headers();
        for (const name of [publicGenerationHeader, 'content-type', 'location']) {
          const value = response.headers.get(name);
          if (value) headers.set(name, value);
        }
        const fresh = Buffer.from(await response.arrayBuffer());
        observations.push(incoming.url);
        outgoing.writeHead(response.status, Object.fromEntries(headers));
        outgoing.end(incoming.url === '/sitemap.xml' ? renamed.xml : fresh);
      } catch {
        if (outgoing.headersSent) outgoing.destroy();
        else outgoing.writeHead(502).end();
      }
    });
    const listening = once(staleRelay, 'listening');
    staleRelay.listen({ host: '127.0.0.1', port: 0, exclusive: true });
    await listening;
    const address = staleRelay.address();
    if (!address || typeof address === 'string') throw new Error('Missing owned relay address.');
    const stale = portfolioPublicationCoordinator(directory, {
      internalOrigin: `http://127.0.0.1:${address.port}`,
      siteOrigin,
      indexable: true,
    });
    const operationId = saved.latestPublicationIntent!;
    const pending = await stale.retry(operationId, await fixture.request());
    expect(observations.at(-1)).toBe('/sitemap.xml');
    expect(pending).toMatchObject({ operationId, state: 'update-pending' });
    const selected = (await readPublicRoot(directory))!;
    await probe('stale-xml-rejected', selected.generation);
    const current = portfolioPublicationCoordinator(directory, {
      internalOrigin: origin,
      siteOrigin,
      indexable: true,
    });
    const acknowledged = await current.retry(operationId, await fixture.request());
    expect(acknowledged).toMatchObject({ operationId, state: 'public' });
    expect((await readPublicRoot(directory))?.generation).toBe(selected.generation);
    phases.push({
      phase: 'same-generation-acknowledged',
      generation: selected.generation,
      pending,
      acknowledged,
      observations,
    });
  } finally {
    try {
      if (staleRelay?.listening) {
        const closed = once(staleRelay, 'close');
        staleRelay.close();
        staleRelay.closeAllConnections();
        await closed;
      }
      await reader?.stop();
    } finally {
      try {
        if (indexDirectory) await rm(indexDirectory, { recursive: true });
        await fixture.destroy();
      } finally {
        await info.attach('E3-publication-indexable-sitemap.json', {
          body: JSON.stringify(evidence),
          contentType: 'application/json',
        });
      }
    }
  }
});
