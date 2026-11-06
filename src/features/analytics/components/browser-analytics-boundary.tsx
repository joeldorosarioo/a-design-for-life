'use client';
import { useEffect } from 'react';
import { mountDocumentAnalytics } from '../browser/document-analytics';
import type { BrowserAnalyticsBoundaryProps } from '../contracts/composition';
import { publicAnalyticsContextSchema } from '../contracts/event.schema';

export function BrowserAnalyticsBoundary({
  children,
  runtime,
  context,
}: BrowserAnalyticsBoundaryProps) {
  const { environment, area, preview, publicSiteEnabled, measurementId, siteOrigin } = runtime;
  const parsed = publicAnalyticsContextSchema.safeParse(context);
  const locale = parsed.success ? parsed.data.locale : null;
  const pagePath = parsed.success ? parsed.data.pagePath : null;
  useEffect(() => {
    if (!locale || !pagePath) return;
    return mountDocumentAnalytics({
      document,
      runtime: { environment, area, preview, publicSiteEnabled, measurementId, siteOrigin },
      context: { locale, pagePath },
    });
  }, [environment, area, preview, publicSiteEnabled, measurementId, siteOrigin, locale, pagePath]);
  return children;
}
