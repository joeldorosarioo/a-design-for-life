import type { Where } from 'payload';
import { acknowledgeCaseRoutes } from '../content/hooks/case-routes';
import { trackMediaUsage } from '@/features/media-library/server';
import { capturePublicMedia, publicMediaSnapshotSchema } from '@/features/media-library/server';
import { extractCaseMedia } from '../content/hooks/extract-case-media';
import 'server-only';
import type { CaseContent } from '@/payload-types';
import type { PublicationAdapter } from '@/helpers/payload/publication-updates';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { z } from 'zod';
import { caseDetailDTOSchema } from '../contracts/case-dto.schema';
import { mapCaseDetail } from './map-case-detail';
export const casePublicSnapshotSchema = z.object({
  media: publicMediaSnapshotSchema.array().default([]),
  kind: z.literal('case'),
  contentId: z.uuid(),
  caseId: z.uuid(),
  locale: z.enum(['pt', 'en']),
  slug: z.string().nullable(),
  detail: caseDetailDTOSchema.nullable(),
  slugs: z.string().array().default([]),
});
export function confirmedCases(root: PublicRoot | null) {
  return Object.entries(root?.subjects ?? {})
    .filter(([key]) => key.startsWith('case-content/'))
    .map(([, entry]) => casePublicSnapshotSchema.parse(entry.value));
}
export const casePublicationAdapter: PublicationAdapter = {
  async legacyWhere(req): Promise<Where> {
    const routes = await req.payload.find({
      collection: 'case-routes',
      where: { everPublished: { equals: true } },
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    });
    const ids = [
      ...new Set(
        routes.docs.map((route) =>
          typeof route.content === 'object' ? route.content.id : route.content,
        ),
      ),
    ];
    return ids.length
      ? { or: [{ _status: { equals: 'published' } }, { id: { in: ids } }] }
      : { _status: { equals: 'published' } };
  },
  async prepareLegacy(document, req) {
    const prepared = await casePublicationAdapter.prepare(
      document,
      document._status === 'published',
      req,
    );
    const routes = await req.payload.find({
      collection: 'case-routes',
      where: { and: [{ content: { equals: document.id } }, { everPublished: { equals: true } }] },
      pagination: false,
      limit: 0,
      depth: 0,
      sort: 'slug',
      overrideAccess: true,
      req,
    });
    const snapshot = casePublicSnapshotSchema.parse(prepared.value);
    return { ...prepared, value: { ...snapshot, slugs: routes.docs.map((route) => route.slug) } };
  },
  async reconcile(root, operation, req, options) {
    const snapshot = casePublicSnapshotSchema.parse(
      root.subjects['case-content/' + operation.subjectId]?.value,
    );
    await trackMediaUsage(
      [
        {
          collection: 'case-content',
          documentId: operation.subjectId,
          locale: snapshot.locale,
          revision: operation.targetRevision,
          state: 'confirmed',
          reconcilePending: options.retirePending,
          references: snapshot.media.map((media) => ({
            mediaId: media.id,
            kind: media.manifest.kind,
          })),
        },
      ],
      req,
    );
    await acknowledgeCaseRoutes(snapshot, req);
  },
  async prepare(document, published, req) {
    const doc = document as unknown as CaseContent;
    return {
      value: {
        media: published ? await capturePublicMedia(extractCaseMedia(doc), req) : [],
        kind: 'case',
        contentId: doc.id,
        caseId: typeof doc.case === 'object' ? doc.case.id : doc.case,
        locale: doc.locale,
        slug: published ? doc.slug! : null,
        detail: published ? mapCaseDetail(doc)! : null,
      },
      dependencies: [
        `case:${doc.id}`,
        `cases:${doc.locale}`,
        `featured:${doc.locale}`,
        'sitemap',
        'alternates',
        'media',
      ],
    };
  },
  apply(root, operation) {
    const target = casePublicSnapshotSchema.parse(operation.target);
    if (!root?.subjects[`cases/${target.caseId}`])
      throw new Error('Confirmed case ordering unavailable.');
    const previous = root?.subjects[`case-content/${target.contentId}`];
    const prior = previous ? casePublicSnapshotSchema.parse(previous.value) : undefined;
    return {
      ...target,
      slugs: [
        ...new Set([
          ...(prior?.slugs ?? []),
          ...target.slugs,
          ...(target.slug ? [target.slug] : []),
        ]),
      ],
    };
  },
};
export const caseOrderPublicationAdapter: PublicationAdapter = {
  shared: true,
  shouldPublish: (document, previous) =>
    !previous?.id ||
    document.sortOrder !== previous.sortOrder ||
    document.featured !== previous.featured,
  async prepare(doc) {
    return {
      value: {
        kind: 'case-order',
        caseId: String(doc.id),
        sortOrder: Number(doc.sortOrder ?? 0),
        featured: doc.featured === true,
      },
      dependencies: ['cases:pt', 'cases:en', 'featured:pt', 'featured:en'],
    };
  },
};
