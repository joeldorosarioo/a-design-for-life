import 'server-only';
import type { ReactNode, ComponentType } from 'react';
import { canMeasure } from '../analytics-policy';
import { analyticsTransportConfigSchema } from '../analytics-session';
import type { BrowserAnalyticsBoundaryProps } from '../contracts/composition';
import {
  publicAnalyticsContextSchema,
  type PublicAnalyticsContext,
} from '../contracts/event.schema';

export type PublicAnalyticsComposition = {
  children: ReactNode;
  verifiedPublic: boolean;
  area: string;
  preview: boolean;
  status: number;
  context: PublicAnalyticsContext;
  runtime: {
    environment: string;
    siteOrigin: string;
    analytics: null | { measurementId: string; publicSiteEnabled: boolean };
  };
};
type ClientModule = { BrowserAnalyticsBoundary: ComponentType<BrowserAnalyticsBoundaryProps> };

/** Only verified public response composition may cross this optional RSC boundary. */
export async function composePublicAnalytics(
  input: PublicAnalyticsComposition,
  loadClient: () => Promise<ClientModule> = () =>
    import('../components/browser-analytics-boundary'),
): Promise<ReactNode> {
  const { children, runtime, area, preview, status, verifiedPublic } = input;
  if (
    verifiedPublic !== true ||
    status !== 200 ||
    !canMeasure({ environment: runtime.environment, area, preview }) ||
    runtime.analytics?.publicSiteEnabled !== true
  )
    return children;
  const context = publicAnalyticsContextSchema.safeParse(input.context);
  const config = analyticsTransportConfigSchema.safeParse({
    measurementId: runtime.analytics.measurementId,
    siteOrigin: runtime.siteOrigin,
  });
  if (!context.success || !config.success) return children;
  try {
    // No client module reference is evaluated until all server gates and sanitization pass.
    const { BrowserAnalyticsBoundary } = await loadClient();
    return (
      <BrowserAnalyticsBoundary
        context={context.data}
        runtime={{
          environment: runtime.environment,
          area: 'public',
          preview: false,
          publicSiteEnabled: true,
          ...config.data,
        }}
      >
        {children}
      </BrowserAnalyticsBoundary>
    );
  } catch {
    return children;
  }
}
