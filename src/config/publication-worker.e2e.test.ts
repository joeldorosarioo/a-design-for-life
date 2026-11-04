import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import { publicGenerationHeader } from '../helpers/payload/public-generation-header';

import { expect, test } from '@playwright/test';
import { createPublicPortfolioFixture } from '../../testing/fixtures/public-portfolio';
import { startOwnedNextServer } from '../../testing/setup/owned-next-server';
import {
  inspectOwnedTestDatabase,
  setOwnedTestDatabaseNetwork,
} from '../../testing/setup/owned-test-database';
import { readPublicationRetry } from '../helpers/payload/publication-retries';
import { readPublicRoot } from '../helpers/payload/public-root';
import { publicRootDirectory } from '../helpers/payload/public-root-directory';
import type { PublicationUpdate } from '../payload-types';
import { readServerEnv } from './server-env';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('starts the opted-in production Next worker during origin outage and drains the persisted intention after recovery', async ({
  request,
}, info) => {
  test.setTimeout(120_000);
  const owned = inspectOwnedTestDatabase();
  const env = readServerEnv(process.env);
  expect(env.PUBLICATION_RETRY_WORKER_ENABLED).toBe('false');
  expect((await request.get('/health')).status()).toBe(200);
  const directory = publicRootDirectory(env);
  const fixture = await createPublicPortfolioFixture('e3-worker-production-startup', {
    serialRunner: info.config.workers === 1 && !info.config.fullyParallel,
  });
  let server: Awaited<ReturnType<typeof startOwnedNextServer>> | undefined;
  let interrupted = false;
  const evidence: Record<string, unknown> = {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    node: process.versions.node,
  };
  function restoreOrigin() {
    const inspected = inspectOwnedTestDatabase('cleanup');
    if (!Object.hasOwn(inspected.network.Containers, inspected.containerId))
      setOwnedTestDatabaseNetwork('connect');
    inspectOwnedTestDatabase();
    interrupted = false;
  }
  try {
    const saved = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic queued worker startup intention' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const operationId = saved.latestPublicationIntent!;
    expect(await readPublicationRetry(operationId, await fixture.request())).toMatchObject({
      retryUserId: fixture.user.id,
      startedAttemptsVersion: 0,
    });
    const rootBefore = await readPublicRoot(directory);
    expect(rootBefore?.subjects[`cases/${saved.id}`]).toBeUndefined();
    interrupted = true;
    setOwnedTestDatabaseNetwork('disconnect');
    inspectOwnedTestDatabase(false);
    server = await startOwnedNextServer({
      env: { ...process.env, PUBLICATION_RETRY_WORKER_ENABLED: 'true' },
    });
    evidence.buildId = server.buildId;
    evidence.origin = server.origin;
    const known = fixture.cases.first.locales.pt;
    const fetchPath = (pathname: string) =>
      fetch(`${server!.origin}${pathname}`, {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
    const health = await fetchPath('/health');
    const confirmed = await fetchPath(known.path);
    evidence.healthDuringOutage = health.status;
    evidence.confirmedDuringOutage = confirmed.status;
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ready' });
    expect(confirmed.status).toBe(200);
    expect(await confirmed.text()).toContain(known.title);
    expect((await readPublicRoot(directory))?.generation).toBe(rootBefore?.generation);

    restoreOrigin();
    await expect
      .poll(
        async () => {
          try {
            const operation = await fixture.payload.db.findOne<PublicationUpdate>({
              collection: 'publication-updates',
              where: { operationId: { equals: operationId } },
            });
            const retry = await readPublicationRetry(operationId, await fixture.request());
            return {
              state: operation?.state,
              revision: operation?.targetRevision,
              actor: retry?.retryUserId,
              version: retry?.startedAttemptsVersion,
              automatic: retry?.automaticAttempts,
              next: retry?.nextAttemptAt,
            };
          } catch {
            return null;
          }
        },
        { timeout: 25_000 },
      )
      .toEqual({
        state: 'public',
        revision: saved.editorialRevision,
        actor: fixture.user.id,
        version: 1,
        automatic: 1,
        next: null,
      });
    const rootAfter = await readPublicRoot(directory);
    expect(rootAfter?.subjects[`cases/${saved.id}`]).toMatchObject({
      operationId,
      targetRevision: saved.editorialRevision,
    });
    evidence.startedVersion = 1;
    evidence.generationBefore = rootBefore?.generation;
    evidence.generationAfter = rootAfter?.generation;
    evidence.observedWorkerEvent = server.logs().includes('"operation":"publication.retry.worker"');
    evidence.observedNativeConnectionError = server.logs().includes('cannot connect to Postgres');
    expect(evidence.observedWorkerEvent).toBe(true);
  } finally {
    try {
      if (interrupted) restoreOrigin();
    } finally {
      try {
        await server?.stop();
      } finally {
        if (!interrupted) await fixture.destroy();
        await info.attach('E3-publication-worker-startup.json', {
          body: JSON.stringify(evidence),
          contentType: 'application/json',
        });
      }
    }
  }
});

test('automatically acknowledges the same promoted generation after the owned Next worker is killed', async ({
  request,
}, info) => {
  test.setTimeout(120_000);
  if (info.config.workers !== 1 || info.config.fullyParallel)
    throw new Error('Publication crash proof requires the owned serial test runner.');
  const owned = inspectOwnedTestDatabase();
  const env = readServerEnv(process.env);
  expect(env.PUBLICATION_RETRY_WORKER_ENABLED).toBe('false');
  expect(env.PUBLICATION_HTTP_VERIFICATION_ENABLED).toBe('false');
  const directory = publicRootDirectory(env);
  const rootFile = path.join(directory, 'current.json');
  const fixture = await createEditorialPayloadFixture('e3-worker-post-root-crash');
  const workerEnv = {
    ...process.env,
    PUBLICATION_RETRY_WORKER_ENABLED: 'true',
    PUBLICATION_HTTP_VERIFICATION_ENABLED: 'true',
  };
  const observedPath = '/api/case-content/published/pt';
  const evidence: Record<string, unknown> = {
    runId: process.env.ADFL_TEST_RUN_ID,
    containerId: owned.containerId,
    networkId: owned.networkId,
    node: process.versions.node,
  };
  let target: { subject: string; operationId: string } | undefined;
  let held: { response: ServerResponse; path: string; at: number; closed: boolean } | undefined;
  let child: Awaited<ReturnType<typeof startOwnedNextServer>> | undefined;
  const observer = createServer(async (incoming, response) => {
    try {
      const selected = target;
      const root = await readPublicRoot(directory);
      if (
        selected &&
        root?.subjects[selected.subject]?.operationId === selected.operationId &&
        !held &&
        incoming.method === 'GET' &&
        incoming.url === observedPath &&
        incoming.headers.cookie === undefined &&
        incoming.headers.authorization === undefined
      ) {
        const capture = { response, path: observedPath, at: Date.now(), closed: false };
        response.once('close', () => {
          capture.closed = true;
        });
        held = capture;
        return; // Hold the response open until the owned process is killed.
      }
      response.writeHead(503).end();
    } catch {
      response.writeHead(503).end();
    }
  });
  async function closeObserver() {
    if (!observer.listening) return;
    const closed = once(observer, 'close');
    observer.close();
    observer.closeAllConnections();
    await closed;
  }
  const fileHash = async () =>
    createHash('sha256')
      .update(await readFile(rootFile))
      .digest('hex');
  try {
    const login = await request.post('/api/users/login', {
      data: { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    });
    expect(login.status()).toBe(200);
    const saved = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic abrupt worker recovery intention' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const operationId = saved.latestPublicationIntent!;
    const revision = saved.editorialRevision;
    target = { subject: `cases/${saved.id}`, operationId };
    const statusPath = `/api/cases/${saved.id}/publication-status`;
    const statusHeaders = { Origin: env.SITE_ORIGIN };
    const pendingReceipt = { operationId, targetRevision: revision, state: 'update-pending' };
    const row = () =>
      fixture.payload.db.findOne<PublicationUpdate>({
        collection: 'publication-updates',
        where: { operationId: { equals: operationId } },
      });
    const retry = async () => readPublicationRetry(operationId, await fixture.request());
    expect((await readPublicRoot(directory))?.subjects[target.subject]).toBeUndefined();
    expect(await retry()).toMatchObject({ startedAttemptsVersion: 0, automaticAttempts: 0 });

    const listening = once(observer, 'listening');
    observer.listen({ host: '127.0.0.1', port: 0, exclusive: true });
    await listening;
    child = await startOwnedNextServer({ env: workerEnv, publicationObserverListener: observer });
    const { origin, buildId, distDirectory } = child;
    evidence.firstChild = { origin, buildId, distDirectory };
    await expect
      .poll(() => held?.path, { timeout: 20_000, intervals: [50, 100, 250] })
      .toBe(observedPath);
    const blocked = held!;
    const [promoted, promotedHash, pending, metadata, status] = await Promise.all([
      readPublicRoot(directory),
      fileHash(),
      row(),
      retry(),
      request.get(statusPath, { headers: statusHeaders, timeout: 2_000 }),
    ]);
    expect(promoted?.subjects[target.subject]).toMatchObject({
      operationId,
      targetRevision: revision,
    });
    expect(pending).toMatchObject({ ...pendingReceipt, attempts: 0 });
    expect(metadata).toMatchObject({
      retryUserId: fixture.user.id,
      startedAttemptsVersion: 1,
      automaticAttempts: 1,
    });
    expect(metadata?.nextAttemptAt).toBeTruthy();
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({ receipt: pendingReceipt });
    const beforeKillMs = Date.now() - blocked.at;
    expect(beforeKillMs).toBeLessThan(4_500);
    expect(blocked.response.headersSent).toBe(false);
    expect(blocked.closed).toBe(false);
    evidence.blocked = {
      receipt: pendingReceipt,
      generation: promoted!.generation,
      sha256: promotedHash,
      observer: blocked.path,
      beforeKillMs,
      nextAttemptAt: metadata?.nextAttemptAt,
      startedVersion: 1,
    };

    evidence.terminated = await child.crash();
    await expect.poll(() => blocked.closed, { timeout: 3_000 }).toBe(true);
    expect(blocked.response.headersSent).toBe(false);
    expect(await row()).toMatchObject({ ...pendingReceipt, attempts: 0 });
    expect(await retry()).toMatchObject({
      startedAttemptsVersion: 1,
      automaticAttempts: 1,
      nextAttemptAt: metadata?.nextAttemptAt,
    });
    expect(await fileHash()).toBe(promotedHash);
    await closeObserver();

    child = await startOwnedNextServer({ env: workerEnv });
    expect({
      origin: child.origin,
      buildId: child.buildId,
      distDirectory: child.distDirectory,
    }).toEqual({
      origin,
      buildId,
      distDirectory,
    });
    await expect
      .poll(async () => ({ state: (await row())?.state, retry: await retry() }), {
        timeout: 25_000,
      })
      .toMatchObject({
        state: 'public',
        retry: { startedAttemptsVersion: 2, automaticAttempts: 2, nextAttemptAt: null },
      });
    const confirmed = await request.get(`${child.origin}${statusPath}`, { headers: statusHeaders });
    expect(confirmed.status()).toBe(200);
    const publicReceipt = { ...pendingReceipt, state: 'public' };
    expect(await confirmed.json()).toEqual({ receipt: publicReceipt });
    expect(await row()).toMatchObject({ ...publicReceipt, attempts: 1 });
    const served = await fetch(`${child.origin}${observedPath}`, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    expect(served.status).toBe(200);
    expect(served.headers.get(publicGenerationHeader)).toBe(promoted!.generation);
    expect(await served.json()).toMatchObject({ ok: true });
    expect(await readPublicRoot(directory)).toEqual(promoted);
    expect(await fileHash()).toBe(promotedHash);
    const observedWorkerEvent = child.logs().includes('"operation":"publication.retry.worker"');
    evidence.recovered = {
      receipt: publicReceipt,
      buildId: child.buildId,
      origin: child.origin,
      generation: promoted!.generation,
      sha256: promotedHash,
      startedVersion: 2,
      automaticAttempts: 2,
      observedWorkerEvent,
    };
    expect(observedWorkerEvent).toBe(true);
  } finally {
    try {
      await child?.stop();
    } finally {
      try {
        await closeObserver();
      } finally {
        try {
          await fixture.payload.destroy();
        } finally {
          await info.attach('E3-publication-worker-crash.json', {
            body: JSON.stringify(evidence),
            contentType: 'application/json',
          });
        }
      }
    }
  }
});
