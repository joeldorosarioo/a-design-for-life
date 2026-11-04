import 'server-only';
import type { Endpoint } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { capturePublishedReadRoot } from '@/helpers/payload/published-read-response';
import { imageUseDTOSchema } from '@/features/media-library';
import { caseCardDTOSchema } from '../contracts/case-dto.schema';
import { getFeaturedCases } from './get-featured-cases';
import { getPublishedCases } from './get-published-cases';

const publicCard = caseCardDTOSchema
  .extend({ cover: imageUseDTOSchema.strict().nullable() })
  .strict();
export const publishedCaseAggregateSchema = z.strictObject({
  cards: z.array(publicCard),
  featured: z.array(publicCard),
});
type PublishedCaseAggregate = z.infer<typeof publishedCaseAggregateSchema>;
const unavailable = {
  ok: false,
  error: { code: 'unavailable', message: 'Confirmed cases unavailable.' },
} as const;

export async function getPublishedCaseAggregate(
  locale: Locale,
  root: PublicRoot | null,
): Promise<Result<PublishedCaseAggregate>> {
  if (!root) return unavailable;
  const [cards, featured] = await Promise.all([
    getPublishedCases(locale, root),
    getFeaturedCases(locale, root),
  ]);
  if (!cards.ok || !featured.ok) return unavailable;
  const aggregate = publishedCaseAggregateSchema.safeParse({
    cards: cards.value,
    featured: featured.value,
  });
  return aggregate.success ? { ok: true, value: aggregate.data } : unavailable;
}

export const publishedCaseAggregateEndpoint: Endpoint = {
  path: '/published/:locale',
  method: 'get',
  handler: async (req) => {
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const locale = localeSchema.safeParse(req.routeParams?.locale);
    if (!locale.success) return Response.json(unavailable, { status: 404, headers });
    const root = await capturePublishedReadRoot();
    if (!root) return Response.json(unavailable, { status: 503, headers });
    const result = await getPublishedCaseAggregate(locale.data, root);
    if (!result.ok) return Response.json(result, { status: 503, headers });
    headers.set(publicGenerationHeader, root.generation);
    return Response.json(result, { headers });
  },
};
