import 'server-only';
import type { PayloadRequest } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { mapProfilePresentation } from './map-profile';
const select = {
  locale: true,
  identity: true,
  home: true,
  homeProjects: true,
  listing: true,
  homeAbout: true,
  approach: true,
  about: true,
  contacts: true,
  resume: true,
  seo: true,
} as const;
export async function getPreviewProfile(
  locale: Locale,
  req: PayloadRequest,
  selectedProfileId?: string,
): Promise<Result<ProfileDTO>> {
  if (req.user?.collection !== 'users')
    return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
  const language = localeSchema.safeParse(locale);
  if (
    !language.success ||
    (selectedProfileId !== undefined && !z.uuid().safeParse(selectedProfileId).success)
  )
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview scope.' } };
  try {
    const document =
      selectedProfileId !== undefined
        ? await req.payload.findByID({
            collection: 'professional-profiles',
            id: selectedProfileId,
            draft: true,
            depth: 0,
            overrideAccess: false,
            req,
            select,
          })
        : await (async () => {
            const result = await req.payload.find({
              collection: 'professional-profiles',
              where: { locale: { equals: language.data } },
              draft: true,
              depth: 0,
              limit: 2,
              overrideAccess: false,
              req,
              select,
            });
            return result.docs.length === 1 ? result.docs[0] : undefined;
          })();
    if (!document)
      return { ok: false, error: { code: 'unavailable', message: 'Preview unavailable.' } };
    if (document.locale !== language.data)
      return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
    return { ok: true, value: mapProfilePresentation(document) };
  } catch (error) {
    const denied =
      error &&
      typeof error === 'object' &&
      'status' in error &&
      [401, 403, 404].includes(Number(error.status));
    return {
      ok: false,
      error: { code: denied ? 'forbidden' : 'unavailable', message: 'Preview unavailable.' },
    };
  }
}
