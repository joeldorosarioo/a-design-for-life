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
    const subjects = confirmedCases(root);
    const document = subjects.find(
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
    const classification = await cms.find({
      collection: 'case-routes',
      where: { and: [{ locale: { equals: language } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    const route = classification.docs[0];
    const contentId = typeof route?.content === 'string' ? route.content : route?.content?.id;
    // A pinned older generation can authoritatively exclude a newer route for
    // a subject it covers. A missing subject cannot negate known public history.
    if (route?.everPublished && !subjects.some((subject) => subject.contentId === contentId))
      return { status: 503, locale: language };
    return { status: 404 };
  } catch {
    console.error('Case route origin unavailable', { correlationId: randomUUID() });
    return { status: 503, locale: language };
  }
}
