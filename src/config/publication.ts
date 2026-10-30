import 'server-only';
import { randomUUID } from 'node:crypto';
import { createPublicationCoordinator } from '@/helpers/payload/publication-coordinator';
import {
  casePublicationAdapter,
  caseOrderPublicationAdapter,
} from '@/features/cases/server/case-publication';
import { profilePublicationAdapter } from '@/features/professional-profile/server/profile-publication';
import { navigationPublicationAdapter } from '@/features/site-navigation/server/navigation-publication';
import { z } from 'zod';
export const publicationAdapters = {
  cases: caseOrderPublicationAdapter,
  'case-content': casePublicationAdapter,
  'professional-profiles': profilePublicationAdapter,
  'site-navigation': navigationPublicationAdapter,
};
export function portfolioPublicationCoordinator(directory: string) {
  return createPublicationCoordinator({
    directory,
    reconcile: async (root, operation, req, options) =>
      publicationAdapters[operation.subjectCollection].reconcile?.(root, operation, req, options),
    compose: async (root, operation) => {
      const adapter = publicationAdapters[operation.subjectCollection];
      const value = adapter.apply
        ? adapter.apply(root, operation)
        : z.json().parse(operation.target);
      return {
        generation: randomUUID(),
        subjects: {
          ...root?.subjects,
          [`${operation.subjectCollection}/${operation.subjectId}`]: {
            operationId: operation.operationId,
            targetRevision: operation.targetRevision,
            value,
          },
        },
      };
    },
  });
}
