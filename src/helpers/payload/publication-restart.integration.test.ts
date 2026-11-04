import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getPayload } from 'payload';
import config from '@payload-config';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
} from '../../../testing/fixtures/editorial-lifecycle';
import { retryPublicationUpdate } from './publication-updates';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.8-process-outage');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
import { fork, type ChildProcess } from 'node:child_process';
import {
  inspectOwnedTestDatabase,
  setOwnedTestDatabaseNetwork,
} from '../../../testing/setup/owned-test-database';
import { once } from 'node:events';
it('survives a writer-process crash before SQL ack and serves confirmed HTTP bytes in a fresh process with PostgreSQL unreachable', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Crash and origin outage' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(parent.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `restart-${randomUUID()}`;
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Survives real process restart',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  // Bound the fault scenario before Vitest advances to the next file. Its
  // timeout reports failure without cancelling awaited IPC or HTTP.
  const signal = AbortSignal.timeout(45_000);
  const children: ChildProcess[] = [];
  const start = () => {
    const child = fork('testing/fixtures/publication-process.ts', [], {
      execArgv: ['--conditions=react-server', '--import', 'tsx'],
      windowsHide: true,
      silent: true,
      env: process.env,
    });
    children.push(child);
    return child;
  };
  inspectOwnedTestDatabase();
  let stopped = false;
  try {
    const writer = start();
    const held = once(writer, 'message', { signal });
    writer.send({
      mode: 'crash-ack',
      operationId: doc.latestPublicationIntent,
      userId: fixture.user.id,
    });
    expect((await held)[0]).toMatchObject({ event: 'before-ack' });
    const exited = once(writer, 'exit', { signal });
    writer.kill();
    await exited;
    expect(
      (
        await fixture.payload.find({
          collection: 'publication-updates',
          where: { operationId: { equals: doc.latestPublicationIntent } },
          overrideAccess: true,
        })
      ).docs[0]?.state,
    ).toBe('update-pending');
    const native = await getPayload({ config });
    const pools = new Set([fixture.payload.db.pool, native.db.pool]);
    for (const pool of pools) {
      // Installed adapter destroy only clears schema state; close its actual clients.
      const clients = (pool as unknown as { _clients: { end: () => Promise<void> }[] })._clients;
      await Promise.all([...clients].map((client) => client.end()));
      void pool.end();
    }
    await fixture.payload.destroy();
    if (native !== fixture.payload) await native.destroy();
    setOwnedTestDatabaseNetwork('disconnect');
    stopped = true;
    const reader = start();
    const ready = once(reader, 'message', { signal });
    reader.send({ mode: 'http' });
    const event = (await ready)[0] as { event: string; port: number };
    expect(event.event).toBe('ready');
    const base = `http://127.0.0.1:${event.port}`;
    const known = await fetch(`${base}/pt/cases/${slug}`, { signal });
    expect(known.status).toBe(200);
    expect(await known.text()).toContain('Survives real process restart');
    const bytes = await fetch(`${base}/media/${media.id}/original`, { signal });
    expect(bytes.status).toBe(200);
    expect((await bytes.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(
      (await fetch(`${base}/media/${media.id}/original`, { method: 'HEAD', signal })).status,
    ).toBe(200);
    const unknown = await fetch(`${base}/pt/cases/no-confirmed-cache-${randomUUID()}`, { signal });
    expect(unknown.status).toBe(503);
    expect(await unknown.text()).not.toContain('Case não encontrado');
  } finally {
    try {
      if (stopped) setOwnedTestDatabaseNetwork('connect');
    } finally {
      const cleanupSignal = AbortSignal.timeout(3_000);
      await Promise.all(
        children
          .filter((child) => child.exitCode === null && child.signalCode === null)
          .map((child) => {
            const done = once(child, 'exit', { signal: cleanupSignal });
            child.kill();
            return done;
          }),
      );
    }
    fixture = await createEditorialPayloadFixture(`e1.8-after-outage-${randomUUID()}`);
  }
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
}, 60_000);
