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
    const value = cases.find((item) => item.locale === language && item.slug === slug)?.detail;
    if (value) return { ok: true, value };
  } catch {
    /* Missing/corrupt coverage is unavailable, never proof of absence. */
  }
  return { ok: false, error: { code: 'unavailable', message: 'Confirmed case unavailable.' } };
}
