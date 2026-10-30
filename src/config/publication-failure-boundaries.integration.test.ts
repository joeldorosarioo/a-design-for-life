import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, handleEndpoints, type TypeWithID } from 'payload';
import config from '@payload-config';
import { sql } from '@payloadcms/db-postgres';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rename, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { confirmNativePublication } from '../helpers/payload/publication-transport';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { installPayloadProvider } from '../helpers/payload/runtime';
import {
  installPublicationProvider,
  runtimePublication,
} from '../helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '../helpers/payload/public-root';
import { portfolioPublicationCoordinator } from './publication';
import { publishCase, resolveCaseRoute } from '../features/cases/server';
import { editorialHead } from '../helpers/payload/editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('publication-boundary-review');
  const native = await getPayload({ config });
  installPayloadProvider(async () => native);
  directory = await mkdtemp(path.join(tmpdir(), 'e18-review-boundary-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory.startsWith(path.join(tmpdir(), 'e18-review-boundary-')))
    await rm(directory, { recursive: true, force: true });
});
async function auth() {
  const login = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN! },
      body: JSON.stringify({
        email: fixture.user.email,
        password: 'Synthetic-editorial-test-password-123!',
      }),
    }),
  });
  expect(login.status).toBe(200);
  return login.headers.get('set-cookie')!.split(';')[0]!;
}
async function nativeSave(collection: 'cases' | 'case-content', data: Record<string, unknown>) {
  const cookie = await auth();
  const request = new Request(`${process.env.SITE_ORIGIN}/api/${collection}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN!, cookie },
    body: JSON.stringify(data),
  });
  const response = await handleEndpoints({ config, request });
  expect(response.status).toBe(201);
  const document = (await response.clone().json()).doc as {
    id: string;
    latestPublicationIntent: string;
    editorialRevision: string;
  };
  expect(document.latestPublicationIntent).toEqual(expect.any(String));
  return { cookie, request, response, document };
}
async function parent() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Review boundary' },
    req: await fixture.request(),
    overrideAccess: false,
  });
}
async function content(parentId: string, title: string) {
  const media = await mediaMetadataFixture(fixture.payload);
  return fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parentId,
      locale: 'pt',
      title,
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
}
async function confirm(operationId: string) {
  expect(await retryPublicationUpdate(operationId, await fixture.request())).toMatchObject({
    ok: true,
    value: { operationId, state: 'public' },
  });
}
async function recovered(operationId: string) {
  await confirm(operationId);
  const root = await readPublicRoot(directory);
  await confirm(operationId);
  expect(await readPublicRoot(directory)).toEqual(root);
}
async function withUnreadableRoot(run: () => Promise<void>) {
  const current = path.join(directory, 'current.json');
  const backup = path.join(directory, `saved-${randomUUID()}.json`);
  await rename(current, backup);
  await mkdir(current); // Actual filesystem EISDIR on reading the public-root path.
  try {
    await expect(readPublicRoot(directory)).rejects.toThrow();
    await run();
  } finally {
    await rmdir(current);
    await rename(backup, current);
  }
}
it('does not return undifferentiated Native success after the real session is revoked between save and confirmation', async () => {
  const baseline = await parent();
  await confirm(baseline.latestPublicationIntent!);
  const root = await readPublicRoot(directory);
  const saved = await nativeSave('cases', { internalTitle: 'Committed before session revocation' });
  const logout = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users/logout`, {
      method: 'POST',
      headers: { cookie: saved.cookie, origin: process.env.SITE_ORIGIN! },
    }),
  });
  expect(logout.status).toBe(200);
  const native = await getPayload({ config });
  expect((await native.auth({ headers: saved.request.headers })).user).toBeNull();
  const response = await confirmNativePublication(saved.response, saved.request);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    errors: [{ message: expect.stringMatching(/sessão|Sessão/) }],
  });
  expect(await readPublicRoot(directory)).toEqual(root);
  expect(
    await fixture.payload.db.findOne({
      collection: 'publication-updates',
      where: { operationId: { equals: saved.document.latestPublicationIntent } },
    }),
  ).toMatchObject({ state: 'update-pending' });
  await recovered(saved.document.latestPublicationIntent);
});
it('returns safe unavailability from Native transport, Result and coordinator when the first independent SQL proof cannot run', async () => {
  const saved = await nativeSave('cases', {
    internalTitle: 'Committed before independent SQL read failure',
  });
  const root = await readPublicRoot(directory);
  const req = await fixture.request();
  await fixture.payload.db.drizzle.execute(
    sql`ALTER TABLE publication_updates RENAME TO e18_review_unavailable_updates`,
  );
  try {
    const outcomes = await Promise.allSettled([
      confirmNativePublication(saved.response, saved.request),
      retryPublicationUpdate(saved.document.latestPublicationIntent, req),
      runtimePublication().retry(saved.document.latestPublicationIntent, req),
    ]);
    expect(outcomes.map((item) => item.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    const [transport, result, coordinated] = await Promise.all([
      confirmNativePublication(saved.response, saved.request),
      retryPublicationUpdate(saved.document.latestPublicationIntent, req),
      runtimePublication().retry(saved.document.latestPublicationIntent, req),
    ]);
    expect(transport.status).toBe(503);
    expect(await transport.json()).not.toHaveProperty('doc');
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    expect(coordinated).toBeNull();
    expect(await readPublicRoot(directory)).toEqual(root);
  } finally {
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE e18_review_unavailable_updates RENAME TO publication_updates`,
    );
  }
  expect(
    await fixture.payload.db.findOne({
      collection: 'publication-updates',
      where: { operationId: { equals: saved.document.latestPublicationIntent } },
    }),
  ).toMatchObject({ state: 'update-pending' });
  await recovered(saved.document.latestPublicationIntent);
});
it('returns a persistent Native pending receipt when a real dependency SQL read fails after committed-intent proof', async () => {
  const shared = await parent();
  const media = await mediaMetadataFixture(fixture.payload);
  const saved = await nativeSave('case-content', {
    ...casePublicationFixture(media.id),
    case: shared.id,
    locale: 'pt',
    _status: 'published',
  });
  const root = await readPublicRoot(directory);
  await fixture.payload.db.drizzle.execute(
    sql`ALTER TABLE cases RENAME TO e18_review_unavailable_cases`,
  );
  try {
    const response = await confirmNativePublication(saved.response, saved.request);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      publicationReceipt: {
        operationId: saved.document.latestPublicationIntent,
        targetRevision: saved.document.editorialRevision,
        state: 'update-pending',
      },
      message: expect.stringContaining('pendente'),
    });
    expect(
      await retryPublicationUpdate(saved.document.latestPublicationIntent, await fixture.request()),
    ).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    expect(await readPublicRoot(directory)).toEqual(root);
  } finally {
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE e18_review_unavailable_cases RENAME TO cases`,
    );
  }
  await recovered(saved.document.latestPublicationIntent);
});
it('preserves Native and Local command pending receipts on an actual filesystem read failure after COMMIT', async () => {
  const shared = await parent();
  const published = await content(shared.id, 'Known root before FS fault');
  await confirm(published.latestPublicationIntent!);
  const root = await readPublicRoot(directory);
  const saved = await nativeSave('cases', { internalTitle: 'Native target before FS fault' });
  const media = await mediaMetadataFixture(fixture.payload);
  const nativeContent = await nativeSave('case-content', {
    ...casePublicationFixture(media.id),
    case: saved.document.id,
    locale: 'pt',
    _status: 'published',
  });
  let localOperation = '';
  await withUnreadableRoot(async () => {
    const req = await observedRequest('case-content', published.id, await fixture.request());
    const head = await editorialHead('case-content', published.id, req);
    const outcomes = await Promise.allSettled([
      confirmNativePublication(nativeContent.response, nativeContent.request),
      publishCase({ contentId: published.id, expectedRevision: head.editorialRevision }, req),
    ]);
    expect(outcomes.map((item) => item.status)).toEqual(['fulfilled', 'fulfilled']);
    if (outcomes[0].status !== 'fulfilled' || outcomes[1].status !== 'fulfilled')
      throw new Error('Expected bounded public outcomes');
    const response = outcomes[0].value;
    const result = outcomes[1].value;
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      publicationReceipt: {
        operationId: nativeContent.document.latestPublicationIntent,
        state: 'update-pending',
      },
    });
    expect(result).toMatchObject({ ok: true, value: { state: 'update-pending' } });
    if (!result.ok) throw new Error('Expected committed Local pending receipt');
    localOperation = result.value.operationId;
    expect(
      await fixture.payload.db.findOne({
        collection: 'publication-updates',
        where: { operationId: { equals: localOperation } },
      }),
    ).toMatchObject({ state: 'update-pending', targetRevision: result.value.targetRevision });
  });
  expect(await readPublicRoot(directory)).toEqual(root);
  await recovered(nativeContent.document.latestPublicationIntent);
  await recovered(localOperation);
});
it.each(['missing', 'incomplete'] as const)(
  'reports503 for current, historical and withdrawn routes without %s root coverage, but404 for unknown/private',
  async (mode) => {
    const shared = await parent();
    const published = await content(shared.id, 'Previously public');
    await confirm(published.latestPublicationIntent!);
    const a = published.slug!;
    const b = `review-current-${randomUUID()}`;
    const changed = await fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: { slug: b, _status: 'published' },
      req: await observedRequest('case-content', published.id, await fixture.request()),
      overrideAccess: false,
    });
    await confirm(changed.latestPublicationIntent!);
    const withdrawn = await content((await parent()).id, 'Previously public then withdrawn');
    await confirm(withdrawn.latestPublicationIntent!);
    const withdrawal = await fixture.payload.update({
      collection: 'case-content',
      id: withdrawn.id,
      data: { _status: 'draft' },
      draft: false,
      req: await observedRequest('case-content', withdrawn.id, await fixture.request()),
      overrideAccess: false,
    });
    await confirm(withdrawal.latestPublicationIntent!);
    const privateSlug = `review-private-${randomUUID()}`;
    await fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: { slug: privateSlug, title: 'Never reconstruct this draft', _status: 'draft' },
      draft: true,
      req: await observedRequest('case-content', published.id, await fixture.request()),
      overrideAccess: false,
    });
    const full = await readPublicRoot(directory);
    if (!full) throw new Error('Expected confirmed root');
    const current = path.join(directory, 'current.json');
    const backup = path.join(directory, `coverage-${randomUUID()}.json`);
    await rename(current, backup);
    try {
      if (mode === 'incomplete')
        await withPublicRootWriter(directory, async (_, commit) =>
          commit({
            generation: randomUUID(),
            subjects: Object.fromEntries(
              Object.entries(full.subjects).filter(([key]) => key.startsWith('cases/')),
            ),
          }),
        );
      for (const route of [a, b, withdrawn.slug!])
        expect(await resolveCaseRoute('pt', route, fixture.payload)).toMatchObject({
          status: 503,
          locale: 'pt',
        });
      for (const route of [privateSlug, `unknown-${randomUUID()}`])
        expect(await resolveCaseRoute('pt', route, fixture.payload)).toEqual({ status: 404 });
    } finally {
      if (mode === 'incomplete') await rm(current);
      await rename(backup, current);
    }
    expect(await readPublicRoot(directory)).toEqual(full);
    expect(await resolveCaseRoute('pt', a, fixture.payload)).toMatchObject({
      status: 308,
      location: `/pt/cases/${b}`,
    });
    expect(await resolveCaseRoute('pt', b, fixture.payload)).toMatchObject({
      status: 200,
      case: { title: 'Previously public' },
    });
    expect(await resolveCaseRoute('pt', withdrawn.slug!, fixture.payload)).toMatchObject({
      status: 410,
    });
  },
);

