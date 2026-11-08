import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import { editorialLockState } from './editorial-lock-state';
import { editorialHead, EDITORIAL_LEASE_SECONDS } from './editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-native-form');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('native form-state expiry arithmetic matches the authoritative 300-second lease without refreshing the observed revision', async () => {
  const doc = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic native form' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const head = await editorialHead('cases', doc.id, await fixture.request());
  const result = { lockedState: editorialLockState(head) };
  expect(result.lockedState?.isLocked).toBe(true);
  expect(
    new Date(result.lockedState!.lastEditedAt).getTime() + EDITORIAL_LEASE_SECONDS * 1000,
  ).toBe(new Date(head.leaseExpiresAt!).getTime());
  expect(head.editorialRevision).toBe(doc.editorialRevision);
});
