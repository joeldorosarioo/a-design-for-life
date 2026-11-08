import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';

// The composition must obtain this canonical path from confirmed published data.
// A syntactically public case slug alone does not establish publication or authorization.
function isPublicPath({ locale, pagePath }: { locale: string; pagePath: string }): boolean {
  if (
    [`/${locale}`, `/${locale}/cases`, locale === 'pt' ? '/pt/sobre' : '/en/about'].includes(
      pagePath,
    )
  )
    return true;
  const match = /^\/(pt|en)\/cases\/([a-z0-9-]{1,80})$/.exec(pagePath);
  return !!match && match[1] === locale;
}
const contextShape = { locale: localeSchema, pagePath: z.string() };
const approvedName = z.enum([
  'page_view',
  'contact_email_click',
  'contact_linkedin_click',
  'resume_open',
]);
export const publicAnalyticsContextSchema = z.strictObject(contextShape).refine(isPublicPath, {
  message: 'A canonical public portfolio path matching the locale is required',
});
export const portfolioAnalyticsEventSchema = z
  .strictObject({
    name: approvedName,
    ...contextShape,
  })
  .refine(isPublicPath, {
    message: 'A canonical public portfolio path matching the locale is required',
  });

export type PublicAnalyticsContext = z.infer<typeof publicAnalyticsContextSchema>;
export type PortfolioAnalyticsEvent = z.infer<typeof portfolioAnalyticsEventSchema>;
export type AnalyticsContactPurpose = 'email' | 'linkedin' | 'resume';
