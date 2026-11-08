import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-revision');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('rejects native Local API default lock/access overrides without an observed revision', async () => {
  const doc = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic revision' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: doc.id,
      data: { internalTitle: 'Unsafe overwrite' },
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'cases',
        id: doc.id,
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).internalTitle,
  ).toBe('Synthetic revision');
});

import {
  acquireEditorialLease,
  renewEditorialLease,
  releaseEditorialLease,
  editorialHead,
} from './editorial-revision';
async function metadata() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic concurrent' },
    req: await fixture.request(),
    overrideAccess: false,
  });
}
function observed(
  req: Awaited<ReturnType<typeof fixture.request>>,
  revision: string,
  token: string,
) {
  req.headers = new Headers({ 'x-editorial-revision': revision, 'x-editorial-lease': token });
  return req;
}
it('two concurrent native writes with one observed revision have exactly one winner', async () => {
  const doc = await metadata();
  const reqA = observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!);
  const reqB = observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!);
  const result = await Promise.allSettled(
    [reqA, reqB].map((req, index) =>
      fixture.payload.update({
        collection: 'cases',
        id: doc.id,
        data: { internalTitle: `Winner ${index}` },
        overrideAccess: false,
        req,
      }),
    ),
  );
  expect(result.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
  expect(result.filter((value) => value.status === 'rejected')).toHaveLength(1);
  const failure = result.find((value) => value.status === 'rejected');
  expect(failure?.status === 'rejected' && failure.reason).toMatchObject({
    code: 'stale-revision',
    status: 409,
  });
  expect(
    (await editorialHead('cases', doc.id, await fixture.request())).editorialRevision,
  ).not.toBe(doc.editorialRevision);
});
it('validation failure rolls back the revision CAS and leaves content untouched', async () => {
  const doc = await metadata();
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: doc.id,
      data: { internalTitle: '' },
      req: observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
  const head = await editorialHead('cases', doc.id, await fixture.request());
  expect(head.editorialRevision).toBe(doc.editorialRevision);
});
it('another real editor reads while different documents remain independently editable', async () => {
  const doc = await metadata();
  const other = await metadata();
  const second = await fixture.payload.create({
    collection: 'users',
    data: { email: `second-${doc.id}@example.invalid`, password: 'Synthetic-second-password-123!' },
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  const { createLocalReq } = await import('payload');
  const req = await createLocalReq({ user: { ...second, collection: 'users' } }, fixture.payload);
  expect(await acquireEditorialLease('cases', doc.id, req)).toMatchObject({ editable: false });
  await releaseEditorialLease('cases', other.id, other.leaseToken!, await fixture.request());
  expect(
    await acquireEditorialLease(
      'cases',
      other.id,
      await createLocalReq({ user: { ...second, collection: 'users' } }, fixture.payload),
    ),
  ).toMatchObject({ editable: true });
  for (const overrideAccess of [false, true]) {
    await expect(
      fixture.payload.update({
        collection: 'cases',
        id: doc.id,
        data: { internalTitle: 'Stolen' },
        overrideAccess,
        overrideLock: true,
        req: observed(
          await createLocalReq({ user: { ...second, collection: 'users' } }, fixture.payload),
          doc.editorialRevision!,
          doc.leaseToken!,
        ),
      }),
    ).rejects.toMatchObject({ status: 409, code: 'locked' });
  }
});
it('renewal preserves observed revision, release and expiry compare owner plus lease token', async () => {
  const doc = await metadata();
  await renewEditorialLease('cases', doc.id, doc.leaseToken!, await fixture.request());
  expect((await editorialHead('cases', doc.id, await fixture.request())).editorialRevision).toBe(
    doc.editorialRevision,
  );
  await expect(
    renewEditorialLease('cases', doc.id, 'old-token', await fixture.request()),
  ).rejects.toMatchObject({ code: 'locked' });
  expect(await releaseEditorialLease('cases', doc.id, 'old-token', await fixture.request())).toBe(
    false,
  );
  expect(
    await releaseEditorialLease('cases', doc.id, doc.leaseToken!, await fixture.request()),
  ).toBe(true);
  const next = await acquireEditorialLease('cases', doc.id, await fixture.request());
  expect(next.editable).toBe(true);
  expect(next.token).not.toBe(doc.leaseToken);
  expect(
    await releaseEditorialLease('cases', doc.id, doc.leaseToken!, await fixture.request()),
  ).toBe(false);
  await fixture.payload.db.updateOne({
    collection: 'cases',
    id: doc.id,
    data: { leaseExpiresAt: new Date(Date.now() - 1).toISOString() },
    options: { atomic: true },
  });
  await expect(
    renewEditorialLease('cases', doc.id, next.token!, await fixture.request()),
  ).rejects.toMatchObject({ code: 'locked' });
  expect((await acquireEditorialLease('cases', doc.id, await fixture.request())).editable).toBe(
    true,
  );
});
it('bulk mutations reject even with access and lock override defaults', async () => {
  const doc = await metadata();
  await expect(
    fixture.payload.update({
      collection: 'cases',
      where: { id: { equals: doc.id } },
      data: { featured: true },
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    fixture.payload.delete({
      collection: 'cases',
      where: { id: { equals: doc.id } },
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 409 });
});

it('a Local write with disableTransaction cannot advance the revision before validation failure', async () => {
  const doc = await metadata();
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: doc.id,
      data: { internalTitle: '' },
      disableTransaction: true,
      overrideAccess: false,
      req: observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!),
    }),
  ).rejects.toBeDefined();
  expect((await editorialHead('cases', doc.id, await fixture.request())).editorialRevision).toBe(
    doc.editorialRevision,
  );
});
it('a commit between content selection and technical head read never attaches a fresh revision to old content', async () => {
  const doc = await metadata();
  const req = await fixture.request();
  req.context.testReadBarrier = true;
  const actualFind = fixture.payload.db.findOne;
  let reads = 0;
  let reached!: () => void;
  let resume!: () => void;
  const selected = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    resume = resolve;
  });
  fixture.payload.db.findOne = (async (args) => {
    if (args.collection === 'cases' && args.req?.context?.testReadBarrier && ++reads === 1) {
      reached();
      await barrier;
    }
    return actualFind.call(fixture.payload.db, args);
  }) as typeof actualFind;
  try {
    const staleLoad = fixture.payload.findByID({
      collection: 'cases',
      id: doc.id,
      overrideAccess: false,
      req,
    });
    await selected;
    await fixture.payload.update({
      collection: 'cases',
      id: doc.id,
      data: { internalTitle: 'New content from another tab' },
      overrideAccess: false,
      req: observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!),
    });
    resume();
    const oldContent = await staleLoad;
    expect(oldContent.internalTitle).toBe('Synthetic concurrent');
    expect(oldContent.editorialRevision).toBe(doc.editorialRevision);
    await expect(
      fixture.payload.update({
        collection: 'cases',
        id: doc.id,
        data: {
          internalTitle: 'Stale old form',
          editorialRevision: oldContent.editorialRevision,
          leaseToken: oldContent.leaseToken,
        },
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ code: 'stale-revision' });
  } finally {
    resume();
    fixture.payload.db.findOne = actualFind;
  }
});

it('reacquiring a lease never makes an old content revision valid', async () => {
  const doc = await metadata();
  await fixture.payload.update({
    collection: 'cases',
    id: doc.id,
    data: { internalTitle: 'Changed while old tab remains' },
    req: observed(await fixture.request(), doc.editorialRevision!, doc.leaseToken!),
    overrideAccess: false,
  });
  await releaseEditorialLease('cases', doc.id, doc.leaseToken!, await fixture.request());
  const next = await acquireEditorialLease('cases', doc.id, await fixture.request());
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: doc.id,
      data: { internalTitle: 'Old form' },
      req: observed(await fixture.request(), doc.editorialRevision!, next.token!),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ code: 'stale-revision' });
});
