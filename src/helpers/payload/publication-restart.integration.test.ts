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
import { fork, spawnSync, type ChildProcess } from 'node:child_process';
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
  const docker = (args: string[]) => {
    const result = spawnSync('docker', args, { windowsHide: true, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Owned test database network lifecycle failed.');
    return result.stdout.trim();
  };
  const container = 'a-design-for-life-local-postgres-test-1';
  const inspected = JSON.parse(docker(['inspect', container])) as {
    NetworkSettings: { Networks: Record<string, unknown> };
  }[];
  const networks = Object.keys(inspected[0]!.NetworkSettings.Networks);
  if (networks.length !== 1 || !networks[0]!.startsWith('a-design-for-life-local_'))
    throw new Error('Unexpected owned test network.');
  const network = networks[0]!;
  const compose = (action: 'stop' | 'up') =>
    docker(['network', action === 'stop' ? 'disconnect' : 'connect', network, container]);
  let stopped = false;
  try {
    const writer = start();
    const held = once(writer, 'message');
    writer.send({
      mode: 'crash-ack',
      operationId: doc.latestPublicationIntent,
      userId: fixture.user.id,
    });
    expect((await held)[0]).toMatchObject({ event: 'before-ack' });
    const exited = once(writer, 'exit');
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
    compose('stop');
    stopped = true;
    const reader = start();
    const ready = once(reader, 'message');
    reader.send({ mode: 'http' });
    const event = (await ready)[0] as { event: string; port: number };
    expect(event.event).toBe('ready');
    const base = `http://127.0.0.1:${event.port}`;
    const known = await fetch(`${base}/pt/cases/${slug}`);
    expect(known.status).toBe(200);
    expect(await known.text()).toContain('Survives real process restart');
    const bytes = await fetch(`${base}/media/${media.id}/original`);
    expect(bytes.status).toBe(200);
    expect((await bytes.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await fetch(`${base}/media/${media.id}/original`, { method: 'HEAD' })).status).toBe(
      200,
    );
    const unknown = await fetch(`${base}/pt/cases/no-confirmed-cache-${randomUUID()}`);
    expect(unknown.status).toBe(503);
    expect(await unknown.text()).not.toContain('Case não encontrado');
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const done = once(child, 'exit');
        child.kill();
        await done;
      }
    if (stopped) compose('up');
    fixture = await createEditorialPayloadFixture(`e1.8-after-outage-${randomUUID()}`);
  }
  expect(
    await retryPublicationUpdate(doc.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
}, 30000);
