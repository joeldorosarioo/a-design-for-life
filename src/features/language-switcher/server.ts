import 'server-only';

export { resolveEntryLocale } from './server/resolve-entry-locale';
export type { EntryLocaleInput } from './server/resolve-entry-locale';
export { setLanguagePreference } from './server/set-language-preference';
export { resolveTranslatedDestination } from './server/resolve-translated-destination';
export type { SourcePage, TranslatedDestination } from './contracts/language-control.schema';
export type {
  LanguagePreferenceContext,
  LanguagePreferenceResponse,
} from './server/set-language-preference';
