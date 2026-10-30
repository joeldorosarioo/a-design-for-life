import { afterAll, beforeAll, expect, it } from 'vitest';
import { handleEndpoints, getPayload } from 'payload';
import { installPayloadProvider } from '../helpers/payload/runtime';
import config from '@payload-config';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rename, rm, rmdir, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { confirmNativePublication } from '../helpers/payload/publication-transport';
import { installPublicationProvider } from '../helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '../helpers/payload/public-root';
import { portfolioPublicationCoordinator } from './publication';
import { getPublishedCase } from '../features/cases/server';
import { getPublishedProfile } from '../features/professional-profile/server';
import { getPublishedNavigation } from '../features/site-navigation/server';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('whole-review-native');
  const native = await getPayload({ config });
  installPayloadProvider(async () => native);
  directory = await mkdtemp(path.join(tmpdir(), 'e18-whole-native-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory.startsWith(path.join(tmpdir(), 'e18-whole-native-')))
    await rm(directory, { recursive: true, force: true });
});
async function confirm(operationId: string) {
  expect(await retryPublicationUpdate(operationId, await fixture.request())).toMatchObject({
    ok: true,
    value: { state: 'public' },
  });
}
async function get(url: string, cookie?: string) {
  return handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/${url}`, {
      headers: cookie ? { cookie, origin: process.env.SITE_ORIGIN! } : undefined,
    }),
  });
}
async function auth() {
  const response = await handleEndpoints({
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
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
async function structural() {
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'published',
    } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(profile.latestPublicationIntent!);
  const nav = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'published' } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirm(nav.latestPublicationIntent!);
  return { image, profile, nav };
}
it.each(['case-content', 'professional-profiles', 'site-navigation'] as const)(
  '%s pending republication cannot leak through anonymous Native draft list, ID, filter, sort or count',
  async (collection) => {
    const { image, profile, nav } = await structural();
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Native version access' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const caseDoc = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(image.id),
        case: parent.id,
        locale: 'pt',
        _status: 'published',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirm(caseDoc.latestPublicationIntent!);
    const document =
      collection === 'case-content'
        ? caseDoc
        : collection === 'professional-profiles'
          ? profile
          : nav;
    const oldRoot = await readPublicRoot(directory);
    const oldDTOs = await Promise.all([
      getPublishedCase('pt', caseDoc.slug!),
      getPublishedProfile('pt'),
      getPublishedNavigation('pt'),
    ]);
    expect(oldDTOs.every((result) => result.ok)).toBe(true);
    const marker = `PRIVATE-PENDING-${randomUUID()}`;
    const field =
      collection === 'case-content'
        ? 'title'
        : collection === 'professional-profiles'
          ? 'identity.name'
          : 'header.brandLabel';
    const data =
      collection === 'case-content'
        ? { title: marker }
        : collection === 'professional-profiles'
          ? { identity: { ...profile.identity, name: marker } }
          : { header: { ...nav.header, brandLabel: marker } };
    const cookie = await auth();
    const observed = await observedRequest(collection, document.id, await fixture.request());
    const headers = new Headers(observed.headers);
    headers.set('cookie', cookie);
    headers.set('content-type', 'application/json');
    headers.set('origin', process.env.SITE_ORIGIN!);
    let pending = '';
    await withPublicRootWriter(directory, async () => {
      const request = new Request(`${process.env.SITE_ORIGIN}/api/${collection}/${document.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...data, _status: 'published' }),
      });
      const native = await handleEndpoints({ config, request });
      expect(native.status).toBe(200);
      const response = await confirmNativePublication(native, request);
      expect(response.status).toBe(200);
      const saved = await response.json();
      expect(saved.publicationReceipt).toMatchObject({
        state: 'update-pending',
        targetRevision: saved.doc.editorialRevision,
      });
      pending = saved.publicationReceipt.operationId;
      const authenticated = await get(`${collection}/${document.id}?draft=true`, cookie);
      expect(authenticated.status).toBe(200);
      expect(JSON.stringify(await authenticated.json())).toContain(marker);
      expect(await readPublicRoot(directory)).toEqual(oldRoot);
      expect(
        await Promise.all([
          getPublishedCase('pt', caseDoc.slug!),
          getPublishedProfile('pt'),
          getPublishedNavigation('pt'),
        ]),
      ).toEqual(oldDTOs);
      const query = new URLSearchParams({
        draft: 'true',
        'where[id][equals]': document.id,
        [`where[${field}][equals]`]: marker,
        sort: `-${field}`,
      });
      const list = await get(`${collection}?${query}`);
      const byID = await get(`${collection}/${document.id}?draft=true`);
      const count = await get(`${collection}/count?${query}`);
      expect.soft(list.status).toBe(200);
      expect.soft(await list.json()).toMatchObject({ docs: [], totalDocs: 0 });
      expect.soft(byID.status).toBe(404);
      expect.soft(JSON.stringify(await byID.json())).not.toContain(marker);
      expect.soft(count.status).toBe(200);
      expect.soft(await count.json()).toMatchObject({ totalDocs: 0 });
      // Reproduce a persisted pre-fix latest version through the official adapter.
      // This is a test fixture, not a migration or a remedy that rewrites history.
      const versions = await fixture.payload.db.findVersions({
        collection,
        where: { and: [{ parent: { equals: document.id } }, { latest: { equals: true } }] },
        limit: 1,
      });
      expect(versions.docs).toHaveLength(1);
      const legacy = versions.docs[0];
      await fixture.payload.db.updateVersion({
        collection,
        id: legacy.id,
        versionData: { version: { ...legacy.version, publicConfirmed: true } },
      });
      const stored = await fixture.payload.db.findVersions({
        collection,
        where: { id: { equals: legacy.id } },
        limit: 1,
      });
      expect(stored.docs[0].version.publicConfirmed).toBe(true);
      const legacyList = await get(`${collection}?${query}`);
      const legacyID = await get(`${collection}/${document.id}?draft=true`);
      expect.soft(await legacyList.json()).toMatchObject({ docs: [], totalDocs: 0 });
      expect.soft(legacyID.status).toBe(404);
      expect.soft(JSON.stringify(await legacyID.json())).not.toContain(marker);
      const editor = await get(`${collection}/${document.id}?draft=true`, cookie);
      expect(editor.status).toBe(200);
      expect(JSON.stringify(await editor.json())).toContain(marker);
      expect(await readPublicRoot(directory)).toEqual(oldRoot);
    });
    await confirm(pending);
    const confirmed = await readPublicRoot(directory);
    await confirm(pending);
    expect(await readPublicRoot(directory)).toEqual(confirmed);
  },
);
it.each(['missing', 'corrupt', 'directory', 'dependency'] as const)(
  'Native published structural endpoints return503, not404, with a real %s root failure and recover',
  async (fault) => {
    const { profile, nav } = await structural();
    const root = (await readPublicRoot(directory))!;
    const paths = ['professional-profiles/published/pt', 'site-navigation/published/pt'];
    const before = [];
    for (const url of paths) {
      const response = await get(url);
      expect(response.status).toBe(200);
      before.push(await response.json());
    }
    for (const collection of ['professional-profiles', 'site-navigation'] as const) {
      expect((await get(`${collection}/published/en`)).status).toBe(404);
      await fixture.payload.create({
        collection,
        data: { locale: 'en', _status: 'draft' },
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      });
    }
    const marker = `PRIVATE-STRUCTURAL-${randomUUID()}`;
    await fixture.payload.update({
      collection: 'professional-profiles',
      id: profile.id,
      data: { identity: { ...profile.identity, name: marker }, _status: 'published' },
      req: await observedRequest('professional-profiles', profile.id, await fixture.request()),
      overrideAccess: false,
    });
    await fixture.payload.update({
      collection: 'site-navigation',
      id: nav.id,
      data: { header: { ...nav.header, brandLabel: marker }, _status: 'published' },
      req: await observedRequest('site-navigation', nav.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(await readPublicRoot(directory)).toEqual(root);
    const current = path.join(directory, 'current.json');
    const backup = path.join(directory, `${randomUUID()}.backup`);
    await rename(current, backup);
    try {
      if (fault === 'corrupt') await writeFile(current, '{ invalid json');
      if (fault === 'directory') await mkdir(current);
      if (fault === 'dependency')
        await writeFile(
          current,
          JSON.stringify({
            ...root,
            subjects: Object.fromEntries(
              Object.entries(root.subjects).filter(
                ([key]) => !key.startsWith('professional-profiles/'),
              ),
            ),
          }),
        );
      for (const collection of ['professional-profiles', 'site-navigation']) {
        expect.soft((await get(`${collection}/published/en`)).status).toBe(404);
      }
      for (const url of paths) {
        const response = await get(url);
        expect.soft(response.status).toBe(503);
        expect.soft(response.headers.get('cache-control')).toContain('no-store');
        const body = await response.json();
        expect.soft(body).toMatchObject({ ok: false, error: { code: 'unavailable' } });
        expect.soft(JSON.stringify(body)).not.toContain(marker);
      }
    } finally {
      if (fault === 'directory') await rmdir(current);
      else if (fault !== 'missing') await unlink(current);
      await rename(backup, current);
    }
    expect(await readPublicRoot(directory)).toEqual(root);
    for (const [index, url] of paths.entries()) {
      const response = await get(url);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(before[index]);
    }
    for (const collection of ['professional-profiles', 'site-navigation']) {
      expect((await get(`${collection}/published/invalid`)).status).toBe(404);
    }
  },
);
