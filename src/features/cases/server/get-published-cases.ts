import 'server-only';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { caseCardDTOSchema, type CaseCardDTO } from '../contracts/case-dto.schema';
import { casePublicSnapshotSchema } from './case-publication';
import { slugSchema } from '../contracts/slug.schema';
const orderSchema = z.object({
  kind: z.literal('case-order'),
  caseId: z.uuid(),
  sortOrder: z.number().finite(),
  featured: z.boolean(),
});
export const publishedCaseRouteSchema = z.object({
  caseId: z.uuid(),
  locale: localeSchema,
  path: z.string(),
  history: z.array(z.string()),
  seo: casePublicSnapshotSchema.shape.detail.unwrap().shape.seo,
});
export async function readConfirmedCaseEntries(generation?: PublicRoot | null) {
  const root =
    generation === undefined ? await readPublicRoot(runtimePublication().directory) : generation;
  if (!root || !z.uuid().safeParse(root.generation).success)
    throw new Error('Confirmed cases unavailable.');
  const orders = new Map<string, z.infer<typeof orderSchema>>();
  const cases: z.infer<typeof casePublicSnapshotSchema>[] = [];
  for (const [key, subject] of Object.entries(root.subjects)) {
    if (key.startsWith('cases/')) {
      const order = orderSchema.parse(subject.value);
      if (key !== `cases/${order.caseId}`) throw new Error('Case order identity mismatch.');
      orders.set(order.caseId, order);
    }
    if (key.startsWith('case-content/')) {
      const item = casePublicSnapshotSchema.parse(subject.value);
      item.slugs.forEach((slug) => slugSchema.parse(slug));
      if (item.slug !== null) slugSchema.parse(item.slug);
      if (key !== `case-content/${item.contentId}`) throw new Error('Case identity mismatch.');
      if (
        item.detail &&
        (item.detail.caseId !== item.caseId ||
          item.detail.locale !== item.locale ||
          item.detail.path !== `/${item.locale}/cases/${item.slug}`)
      )
        throw new Error('Case body identity mismatch.');
      cases.push(item);
    }
  }
  if (!orders.size && !cases.length) throw new Error('Confirmed case aggregate unavailable.');
  const seen = new Set<string>();
  for (const item of cases) {
    const identity = `${item.caseId}/${item.locale}`;
    if (!orders.has(item.caseId) || seen.has(identity))
      throw new Error('Confirmed case aggregate inconsistent.');
    seen.add(identity);
  }
  cases.sort(
    (a, b) =>
      orders.get(a.caseId)!.sortOrder - orders.get(b.caseId)!.sortOrder ||
      a.caseId.localeCompare(b.caseId),
  );
  return { cases, orders };
}
export async function getPublishedCases(
  locale: Locale,
  generation?: PublicRoot | null,
): Promise<Result<CaseCardDTO[]>> {
  try {
    const language = localeSchema.parse(locale);
    const { cases } = await readConfirmedCaseEntries(generation);
    return {
      ok: true,
      value: cases
        .filter((item) => item.locale === language && item.detail)
        .map((item) => caseCardDTOSchema.parse(item.detail)),
    };
  } catch {
    return { ok: false, error: { code: 'unavailable', message: 'Confirmed cases unavailable.' } };
  }
}
export async function getPublishedCaseRoutes(
  locale: Locale,
  generation?: PublicRoot | null,
): Promise<Result<z.infer<typeof publishedCaseRouteSchema>[]>> {
  try {
    const { cases } = await readConfirmedCaseEntries(generation);
    const language = localeSchema.parse(locale);
    const value = cases
      .filter((item) => item.locale === language && item.detail)
      .map((item) => {
        const pathFor = (slug: string) => `/${language}/cases/${slug}`;
        return publishedCaseRouteSchema.parse({
          caseId: item.caseId,
          locale: language,
          path: item.detail!.path,
          history: item.slugs.filter((slug) => slug !== item.slug).map(pathFor),
          seo: item.detail!.seo,
        });
      });
    return { ok: true, value };
  } catch {
    return { ok: false, error: { code: 'unavailable', message: 'Confirmed routes unavailable.' } };
  }
}
