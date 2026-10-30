import 'server-only';

import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { negotiateLocale } from '@/helpers/i18n/negotiate-locale';

export type EntryLocaleInput = {
  savedLocale: string | null;
  acceptLanguage: string | null;
};

/** Only for entry at `/`; explicit localized URLs must bypass negotiation. */
export function resolveEntryLocale({ savedLocale, acceptLanguage }: EntryLocaleInput): Locale {
  const saved = localeSchema.safeParse(savedLocale);
  return saved.success ? saved.data : negotiateLocale(acceptLanguage);
}
