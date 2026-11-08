import 'server-only';
import type { Payload } from 'payload';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { runtimePayload } from '@/helpers/payload/runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { getPublishedProfile } from '@/features/professional-profile/server';
import type { NavigationDTO } from '../contracts/navigation-dto.schema';
import { mapNavigation } from './map-navigation';
export async function getPublishedNavigation(
  locale: Locale,
  payload?: Payload,
): Promise<Result<NavigationDTO>> {
  const language = localeSchema.parse(locale);
  const cms = payload ?? (await runtimePayload());
  const [found, profile] = await Promise.all([
    cms.find({
      collection: 'site-navigation',
      where: { and: [{ locale: { equals: language } }, { _status: { equals: 'published' } }] },
      draft: false,
      depth: 0,
      overrideAccess: false,
      limit: 1,
    }),
    getPublishedProfile(language, cms),
  ]);
  const value = found.docs[0] && profile.ok && mapNavigation(found.docs[0], profile.value);
  return value
    ? { ok: true, value }
    : { ok: false, error: { code: 'unavailable', message: 'Published content unavailable.' } };
}