it('keeps a proven pending receipt when the coordinator second SQL read becomes unavailable', async () => {
  const shared = await parent();
  const root = await readPublicRoot(directory);
  const find = fixture.payload.db.findOne.bind(fixture.payload.db);
  let renamed = false;
  fixture.payload.db.findOne = async <T extends TypeWithID>(args: Parameters<typeof find>[0]) => {
    const row = await find<T>(args);
    if (args.collection === 'publication-updates' && !renamed) {
      await fixture.payload.db.drizzle.execute(
        sql`ALTER TABLE publication_updates RENAME TO e18_review_second_read_updates`,
      );
      renamed = true;
    }
    return row;
  };
  try {
    expect(
      await retryPublicationUpdate(shared.latestPublicationIntent!, await fixture.request()),
    ).toMatchObject({
      ok: true,
      value: {
        operationId: shared.latestPublicationIntent,
        targetRevision: shared.editorialRevision,
        state: 'update-pending',
      },
    });
    expect(renamed).toBe(true);
    expect(await readPublicRoot(directory)).toEqual(root);
  } finally {
    fixture.payload.db.findOne = find;
    if (renamed)
      await fixture.payload.db.drizzle.execute(
        sql`ALTER TABLE e18_review_second_read_updates RENAME TO publication_updates`,
      );
  }
  await recovered(shared.latestPublicationIntent!);
});
it('returns a safe Local command Result when SQL becomes unavailable immediately after its real owned COMMIT', async () => {
  const published = await content((await parent()).id, 'Prior committed Local body');
  await confirm(published.latestPublicationIntent!);
  await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    data: { title: 'Committed Local target awaiting proof', _status: 'draft' },
    draft: true,
    req: await observedRequest('case-content', published.id, await fixture.request()),
    overrideAccess: false,
  });
  const req = await observedRequest('case-content', published.id, await fixture.request());
  const head = await editorialHead('case-content', published.id, req);
  const root = await readPublicRoot(directory);
  const commit = fixture.payload.db.commitTransaction.bind(fixture.payload.db);
  let renamed = false;
  fixture.payload.db.commitTransaction = async (id) => {
    await commit(id); // Passthrough: inject real SQL unavailability only after actual COMMIT.
    if (!renamed) {
      await fixture.payload.db.drizzle.execute(
        sql`ALTER TABLE publication_updates RENAME TO e18_review_after_commit_updates`,
      );
      renamed = true;
    }
  };
  try {
    const result = await publishCase(
      { contentId: published.id, expectedRevision: head.editorialRevision },
      req,
    );
    expect(renamed).toBe(true);
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    expect(result).not.toHaveProperty('value');
    expect(JSON.stringify(result)).not.toMatch(/select |publication_updates|e18_review/);
    expect(await readPublicRoot(directory)).toEqual(root);
  } finally {
    fixture.payload.db.commitTransaction = commit;
    if (renamed)
      await fixture.payload.db.drizzle.execute(
        sql`ALTER TABLE e18_review_after_commit_updates RENAME TO publication_updates`,
      );
  }
  const durable = await fixture.payload.findByID({
    collection: 'case-content',
    id: published.id,
    draft: false,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(durable.title).toBe('Committed Local target awaiting proof');
  const stored = (await fixture.payload.db.findOne({
    collection: 'case-content',
    where: { id: { equals: published.id } },
  })) as unknown as { latestPublicationIntent: string };
  expect(
    await fixture.payload.db.findOne({
      collection: 'publication-updates',
      where: { operationId: { equals: stored.latestPublicationIntent } },
    }),
  ).toMatchObject({ state: 'update-pending' });
  await recovered(stored.latestPublicationIntent);
});

