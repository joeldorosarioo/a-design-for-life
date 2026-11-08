import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { PublicRoot } from '@/helpers/payload/public-root';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { readConfirmedCaseEntries } from './get-published-cases';
export async function getPublishedCase(
  locale: Locale,
  slug: string,
  generation?: PublicRoot | null,
): Promise<Result<CaseDetailDTO>> {
  try {
    const language = localeSchema.parse(locale);
    const { cases } = await readConfirmedCaseEntries(generation);
    const confirmed = cases.find((item) => item.locale === language && item.slug === slug);
    const value = confirmed?.detail;
    if (value) {
      const cover = confirmed.media.find(
        ({ id, manifest }) => id === value.cover?.mediaId && manifest.kind === 'image',
      );
      const width = cover?.manifest.original.width;
      const height = cover?.manifest.original.height;
      return {
        ok: true,
        value: width && height ? { ...value, coverIntrinsicSize: { width, height } } : value,
      };
    }
  } catch {
    /* Missing/corrupt coverage is unavailable, never proof of absence. */
  }
  return { ok: false, error: { code: 'unavailable', message: 'Confirmed case unavailable.' } };
}
