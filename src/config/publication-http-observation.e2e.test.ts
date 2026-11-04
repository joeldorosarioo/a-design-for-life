import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  createServer,
  request as relayRequest,
  type IncomingMessage,
  type Server,
} from 'node:http';
import { pipeline } from 'node:stream/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  navigationFixture,
  observedRequest,
  profilePublicationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { startOwnedNextServer } from '../../testing/setup/owned-next-server';
import { ensureProfileDrafts } from '@/features/professional-profile/server';
import { ensureNavigationDrafts } from '@/features/site-navigation/server';
import type { PublicationUpdate } from '@/payload-types';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { readPublicationRetry } from '@/helpers/payload/publication-retries';
import { readServerEnv } from './server-env';

type RelayedRead = {
  method?: string;
  pathname?: string;
  range?: string;
  generation?: string;
  upstreamStatus?: number;
  injected?: boolean;
};

function staleOptimizerObserver(input: {
  primaryOrigin: string;
  allowedPaths: ReadonlySet<string>;
  optimizer: string;
  stale: { bytes: Buffer; type: string };
  reads: RelayedRead[];
}) {
  if (!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9]\d{0,4}$/.test(input.primaryOrigin))
    throw new Error('Expected the owned primary Next origin.');
  return createServer(async (incoming, outgoing) => {
    const { method, url: pathname, headers } = incoming;
    if (
      !pathname ||
      !input.allowedPaths.has(pathname) ||
      (method !== 'GET' && method !== 'HEAD') ||
      headers.cookie !== undefined ||
      headers.authorization !== undefined ||
      headers['x-portfolio-image-authorization'] !== undefined ||
      (headers.accept !== undefined && headers.accept !== 'image/webp') ||
      (headers.range !== undefined && headers.range !== 'bytes=0-15')
    ) {
      outgoing.writeHead(400).end();
      return;
    }
    try {
      // The primary has its own self-origin. Never target the publisher child
      // or this listener, and never forward Next's signed inner header.
      const upstream = await new Promise<IncomingMessage>((resolve, reject) => {
        const upstreamRequest = relayRequest(
          `${input.primaryOrigin}${pathname}`,
          {
            agent: false,
            method,
            signal: AbortSignal.timeout(4_500),
            headers: {
              'Cache-Control': 'no-cache',
              ...(headers.accept && { Accept: headers.accept }),
              ...(headers.range && { Range: headers.range }),
            },
          },
          resolve,
        );
        upstreamRequest.on('error', reject);
        upstreamRequest.end();
      });
      const marker = upstream.headers[publicGenerationHeader];
      const read: RelayedRead = {
        method,
        pathname,
        range: headers.range,
        generation: typeof marker === 'string' ? marker : undefined,
        upstreamStatus: upstream.statusCode,
      };
      input.reads.push(read);
      if (pathname === input.optimizer && method === 'GET' && !headers.range) {
        for await (const chunk of upstream as AsyncIterable<Buffer>) {
          if (chunk.byteLength) throw new Error('Primary optimizer exposed unexpected bytes.');
        }
        if (upstream.statusCode !== 404 || !upstream.complete || !read.generation)
          throw new Error('The actual optimizer did not prove an empty captured denial.');
        read.injected = true;
        outgoing.writeHead(200, {
          [publicGenerationHeader]: read.generation,
          'Cache-Control': 'private, no-store',
          'Content-Type': input.stale.type,
          'Content-Length': String(input.stale.bytes.byteLength),
        });
        outgoing.end(input.stale.bytes);
        return;
      }
      for (const name of [
        publicGenerationHeader,
        'cache-control',
        'content-length',
        'content-range',
        'content-type',
        'location',
        'x-robots-tag',
      ]) {
        const value = upstream.headers[name];
        if (value !== undefined) outgoing.setHeader(name, value);
      }
      outgoing.writeHead(upstream.statusCode ?? 502);
      await pipeline(upstream, outgoing);
    } catch {
      if (outgoing.headersSent) outgoing.destroy();
      else outgoing.writeHead(502).end();
    }
  });
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

type Subject = 'cases' | 'case-content' | 'professional-profiles' | 'site-navigation';
type Saved = {
  id: string;
  latestPublicationIntent?: string | null;
  editorialRevision?: string | null;
};

