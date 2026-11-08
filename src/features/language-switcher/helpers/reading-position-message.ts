import type { Locale } from '@/helpers/i18n/locale.schema';

const technicalMessages = {
  pt: 'Este trecho não tem equivalente neste idioma. A leitura foi reposicionada.',
  en: 'This passage has no equivalent in this language. The reading position was adjusted.',
} satisfies Record<Locale, string>;

export function readingPositionMessage(locale: Locale, editorial?: string | null): string {
  return editorial?.trim() ? editorial : technicalMessages[locale];
}
