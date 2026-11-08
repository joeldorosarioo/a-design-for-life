import { expect, it } from 'vitest';
import type { MediaUsage, MediaUsageChange } from '../contracts/media-usage.schema';
import { changeMediaUsage } from './change-media-usage';
const first = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const oldRevision = '20000000-0000-4000-8000-000000000001';
const nextRevision = '20000000-0000-4000-8000-000000000002';
const usage = (overrides: Partial<MediaUsage> = {}): MediaUsage => ({
  collection: 'case-content',
  documentId: first,
  locale: 'pt',
  revision: oldRevision,
  state: 'confirmed',
  ...overrides,
});
const change = (overrides: Partial<MediaUsageChange> = {}): MediaUsageChange => ({
  collection: 'case-content',
  documentId: first,
  locale: 'pt',
  revision: nextRevision,
  state: 'draft',
  referenced: true,
  ...overrides,
});
it('adds a new draft without revoking confirmed publication or another locale/document', () => {
  const publicPT = usage();
  const privateEN = usage({ documentId: other, locale: 'en', state: 'draft' });
  const result = changeMediaUsage([publicPT, privateEN], change());
  expect(result).toEqual([publicPT, privateEN, usage({ revision: nextRevision, state: 'draft' })]);
});
it('replaces only one owner publication and retains the former immutable revision for recovery', () => {
  const unrelated = usage({ documentId: other, locale: 'en' });
  expect(changeMediaUsage([usage(), unrelated], change({ state: 'confirmed' }))).toEqual([
    usage({ state: 'retained' }),
    unrelated,
    usage({ revision: nextRevision }),
  ]);
});
it('keeps confirmed assets protected while the next publication is pending', () => {
  expect(changeMediaUsage([usage()], change({ state: 'pending' }))).toEqual([
    usage(),
    usage({ revision: nextRevision, state: 'pending' }),
  ]);
});
it('withdraws only the selected owner publication, leaving shared publication available', () => {
  const unrelated = usage({ documentId: other, locale: 'en' });
  expect(
    changeMediaUsage([usage(), unrelated], change({ state: 'confirmed', referenced: false })),
  ).toEqual([usage({ state: 'retained' }), unrelated]);
});
it('is idempotent for a repeated owner/revision transition', () => {
  const command = change({ state: 'pending' });
  const once = changeMediaUsage([usage()], command);
  expect(changeMediaUsage(once, command)).toEqual([
    usage(),
    usage({ revision: nextRevision, state: 'pending' }),
  ]);
});
it('accumulates pending revision pins until the public-root acknowledgement reconciles them', () => {
  const priorPending = usage({ state: 'pending' });
  expect(changeMediaUsage([priorPending], change({ state: 'pending' }))).toEqual([
    priorPending,
    usage({ revision: nextRevision, state: 'pending' }),
  ]);
  expect(changeMediaUsage([priorPending], change({ state: 'pending', referenced: false }))).toEqual(
    [priorPending],
  );
});
it('only explicit confirmed-root reconciliation retires accumulated pending pins', () => {
  const pending = usage({ state: 'pending' });
  expect(
    changeMediaUsage([pending], {
      ...change({ state: 'confirmed', referenced: false }),
      reconcilePending: true,
    }),
  ).toEqual([usage({ state: 'retained' })]);
});
