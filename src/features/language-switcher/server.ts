import 'server-only';

export { resolveEntryLocale } from './server/resolve-entry-locale';
export type { EntryLocaleInput } from './server/resolve-entry-locale';
export { setLanguagePreference } from './server/set-language-preference';
export type {
  LanguagePreferenceContext,
  LanguagePreferenceResponse,
} from './server/set-language-preference';
