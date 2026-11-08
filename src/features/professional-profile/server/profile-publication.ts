import { trackMediaUsage, publicMediaSnapshotSchema } from '@/features/media-library/server';
import { capturePublicMedia } from '@/features/media-library/server';
import { extractProfileMedia } from '../content/extract-profile-media';
import 'server-only';
import type { ProfessionalProfile } from '@/payload-types';
import type { PublicationAdapter } from '@/helpers/payload/publication-updates';
import { mapProfile } from './map-profile';
export const profilePublicationAdapter: PublicationAdapter = {
  async reconcile(root, operation, req, options) {
    const snapshot = root.subjects['professional-profiles/' + operation.subjectId]?.value as {
      locale: 'pt' | 'en';
      media: unknown;
    };
    const media = publicMediaSnapshotSchema.array().parse(snapshot.media);
    await trackMediaUsage(
      [
        {
          collection: 'professional-profiles',
          documentId: operation.subjectId,
          locale: snapshot.locale,
          revision: operation.targetRevision,
          state: 'confirmed',
          reconcilePending: options.retirePending,
          references: media.map((item) => ({ mediaId: item.id, kind: item.manifest.kind })),
        },
      ],
      req,
    );
  },
  async prepare(document, published, req) {
    const doc = document as unknown as ProfessionalProfile;
    return {
      value: {
        media: await capturePublicMedia(extractProfileMedia(doc), req),
        kind: 'profile',
        locale: doc.locale,
        profile: mapProfile(doc)!,
      },
      dependencies: [`profile:${doc.locale}`, `navigation:${doc.locale}`, 'media', 'sitemap'],
    };
  },
};
