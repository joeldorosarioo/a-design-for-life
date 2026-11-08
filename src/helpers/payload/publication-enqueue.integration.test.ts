import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../testing/fixtures/editorial-payload';
import { enqueuePublicationUpdate } from './publication-updates';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-native-publication-head');
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('updates only publication metadata within the same transaction as its intent', async () => {
  const saved = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'pt', header: { brandLabel: 'Existing editorial text' }, _status: 'draft' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const canonical = () =>
    fixture.payload.db.findOne({
      collection: 'site-navigation',
      where: { id: { equals: saved.id } },
    });
  const before = await canonical();
  const req = await fixture.request();
  const transaction = await fixture.payload.db.beginTransaction();
  if (!transaction) throw new Error('Native transaction required');
  req.transactionID = transaction;
  try {
    const receipt = await enqueuePublicationUpdate(
      {
        subject: { collection: 'site-navigation', id: saved.id },
        targetRevision: saved.editorialRevision!,
        dependencies: ['navigation:pt'],
        target: { kind: 'navigation', locale: 'pt' },
      },
      req,
    );
    const head = await fixture.payload.db.findOne({
      collection: 'site-navigation',
      where: { id: { equals: saved.id } },
      req,
    });
    expect(head).toEqual({
      ...before,
      latestPublicationIntent: receipt.operationId,
      publicConfirmed: false,
    });
    expect(
      await fixture.payload.db.findOne({
        collection: 'publication-updates',
        where: { operationId: { equals: receipt.operationId } },
        req,
      }),
    ).toMatchObject({ subjectId: saved.id, targetRevision: saved.editorialRevision });
    expect(await canonical()).toEqual(before);
    expect(
      (
        await fixture.payload.db.find({
          collection: 'publication-updates',
          where: { operationId: { equals: receipt.operationId } },
        })
      ).docs,
    ).toEqual([]);
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  expect(await canonical()).toEqual(before);
});

it('fails closed without creating a publication head for an absent subject', async () => {
  const id = randomUUID();
  const req = await fixture.request();
  const transaction = await fixture.payload.db.beginTransaction();
  if (!transaction) throw new Error('Native transaction required');
  req.transactionID = transaction;
  try {
    await expect(
      enqueuePublicationUpdate(
        {
          subject: { collection: 'site-navigation', id },
          targetRevision: randomUUID(),
          dependencies: ['navigation:pt'],
          target: {},
        },
        req,
      ),
    ).rejects.toThrow(/subject.*unavailable/i);
    expect(
      await fixture.payload.db.findOne({
        collection: 'site-navigation',
        where: { id: { equals: id } },
        req,
      }),
    ).toBeNull();
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  expect(
    (
      await fixture.payload.db.find({
        collection: 'publication-updates',
        where: { subjectId: { equals: id } },
      })
    ).docs,
  ).toEqual([]);
});
