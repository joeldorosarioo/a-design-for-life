import 'server-only';
import {
  mediaUsageChangeSchema,
  mediaUsageSchema,
  type MediaUsage,
  type MediaUsageChange,
} from '../contracts/media-usage.schema';
export function changeMediaUsage(usages: MediaUsage[], input: MediaUsageChange): MediaUsage[] {
  const change = mediaUsageChangeSchema.parse(input);
  const existing = mediaUsageSchema.array().parse(usages);
  const result = existing.map((usage) => {
    const sameOwner =
      usage.collection === change.collection &&
      usage.documentId === change.documentId &&
      usage.locale === change.locale;
    if (sameOwner && change.reconcilePending && usage.state === 'pending')
      return { ...usage, state: 'retained' as const };
    if (
      sameOwner &&
      change.state !== 'pending' &&
      usage.state === change.state &&
      (!change.referenced || usage.revision !== change.revision)
    )
      return { ...usage, state: 'retained' as const };
    return usage;
  });
  if (
    change.referenced &&
    !result.some(
      (usage) =>
        usage.collection === change.collection &&
        usage.documentId === change.documentId &&
        usage.locale === change.locale &&
        usage.revision === change.revision &&
        usage.state === change.state,
    )
  ) {
    result.push({
      collection: change.collection,
      documentId: change.documentId,
      locale: change.locale,
      revision: change.revision,
      state: change.state,
    });
  }
  return result;
}