test('confirms an HTTP-observed generation and retries the same durable root after an observer 503', async ({
  playwright,
}, info) => {
  test.setTimeout(120_000);
  if (info.config.workers !== 1 || info.config.fullyParallel)
    throw new Error('Publication observation fixtures require the owned serial test runner.');
  const owned = inspectOwnedTestDatabase();
  const env = readServerEnv(process.env);
  expect(env.PUBLICATION_HTTP_VERIFICATION_ENABLED).toBe('false');
  expect(env.PUBLICATION_RETRY_WORKER_ENABLED).toBe('false');
  const directory = publicRootDirectory(env);
  const fixture = await createEditorialPayloadFixture('e3-real-publication-observer');
  const childEnv = { ...process.env, PUBLICATION_HTTP_VERIFICATION_ENABLED: 'true' };
  let server: Awaited<ReturnType<typeof startOwnedNextServer>> | undefined;
  let editor: APIRequestContext | undefined;
  let failingObserver: Server | undefined;
  const observations: Record<string, unknown>[] = [];
  const evidence = {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    node: process.versions.node,
    builds: [] as string[],
    origins: [] as string[],
    observations,
  };

  async function start(publicationObserverListener?: Server) {
    server = await startOwnedNextServer({ env: childEnv, publicationObserverListener });
    evidence.builds.push(server.buildId);
    evidence.origins.push(server.origin);
    editor = await playwright.request.newContext({
      baseURL: server.origin,
      extraHTTPHeaders: { Origin: env.SITE_ORIGIN },
      timeout: 20_000,
    });
    const login = await editor.post('/api/users/login', {
      data: { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    });
    expect(login.ok()).toBe(true);
  }

  async function stopChild() {
    try {
      await editor?.dispose();
    } finally {
      editor = undefined;
      await server?.stop();
      server = undefined;
    }
  }

  async function stopObserver() {
    const listener = failingObserver;
    if (!listener?.listening) return;
    await new Promise<void>((resolve, reject) => {
      listener.close((error) => (error ? reject(error) : resolve()));
      listener.closeAllConnections();
    });
    failingObserver = undefined;
  }

  async function requestReceipt(collection: Subject, saved: Saved) {
    const operationId = saved.latestPublicationIntent;
    expect(operationId).toBeTruthy();
    const response = await editor!.post(`/api/${collection}/${saved.id}/publication-retry`, {
      data: { operationId },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    const receipt = await response.json();
    observations.push({
      collection,
      operationId,
      receipt: receipt.value,
      editorialStatus: response.status(),
    });
    return receipt;
  }

  async function acknowledge(collection: Subject, saved: Saved) {
    const operationId = saved.latestPublicationIntent;
    expect(await requestReceipt(collection, saved)).toEqual({
      ok: true,
      value: { operationId, targetRevision: saved.editorialRevision, state: 'public' },
    });
    const root = await readPublicRoot(directory);
    expect(root?.subjects[`${collection}/${saved.id}`]).toMatchObject({
      operationId,
      targetRevision: saved.editorialRevision,
    });
    expect(await outbox(operationId!)).toMatchObject({
      state: 'public',
      targetRevision: saved.editorialRevision,
    });
    return root!;
  }

  function outbox(operationId: string) {
    return fixture.payload.db.findOne<PublicationUpdate>({
      collection: 'publication-updates',
      where: { operationId: { equals: operationId } },
    });
  }

  async function anonymous(pathname: string, status: number, generation: string) {
    const response = await fetch(`${server!.origin}${pathname}`, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.text();
    observations.push({
      pathname,
      status: response.status,
      generation: response.headers.get(publicGenerationHeader),
      bytes: Buffer.byteLength(body),
      location: response.headers.get('location'),
    });
    expect(response.status).toBe(status);
    expect(response.headers.get(publicGenerationHeader)).toBe(generation);
    return { body, response };
  }

  try {
    await clearStructuralFixture(fixture.payload);
    const baseline = await readPublicRoot(directory);
    await start();
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: {
        internalTitle: 'Synthetic isolated HTTP observation order',
        sortOrder: 2,
        featured: true,
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const orderRoot = await acknowledge('cases', parent);
    for (const locale of ['pt', 'en']) {
      const aggregate = await anonymous(
        `/api/case-content/published/${locale}`,
        200,
        orderRoot.generation,
      );
      expect(aggregate.body.includes(parent.id)).toBe(false);
      if (!baseline)
        expect(JSON.parse(aggregate.body)).toEqual({
          ok: true,
          value: { cards: [], featured: [] },
        });
    }

    const profileImage = await mediaMetadataFixture(fixture.payload);
    const profilePdf = await mediaMetadataFixture(fixture.payload, 'pdf');
    await ensureProfileDrafts(await fixture.request());
    await ensureNavigationDrafts(await fixture.request());
    const profiles = await fixture.payload.find({
      collection: 'professional-profiles',
      where: { locale: { equals: 'pt' } },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const profile = await fixture.payload.update({
      collection: 'professional-profiles',
      id: profiles.docs[0]!.id,
      data: { ...profilePublicationFixture(profileImage.id, profilePdf.id), _status: 'published' },
      draft: false,
      req: await observedRequest(
        'professional-profiles',
        profiles.docs[0]!.id,
        await fixture.request(),
      ),
      overrideAccess: false,
    });
    const profileRoot = await acknowledge('professional-profiles', profile);
    await anonymous('/api/professional-profiles/published/pt', 200, profileRoot.generation);
    const navs = await fixture.payload.find({
      collection: 'site-navigation',
      where: { locale: { equals: 'pt' } },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const nav = await fixture.payload.update({
      collection: 'site-navigation',
      id: navs.docs[0]!.id,
      data: { ...navigationFixture(), _status: 'published' },
      draft: false,
      req: await observedRequest('site-navigation', navs.docs[0]!.id, await fixture.request()),
      overrideAccess: false,
    });
    const navRoot = await acknowledge('site-navigation', nav);
    await anonymous('/api/site-navigation/published/pt', 200, navRoot.generation);

    const caseImage = await mediaMetadataFixture(fixture.payload);
    const firstSlug = `observer-first-${randomUUID().slice(0, 8)}`;
    const first = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(caseImage.id),
        case: parent.id,
        locale: 'pt',
        title: 'Synthetic first observed case',
        slug: firstSlug,
        _status: 'published',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const firstRoot = await acknowledge('case-content', first);
    expect(
      (await anonymous(`/pt/cases/${firstSlug}`, 200, firstRoot.generation)).body.includes(
        'Synthetic first observed case',
      ),
    ).toBe(true);

    const nextSlug = `observer-retry-${randomUUID().slice(0, 8)}`;
    const next = await fixture.payload.update({
      collection: 'case-content',
      id: first.id,
      data: { title: 'Synthetic retried observed case', slug: nextSlug, _status: 'published' },
      draft: false,
      req: await observedRequest('case-content', first.id, await fixture.request()),
      overrideAccess: false,
    });
    const operationId = next.latestPublicationIntent!;
    const internalOrigin = server!.origin;
    await stopChild();
    const rejectedReads: Record<string, unknown>[] = [];
    failingObserver = createServer((request, response) => {
      rejectedReads.push({
        method: request.method,
        pathname: request.url,
        cookie: request.headers.cookie !== undefined,
        authorization: request.headers.authorization !== undefined,
      });
      response.writeHead(503, { 'Cache-Control': 'no-store' });
      response.end();
    });
    failingObserver.listen({ host: '127.0.0.1', port: 0, exclusive: true });
    await once(failingObserver, 'listening');
    await start(failingObserver);
    const failed = await requestReceipt('case-content', next);
    observations.push({ phase: 'selected-observer-503', requests: rejectedReads });
    expect(rejectedReads).toEqual([
      {
        method: 'GET',
        pathname: '/api/case-content/published/pt',
        cookie: false,
        authorization: false,
      },
    ]);
    expect(failed).toEqual({
      ok: true,
      value: { operationId, targetRevision: next.editorialRevision, state: 'update-pending' },
    });
    const pendingRoot = await readPublicRoot(directory);
    expect(pendingRoot?.generation).not.toBe(firstRoot.generation);
    expect(pendingRoot?.subjects[`case-content/${next.id}`]).toMatchObject({
      operationId,
      targetRevision: next.editorialRevision,
    });
    expect(await outbox(operationId)).toMatchObject({
      state: 'update-pending',
      targetRevision: next.editorialRevision,
    });
    const pending = await readPublicationRetry(operationId, await fixture.request());
    expect(pending).toMatchObject({ startedAttemptsVersion: 1, retryUserId: fixture.user.id });
    expect(pending?.nextAttemptAt).toBeTruthy();
    observations.push({
      phase: 'promoted-but-pending',
      generation: pendingRoot!.generation,
      startedVersion: pending!.startedAttemptsVersion,
    });

    await stopChild();
    await stopObserver();
    await start();
    expect(server!.origin).toBe(internalOrigin);
    expect(evidence.builds).toEqual(Array(3).fill(evidence.builds[0]));
    const persisted = await editor!.get(`/api/case-content/${next.id}/publication-status`);
    expect(persisted.status()).toBe(200);
    expect(await persisted.json()).toEqual({ receipt: failed.value });
    const retriedRoot = await acknowledge('case-content', next);
    expect(retriedRoot).toEqual(pendingRoot);
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      startedAttemptsVersion: 2,
      nextAttemptAt: null,
    });
    const historic = await anonymous(`/pt/cases/${firstSlug}`, 308, retriedRoot.generation);
    const location = historic.response.headers.get('location');
    expect(location).toBe(new URL(`/pt/cases/${nextSlug}`, env.SITE_ORIGIN).href);
    expect(historic.body === '' || historic.body === location).toBe(true);
    expect(
      (await anonymous(`/pt/cases/${nextSlug}`, 200, retriedRoot.generation)).body.includes(
        'Synthetic retried observed case',
      ),
    ).toBe(true);

    {
      const sharedSlug = `observer-shared-${randomUUID().slice(0, 8)}`;
      const shared = await fixture.payload.create({
        collection: 'case-content',
        data: {
          ...casePublicationFixture(caseImage.id),
          case: parent.id,
          locale: 'en',
          title: 'Synthetic shared observed case',
          slug: sharedSlug,
          _status: 'published',
        },
        req: await fixture.request(),
        overrideAccess: false,
      });
      const sharedRoot = await acknowledge('case-content', shared);
      const original = `/media/${caseImage.id}/original`;
      const derivative = `/media/${caseImage.id}/w16`;
      const optimizer = `/_next/image?url=${encodeURIComponent(original)}&w=64&q=75`;
      const paths = [original, derivative, optimizer];
      const primaryOrigin = env.INTERNAL_HTTP_ORIGIN!;
      expect(new URL(primaryOrigin).port).toBe(new URL(env.SITE_ORIGIN).port);
      expect(primaryOrigin).not.toBe(server!.origin);

      async function mediaProbe(
        origin: string,
        pathname: string,
        generation: string,
        expected: number,
        phase: string,
        mode: 'get' | 'head' | 'range' = 'get',
      ) {
        const response = await fetch(`${origin}${pathname}`, {
          method: mode === 'head' ? 'HEAD' : 'GET',
          headers: {
            Accept: 'image/webp',
            ...(mode === 'range' && { Range: 'bytes=0-15' }),
          },
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'manual',
          signal: AbortSignal.timeout(8_000),
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        const hash = createHash('sha256').update(bytes).digest('hex');
        observations.push({
          phase,
          pathname,
          mode,
          status: response.status,
          generation,
          bytes: bytes.byteLength,
          sha256: hash,
          optimizerCache: response.headers.get('x-nextjs-cache'),
        });
        expect(response.status).toBe(expected);
        expect(response.headers.get(publicGenerationHeader)).toBe(generation);
        expect(response.headers.get('cache-control')).toContain('no-store');
        if (expected === 404) {
          expect(bytes).toHaveLength(0);
          expect(response.headers.has('content-range')).toBe(false);
        } else {
          expect(bytes.byteLength).toBeGreaterThan(0);
          expect(response.headers.get('content-type')).toMatch(/^image\//);
        }
        return { response, bytes, hash };
      }

      const warm = new Map<string, Awaited<ReturnType<typeof mediaProbe>>>();
      for (const pathname of paths)
        warm.set(
          pathname,
          await mediaProbe(primaryOrigin, pathname, sharedRoot.generation, 200, 'warm'),
        );
      const hit = await mediaProbe(
        primaryOrigin,
        optimizer,
        sharedRoot.generation,
        200,
        'warm-hit',
      );
      expect(hit.response.headers.get('x-nextjs-cache')).toBe('HIT');
      expect(hit.hash).toBe(warm.get(optimizer)!.hash);

      async function withdraw(saved: Saved) {
        return fixture.payload.update({
          collection: 'case-content',
          id: saved.id,
          data: { _status: 'draft' },
          draft: false,
          req: await observedRequest('case-content', saved.id, await fixture.request()),
          overrideAccess: false,
        });
      }

      const stillShared = await acknowledge('case-content', await withdraw(shared));
      await anonymous(`/en/cases/${sharedSlug}`, 410, stillShared.generation);
      for (const pathname of paths) {
        const probe = await mediaProbe(
          server!.origin,
          pathname,
          stillShared.generation,
          200,
          'shared',
        );
        expect(probe.hash).toBe(warm.get(pathname)!.hash);
      }

      const withdrawn = await withdraw(next);
      const withdrawalOperation = withdrawn.latestPublicationIntent!;
      await stopChild();
      const reads: RelayedRead[] = [];
      failingObserver = staleOptimizerObserver({
        primaryOrigin,
        allowedPaths: new Set([
          '/api/case-content/published/pt',
          '/pt',
          '/pt/cases',
          '/pt/sobre',
          '/en',
          '/en/cases',
          '/en/about',
          `/pt/cases/${firstSlug}`,
          `/pt/cases/${nextSlug}`,
          `/en/cases/${sharedSlug}`,
          ...paths,
        ]),
        optimizer,
        stale: { bytes: hit.bytes, type: hit.response.headers.get('content-type')! },
        reads,
      });
      const listening = once(failingObserver, 'listening');
      failingObserver.listen({ host: '127.0.0.1', port: 0, exclusive: true });
      await listening;
      await start(failingObserver);
      const failedMedia = await requestReceipt('case-content', withdrawn);
      observations.push({
        phase: 'optimizer-cache-leak-before-ack',
        reads,
        injectedHash: hit.hash,
      });
      const pendingMediaRoot = await readPublicRoot(directory);
      expect(failedMedia).toEqual({
        ok: true,
        value: {
          operationId: withdrawalOperation,
          targetRevision: withdrawn.editorialRevision,
          state: 'update-pending',
        },
      });
      expect(pendingMediaRoot?.generation).not.toBe(stillShared.generation);
      expect(pendingMediaRoot?.subjects[`case-content/${withdrawn.id}`]).toMatchObject({
        operationId: withdrawalOperation,
        targetRevision: withdrawn.editorialRevision,
      });
      expect(await outbox(withdrawalOperation)).toMatchObject({ state: 'update-pending' });
      expect(reads.at(-1)).toMatchObject({
        method: 'GET',
        pathname: optimizer,
        upstreamStatus: 404,
        injected: true,
        generation: pendingMediaRoot!.generation,
      });
      expect(
        reads.some(
          ({ pathname, upstreamStatus }) =>
            pathname === `/pt/cases/${nextSlug}` && upstreamStatus === 410,
        ),
      ).toBe(true);
      for (const pathname of [original, derivative]) {
        expect(
          reads
            .filter((read) => read.pathname === pathname)
            .map((read) => [read.method, read.range, read.upstreamStatus]),
        ).toEqual([
          ['GET', undefined, 404],
          ['HEAD', undefined, 404],
          ['GET', 'bytes=0-15', 404],
        ]);
      }
      expect(
        await readPublicationRetry(withdrawalOperation, await fixture.request()),
      ).toMatchObject({
        startedAttemptsVersion: 1,
        retryUserId: fixture.user.id,
      });

      await stopChild();
      await stopObserver();
      await start();
      expect(new Set(evidence.builds).size).toBe(1);
      const persistedMedia = await editor!.get(
        `/api/case-content/${withdrawn.id}/publication-status`,
      );
      expect(persistedMedia.status()).toBe(200);
      expect(await persistedMedia.json()).toEqual({ receipt: failedMedia.value });
      const withdrawnRoot = await acknowledge('case-content', withdrawn);
      expect(withdrawnRoot).toEqual(pendingMediaRoot);
      expect(
        await readPublicationRetry(withdrawalOperation, await fixture.request()),
      ).toMatchObject({
        startedAttemptsVersion: 2,
        nextAttemptAt: null,
      });
      for (const pathname of paths)
        for (const mode of ['get', 'head', 'range'] as const)
          await mediaProbe(
            server!.origin,
            pathname,
            withdrawnRoot.generation,
            404,
            'same-root-denial',
            mode,
          );

      for (const slug of [firstSlug, nextSlug]) {
        const gone = await anonymous(`/pt/cases/${slug}`, 410, withdrawnRoot.generation);
        expect(gone.response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        expect(gone.body.includes('Synthetic retried observed case')).toBe(false);
      }
    }
  } finally {
    try {
      await stopChild();
    } finally {
      try {
        await stopObserver();
      } finally {
        try {
          await fixture.payload.destroy();
        } finally {
          await info.attach('E3-real-publication-observation.json', {
            body: JSON.stringify(evidence),
            contentType: 'application/json',
          });
        }
      }
    }
  }
});
