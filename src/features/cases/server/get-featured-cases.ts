import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { PublicRoot } from '@/helpers/payload/public-root';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { caseCardDTOSchema, type CaseCardDTO } from '../contracts/case-dto.schema';
import { readConfirmedCaseEntries } from './get-published-cases';
export async function getFeaturedCases(
  locale: Locale,
  generation?: PublicRoot | null,
): Promise<Result<CaseCardDTO[]>> {
  try {
    const language = localeSchema.parse(locale);
    const { cases, orders } = await readConfirmedCaseEntries(generation);
    return {
      ok: true,
      value: cases
        .filter(
          (item) => item.locale === language && item.detail && orders.get(item.caseId)!.featured,
        )
        .map((item) => caseCardDTOSchema.parse(item.detail)),
    };
  } catch {
    return {
      ok: false,
      error: { code: 'unavailable', message: 'Confirmed highlights unavailable.' },
    };
  }
}
