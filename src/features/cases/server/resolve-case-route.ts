import 'server-only';
import { randomUUID } from 'node:crypto';
import { createLocalReq, type Payload } from 'payload';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { runtimePayload } from '@/helpers/payload/runtime';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { slugSchema } from '../contracts/slug.schema';
import { routeResolutionSchema, type RouteResolution } from '../contracts/route-resolution.schema';
import { confirmedCases } from './case-publication';
export async function resolveCaseRoute(
  locale: Locale,
  slug: string,
  payload?: Payload,
  generation?: PublicRoot,
): Promise<RouteResolution> {
  const language = localeSchema.parse(locale);
  if (!slugSchema.safeParse(slug).success) return { status: 404 };
  try {
    const root = generation ?? (await readPublicRoot(runtimePublication().directory));
    const document = confirmedCases(root).find(
      (value) => value.locale === language && value.slugs.includes(slug),
    );
    if (document) {
      if (!document.detail || !document.slug) return { status: 410, locale: language };
      if (document.slug !== slug)
        return { status: 308, location: `/${language}/cases/${document.slug}` };
      return routeResolutionSchema.parse({
        status: 200,
        locale: language,
        slug,
        case: {
          id: document.caseId,
          title: document.detail.title,
          summary: document.detail.summary,
        },
      });
    }
    // The projection has subject coverage, not a complete negative index.
    // An independent healthy origin can prove absence. Failure is not a 404.
    const cms = payload ?? (await runtimePayload());
    const req = await createLocalReq({}, cms);
    await cms.find({
      collection: 'case-routes',
      where: { and: [{ locale: { equals: language } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    return { status: 404 };
  } catch {
    console.error('Case route origin unavailable', { correlationId: randomUUID() });
    return { status: 503, locale: language };
  }
}
