import { editorialLockState } from './editorial-lock-state';
import 'server-only';
import type { BuildFormStateArgs, ServerFunction } from 'payload';
import { buildFormStateHandler } from '@payloadcms/ui/utilities/buildFormState';
import {
  acquireEditorialLease,
  editorialHead,
  isEditorialCollection,
  renewEditorialLease,
} from './editorial-revision';
export const openEditorialDocument: ServerFunction = async ({ collectionSlug, id, req }) => {
  if (
    !req.user ||
    typeof collectionSlug !== 'string' ||
    typeof id !== 'string' ||
    !isEditorialCollection(req, collectionSlug)
  )
    return;
  return acquireEditorialLease(collectionSlug, id, req, true);
};
export const editorialFormState: ServerFunction<BuildFormStateArgs> = async (args) => {
  const { collectionSlug, id, req } = args;
  if (!collectionSlug || !id || !isEditorialCollection(req, collectionSlug))
    return buildFormStateHandler(args);
  const result = await buildFormStateHandler({ ...args, returnLockStatus: false });
  if (!args.returnLockStatus || !req.user) return result;
  const token = args.data?.leaseToken ?? args.formState?.leaseToken?.value;
  if (args.updateLastEdited && typeof token === 'string') {
    try {
      await renewEditorialLease(collectionSlug, String(id), token, req);
    } catch {
      /* Return authoritative read-only lock state below. */
    }
  }
  const current = await editorialHead(collectionSlug, String(id), req);
  return { ...result, lockedState: editorialLockState(current) };
};
