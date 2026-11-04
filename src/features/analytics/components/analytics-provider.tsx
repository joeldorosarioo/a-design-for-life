'use client';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { AnalyticsSession } from '../analytics-session';
import {
  publicAnalyticsContextSchema,
  type PublicAnalyticsContext,
} from '../contracts/event.schema';

type AnalyticsValue = { session: AnalyticsSession; context: PublicAnalyticsContext } | null;
const AnalyticsContext = createContext<AnalyticsValue>(null);

export function AnalyticsProvider({
  children,
  session,
  context,
}: {
  session: AnalyticsSession | null;
  context: PublicAnalyticsContext;
  children: ReactNode;
}) {
  const parsed = publicAnalyticsContextSchema.safeParse(context);
  const locale = parsed.success ? parsed.data.locale : null;
  const pagePath = parsed.success ? parsed.data.pagePath : null;
  const value = useMemo<AnalyticsValue>(
    () => (session && locale && pagePath ? { session, context: { locale, pagePath } } : null),
    [session, locale, pagePath],
  );
  // Only committed page composition reaches this effect. The document session owns
  // deduplication so StrictMode and remounts do not reset the previous completion.
  useEffect(() => {
    value?.session.completeNavigation(value.context);
  }, [value]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function usePublicAnalytics(): AnalyticsValue {
  return useContext(AnalyticsContext);
}