import { resolveMediaAccess } from '../features/media-library/server';
it.each(['missing', 'incomplete'] as const)(
  'classifies SQL-confirmed media without %s root coverage as503, while a covered withdrawal revokes despite an unacked SQL grant',
  async (mode) => {
    const published = await content((await parent()).id, 'Confirmed media coverage');
    await confirm(published.latestPublicationIntent!);
    const mediaId =
      typeof published.cover!.media === 'string'
        ? published.cover!.media
        : published.cover!.media!.id;
    const withdrawn = await content((await parent()).id, 'Media revoked before SQL ACK');
    await confirm(withdrawn.latestPublicationIntent!);
    const revokedId =
      typeof withdrawn.cover!.media === 'string'
        ? withdrawn.cover!.media
        : withdrawn.cover!.media!.id;
    const privateMedia = await mediaMetadataFixture(fixture.payload);
    const access = (id: string) =>
      resolveMediaAccess({ mediaId: id, variant: 'original', preview: false });
    await fixture.payload.db.drizzle.execute(
      sql`ALTER TABLE publication_updates ADD CONSTRAINT e18_review_media_ack CHECK (state<>'public') NOT VALID`,
    );
    let withdrawalOperation = '';
    try {
      const withdrawal = await fixture.payload.update({
        collection: 'case-content',
        id: withdrawn.id,
        data: { _status: 'draft' },
        draft: false,
        req: await observedRequest('case-content', withdrawn.id, await fixture.request()),
        overrideAccess: false,
      });
      withdrawalOperation = withdrawal.latestPublicationIntent!;
      expect(
        await retryPublicationUpdate(withdrawalOperation, await fixture.request()),
      ).toMatchObject({ ok: true, value: { state: 'update-pending' } });
      for (const id of [mediaId, revokedId]) {
        const row = (await fixture.payload.db.findOne({
          collection: 'media',
          where: { id: { equals: id } },
        })) as unknown as { usages: { state: string }[] };
        expect(row.usages.some((use) => use.state === 'confirmed')).toBe(true);
      }
      expect(await access(mediaId)).toMatchObject({ ok: true });
      expect(await access(revokedId)).toEqual({ ok: false, status: 404 });
      const full = await readPublicRoot(directory);
      if (!full) throw new Error('Expected confirmed root');
      const current = path.join(directory, 'current.json');
      const backup = path.join(directory, `media-coverage-${randomUUID()}.json`);
      await rename(current, backup);
      try {
        if (mode === 'incomplete')
          await withPublicRootWriter(directory, async (_, commit) =>
            commit({
              generation: randomUUID(),
              subjects: Object.fromEntries(
                Object.entries(full.subjects).filter(
                  ([key]) => key !== `case-content/${published.id}`,
                ),
              ),
            }),
          );
        expect(await access(mediaId)).toEqual({ ok: false, status: 503 });
        expect(await access(revokedId)).toEqual({
          ok: false,
          status: mode === 'incomplete' ? 404 : 503,
        });
        expect(await access(privateMedia.id)).toEqual({ ok: false, status: 404 });
        expect(await access(randomUUID())).toEqual({ ok: false, status: 404 });
      } finally {
        if (mode === 'incomplete') await rm(current);
        await rename(backup, current);
      }
      expect(await readPublicRoot(directory)).toEqual(full);
      expect(await access(mediaId)).toMatchObject({ ok: true });
      expect(await access(revokedId)).toEqual({ ok: false, status: 404 });
    } finally {
      await fixture.payload.db.drizzle.execute(
        sql`ALTER TABLE publication_updates DROP CONSTRAINT IF EXISTS e18_review_media_ack`,
      );
    }
    await recovered(withdrawalOperation);
  },
);
