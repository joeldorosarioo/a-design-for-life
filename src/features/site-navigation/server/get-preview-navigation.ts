import 'server-only';
import type { PayloadRequest } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import type { NavigationDTO } from '../contracts/navigation-dto.schema';
import { mapNavigationPresentation } from './map-navigation';
const select = {
  locale: true,
  header: true,
  footer: true,
  controls: true,
  messages: true,
} as const;
export async function getPreviewNavigation(
  locale: Locale,
  profile: ProfileDTO,
  req: PayloadRequest,
  selectedNavigationId?: string,
): Promise<Result<NavigationDTO>> {
  if (req.user?.collection !== 'users')
    return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
  const language = localeSchema.safeParse(locale);
  if (
    !language.success ||
    (selectedNavigationId !== undefined && !z.uuid().safeParse(selectedNavigationId).success)
  )
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview scope.' } };
  try {
    const selectedProfile = profileDTOSchema.parse(profile);
    if (selectedProfile.locale !== language.data)
      return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
    const document =
      selectedNavigationId !== undefined
        ? await req.payload.findByID({
            collection: 'site-navigation',
            id: selectedNavigationId,
            draft: true,
            depth: 0,
            overrideAccess: false,
            req,
            select,
          })
        : await (async () => {
            const result = await req.payload.find({
              collection: 'site-navigation',
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
    const value = mapNavigationPresentation(document, selectedProfile);
    if (!value) throw new Error('Preview projection unavailable.');
    return { ok: true, value };
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
