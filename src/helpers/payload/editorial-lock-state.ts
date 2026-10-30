import 'server-only';
import { EDITORIAL_LEASE_SECONDS } from './editorial-revision';
export function editorialLockState(head: {
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
}) {
  const active = Boolean(head.leaseExpiresAt && new Date(head.leaseExpiresAt) > new Date());
  return {
    isLocked: active,
    lastEditedAt: head.leaseExpiresAt
      ? new Date(
          new Date(head.leaseExpiresAt).getTime() - EDITORIAL_LEASE_SECONDS * 1000,
        ).toISOString()
      : new Date().toISOString(),
    user: active ? { id: head.leaseOwner, collection: 'users' } : undefined,
  };
}
