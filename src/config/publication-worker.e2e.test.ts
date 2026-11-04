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
