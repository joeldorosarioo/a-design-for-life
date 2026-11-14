import 'server-only';
import type { PayloadRequest } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { buildPrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { mapCasePresentation } from './map-case-detail';
const select = {
  id: true,
  case: true,
  locale: true,
  eyebrow: true,
  title: true,
  titleEmphasis: true,
  summary: true,
  introduction: true,
  cover: true,
  coverPresentation: true,
  role: true,
  scope: true,
  contextNote: true,
  sections: true,
  seo: true,
} as const;
export async function getPreviewCase(
  locale: Locale,
  contentId: string,
  req: PayloadRequest,
): Promise<Result<CaseDetailDTO>> {
  if (req.user?.collection !== 'users')
    return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
  const language = localeSchema.safeParse(locale);
  if (!language.success || !z.uuid().safeParse(contentId).success)
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview scope.' } };
  try {
    const document = await req.payload.findByID({
      collection: 'case-content',
      id: contentId,
      draft: true,
      depth: 1,
      overrideAccess: false,
      req,
      select,
    });
    if (document.locale !== language.data)
      return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
    const path = buildPrivatePreviewPath({
      locale: language.data,
      collection: 'case-content',
      id: document.id,
      page: 'case',
    });
    return { ok: true, value: mapCasePresentation(document, path) };
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
