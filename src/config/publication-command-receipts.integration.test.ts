import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { publishCase } from '../features/cases/server';
import { publishProfile } from '../features/professional-profile/server';
import { publishNavigation } from '../features/site-navigation/server';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { readPublicRoot, withPublicRootWriter } from '../helpers/payload/public-root';
import { runtimePublication } from '../helpers/payload/publication-runtime';
import { editorialHead } from '../helpers/payload/editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('publication-command-receipts');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it.each(['case-content', 'professional-profiles', 'site-navigation'] as const)(
  '%s command returns truthful healthy, blocked-writer and externally-owned receipts',
  async (collection) => {
    await clearStructuralFixture(fixture.payload);
    const image = await mediaMetadataFixture(fixture.payload);
    const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Command receipt fixture' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    if (collection === 'site-navigation') {
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
      expect(
        await retryPublicationUpdate(profile.latestPublicationIntent!, await fixture.request()),
      ).toMatchObject({ ok: true, value: { state: 'public' } });
    }
    const data =
      collection === 'case-content'
        ? { ...casePublicationFixture(image.id), case: parent.id, locale: 'pt', _status: 'draft' }
        : collection === 'professional-profiles'
          ? { ...profilePublicationFixture(image.id, pdf.id), locale: 'pt', _status: 'draft' }
          : { ...navigationFixture(), locale: 'pt', _status: 'draft' };
    const draft = await fixture.payload.create({
      collection,
      data: data as never,
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const publish =
      collection === 'case-content'
        ? publishCase
        : collection === 'professional-profiles'
          ? publishProfile
          : publishNavigation;
    async function command() {
      const req = await observedRequest(collection, draft.id, await fixture.request());
      const head = await editorialHead(collection, draft.id, req);
      return { req, input: { contentId: draft.id, expectedRevision: head.editorialRevision } };
    }
    const healthy = await command();
    expect(await publish(healthy.input, healthy.req)).toMatchObject({
      ok: true,
      value: { state: 'public', contentId: draft.id },
    });
    const confirmed = await readPublicRoot(runtimePublication().directory);
    let pendingOperation = '';
    await withPublicRootWriter(runtimePublication().directory, async () => {
      const blocked = await command();
      const result = await publish(blocked.input, blocked.req);
      expect(result).toMatchObject({
        ok: true,
        value: { state: 'update-pending', contentId: draft.id },
      });
      if (!result.ok) throw new Error('Expected pending committed command');
      pendingOperation = result.value.operationId;
      expect(await readPublicRoot(runtimePublication().directory)).toEqual(confirmed);
    });
    expect(await retryPublicationUpdate(pendingOperation, await fixture.request())).toMatchObject({
      ok: true,
      value: { state: 'public' },
    });
    const prior = await readPublicRoot(runtimePublication().directory);
    const external = await command();
    const tx = await fixture.payload.db.beginTransaction();
    if (!tx) throw new Error('Native transaction required');
    external.req.transactionID = tx;
    try {
      const result = await publish(external.input, external.req);
      expect(result).toMatchObject({ ok: true, value: { state: 'update-pending' } });
      if (!result.ok) throw new Error('Expected provisional command result');
      expect(
        await retryPublicationUpdate(result.value.operationId, await fixture.request()),
      ).toMatchObject({ ok: false });
      expect(await readPublicRoot(runtimePublication().directory)).toEqual(prior);
      await fixture.payload.db.commitTransaction(tx);
      delete external.req.transactionID;
      expect(
        await retryPublicationUpdate(result.value.operationId, await fixture.request()),
      ).toMatchObject({ ok: true, value: { state: 'public' } });
      const applied = await readPublicRoot(runtimePublication().directory);
      expect(applied?.generation).not.toBe(prior?.generation);
      expect(
        await retryPublicationUpdate(result.value.operationId, await fixture.request()),
      ).toMatchObject({ ok: true, value: { state: 'public' } });
      expect(await readPublicRoot(runtimePublication().directory)).toEqual(applied);
    } finally {
      await fixture.payload.db.rollbackTransaction(tx);
      delete external.req.transactionID;
    }
  },
);
