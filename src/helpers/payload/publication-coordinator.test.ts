import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { PayloadRequest, Where } from 'payload';
import type { PublicationUpdate } from '@/payload-types';
import { createPublicationCoordinator } from './publication-coordinator';
import { readPublicRoot, withPublicRootWriter } from './public-root';

vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async ({ user }: Pick<PayloadRequest, 'user'>, payload: unknown) => ({
    user,
    payload,
  }),
}));

function matches(row: PublicationUpdate, where: Where): boolean {
  if (where.and) return where.and.every((clause) => matches(row, clause));
  if (where.or) return where.or.some((clause) => matches(row, clause));
  return Object.entries(where).every(([field, condition]) => {
    const value = row[field as keyof PublicationUpdate];
    if ('equals' in condition) return value === condition.equals;
    if ('not_equals' in condition) return value !== condition.not_equals;
    throw new Error('Unsupported unit fixture filter.');
  });
}

it.each([
  ['public', true],
  ['update-pending', false],
  ['superseded', false],
] as const)(
  'passes the exact selected predecessor state to observed composition when it is %s',
  async (state, previousAcknowledged) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'publication-predecessor-'));
    const subjectId = randomUUID();
    const subjectKey = `cases/${subjectId}`;
    const operation = (state: PublicationUpdate['state']): PublicationUpdate => ({
      id: randomUUID(),
      operationId: randomUUID(),
      targetRevision: randomUUID(),
      subjectCollection: 'cases',
      subjectId,
      dependencies: [],
      target: { kind: 'case-order' },
      state,
      attempts: 0,
      updatedAt: '',
      createdAt: '',
    });
    const previous = operation(state);
    const pending = operation('update-pending');
    const earlierPublic = operation('public');
    const next = operation('update-pending');
    const rows = [previous, pending, earlierPublic, next];
    const native = {
      sessions: { unit: { db: {} } },
      beginTransaction: async () => 'unit',
      commitTransaction: async () => {},
      rollbackTransaction: async () => {},
      findOne: async ({ where }: { where: Where }) => rows.find((row) => matches(row, where)),
      find: vi.fn(async ({ where }: { where: Where }) => ({
        docs: rows.filter((row) => matches(row, where)),
      })),
      updateOne: async ({
        collection,
        where,
        data,
      }: {
        collection: string;
        where: Where;
        data: Partial<PublicationUpdate>;
      }) => {
        if (collection === 'cases')
          return { _status: 'published', contentRevision: next.targetRevision };
        const row = rows.find((row) => matches(row, where));
        return row ? Object.assign(row, data) : null;
      },
    };
    const req = {
      user: { collection: 'users', id: randomUUID() },
      payload: { db: native },
    } as unknown as PayloadRequest;
    try {
      const generation = randomUUID();
      await withPublicRootWriter(directory, (_, commit) =>
        commit({
          generation,
          subjects: {
            [subjectKey]: {
              operationId: previous.operationId,
              targetRevision: previous.targetRevision,
              value: z.json().parse(previous.target),
            },
          },
        }),
      );
      const composed = vi.fn(async () => ({
        generation: randomUUID(),
        subjects: {
          [subjectKey]: {
            operationId: next.operationId,
            targetRevision: next.targetRevision,
            value: z.json().parse(next.target),
          },
        },
      }));
      const coordinator = createPublicationCoordinator({
        directory,
        compose: composed,
        verify: async () => {},
      });
      expect(await coordinator.retry(next.operationId, req)).toMatchObject({ state: 'public' });
      expect(composed).toHaveBeenCalledWith(expect.objectContaining({ generation }), next, {
        previousAcknowledged,
      });
      expect(native.find).toHaveBeenCalledTimes(1);
      expect(pending.state).toBe('superseded');
      expect(earlierPublic.state).toBe('public');
      expect(previous.state).toBe(state === 'update-pending' ? 'superseded' : state);
      expect((await readPublicRoot(directory))?.subjects[subjectKey]?.operationId).toBe(
        next.operationId,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
