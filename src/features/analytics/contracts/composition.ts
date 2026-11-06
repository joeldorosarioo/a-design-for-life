import type { ReactNode } from 'react';
import type { AnalyticsRuntime } from '../analytics-session';
import type { PublicAnalyticsContext } from './event.schema';
export type BrowserAnalyticsBoundaryProps = {
  runtime: AnalyticsRuntime;
  context: PublicAnalyticsContext;
  children: ReactNode;
};
