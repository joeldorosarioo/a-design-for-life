import 'server-only';
import type { PayloadRequest } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { buildPrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import { mapCaseCardPresentation } from './map-case-detail';
export type PreviewCaseSelection = {
  cases: CaseCardDTO[];
  featured: CaseCardDTO[];
  count: number;
  routes: { caseId: string; contentId: string; locale: Locale; path: string }[];
};
const parentSchema = z.object({
  id: z.uuid(),
  sortOrder: z.number().finite().nullish(),
  featured: z.boolean().nullish(),
});
export async function getPreviewCases(
  locale: Locale,
  req: PayloadRequest,
): Promise<Result<PreviewCaseSelection>> {
  if (req.user?.collection !== 'users')
    return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
  const language = localeSchema.safeParse(locale);
  if (!language.success)
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview scope.' } };
  try {
    const result = await req.payload.find({
      collection: 'case-content',
      where: { locale: { equals: language.data } },
      draft: true,
      depth: 0,
      pagination: false,
      limit: 0,
      overrideAccess: false,
      req,
      select: {
        id: true,
        case: true,
        locale: true,
        eyebrow: true,
        title: true,
        titleEmphasis: true,
        summary: true,
        cover: true,
      },
    });
    if (!result.docs.length)
      return { ok: true, value: { cases: [], featured: [], count: 0, routes: [] } };
    const documents = result.docs.map((document) => ({
      document,
      caseId: typeof document.case === 'object' ? document.case.id : document.case,
    }));
    const caseIds = [...new Set(documents.map((item) => item.caseId))];
    const parents = await req.payload.find({
      collection: 'cases',
      where: { id: { in: caseIds } },
      depth: 0,
      pagination: false,
      limit: 0,
      overrideAccess: false,
      req,
      select: { id: true, sortOrder: true, featured: true },
    });
    const order = new Map(
      parents.docs.map((value) => {
        const parsed = parentSchema.parse(value);
        return [parsed.id, parsed] as const;
      }),
    );
    const seen = new Set<string>();
    for (const item of documents) {
      if (
        item.document.locale !== language.data ||
        !order.has(item.caseId) ||
        seen.has(item.caseId)
      )
        throw new Error('Preview case selection unavailable.');
      seen.add(item.caseId);
    }
    documents.sort(
      (a, b) =>
        (order.get(a.caseId)!.sortOrder ?? 0) - (order.get(b.caseId)!.sortOrder ?? 0) ||
        a.caseId.localeCompare(b.caseId),
    );
    const entries = documents.map(({ document, caseId }) => {
      const path = buildPrivatePreviewPath({
        locale: language.data,
        collection: 'case-content',
        id: document.id,
        page: 'case',
      });
      return {
        card: mapCaseCardPresentation(document, path),
        featured: order.get(caseId)!.featured === true,
        route: { caseId, contentId: document.id, locale: language.data, path },
      };
    });
    return {
      ok: true,
      value: {
        cases: entries.map((item) => item.card),
        featured: entries.filter((item) => item.featured).map((item) => item.card),
        count: entries.length,
        routes: entries.map((item) => item.route),
      },
    };
  } catch {
    return { ok: false, error: { code: 'unavailable', message: 'Preview unavailable.' } };
  }
}
