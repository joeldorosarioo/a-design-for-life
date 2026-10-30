import 'server-only';
import { randomUUID } from 'node:crypto';
import { createLocalReq, type Payload } from 'payload';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { runtimePayload } from '@/helpers/payload/runtime';
import { slugSchema } from '../contracts/slug.schema';
import { routeResolutionSchema, type RouteResolution } from '../contracts/route-resolution.schema';
const idOf = (value: string | { id: string }) => (typeof value === 'string' ? value : value.id);
export async function resolveCaseRoute(
  locale: Locale,
  slug: string,
  payload?: Payload,
): Promise<RouteResolution> {
  const language = localeSchema.parse(locale);
  if (!slugSchema.safeParse(slug).success) return { status: 404 };
  try {
    const cms = payload ?? (await runtimePayload());
    const req = await createLocalReq({}, cms);
    // Private registry is read only for classification. The public result never
    // includes ownership/reservation metadata. No mutation capability is opened.
    const route = (
      await cms.find({
        collection: 'case-routes',
        where: { and: [{ locale: { equals: language } }, { slug: { equals: slug } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
    ).docs[0];
    if (!route) return { status: 404 };
    const published = (
      await cms.find({
        collection: 'case-content',
        where: {
          and: [
            { id: { equals: idOf(route.content) } },
            { case: { equals: idOf(route.case) } },
            { locale: { equals: language } },
            { _status: { equals: 'published' } },
          ],
        },
        select: { id: true, case: true, locale: true, slug: true, title: true, summary: true },
        draft: false,
        limit: 1,
        depth: 0,
        overrideAccess: false,
        req,
      })
    ).docs[0];
    // The single published snapshot owns canonical identity. A route.state read
    // may precede a publication commit; trusting it would return a wrong body or
    // redirect backwards. Draft-only reservations stay indistinguishable from 404.
    if (published?.slug === slug)
      return routeResolutionSchema.parse({
        status: 200,
        locale: language,
        slug,
        case: { id: idOf(published.case), title: published.title, summary: published.summary },
      });
    if (!route.everPublished) return { status: 404 };
    if (!published) return { status: 410, locale: language };
    const current = slugSchema.parse(published.slug);
    return { status: 308, location: `/${language}/cases/${current}` };
  } catch {
    // Log only a correlation identifier, never database URLs or private content.
    console.error('Case route origin unavailable', { correlationId: randomUUID() });
    return { status: 503, locale: language };
  }
}
