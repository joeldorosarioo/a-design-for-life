import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';

export const sourcePageSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('home') }),
  z.strictObject({ kind: z.literal('cases') }),
  z.strictObject({ kind: z.literal('about') }),
  z.strictObject({ kind: z.literal('case'), caseId: z.uuid() }),
]);
export type SourcePage = z.infer<typeof sourcePageSchema>;
export type TranslatedDestination =
  { kind: 'equivalent'; href: string } | { kind: 'case-missing'; href: string };
export type ReadingPage = {
  locale: z.infer<typeof localeSchema>;
  sourcePage: SourcePage;
  pathname: string;
  status?: 200 | 404 | 410 | 503;
};
export type LanguageToggleProps = ReadingPage & {
  destination: TranslatedDestination | { kind: 'unavailable' };
  labels: {
    languageLabel: string;
    caseMissing: string;
    readingPositionAdjusted: string;
    failure: string;
  };
};
