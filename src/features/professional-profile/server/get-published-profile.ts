import 'server-only';
import type { Payload } from 'payload';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { runtimePayload } from '@/helpers/payload/runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { mapProfile } from './map-profile';
export async function getPublishedProfile(
  locale: Locale,
  payload?: Payload,
): Promise<Result<ProfileDTO>> {
  const language = localeSchema.parse(locale);
  const cms = payload ?? (await runtimePayload());
  const found = await cms.find({
    collection: 'professional-profiles',
    where: { and: [{ locale: { equals: language } }, { _status: { equals: 'published' } }] },
    draft: false,
    depth: 0,
    overrideAccess: false,
    limit: 1,
  });
  const value = found.docs[0] && mapProfile(found.docs[0]);
  return value
    ? { ok: true, value }
    : { ok: false, error: { code: 'unavailable', message: 'Published content unavailable.' } };
}
