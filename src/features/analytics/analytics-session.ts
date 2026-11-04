import { z } from 'zod';
import { canMeasure, type AnalyticsPolicyContext } from './analytics-policy';
import {
  portfolioAnalyticsEventSchema,
  publicAnalyticsContextSchema,
  type AnalyticsContactPurpose,
  type PortfolioAnalyticsEvent,
  type PublicAnalyticsContext,
} from './contracts/event.schema';

export type AnalyticsRuntime = AnalyticsPolicyContext & {
  publicSiteEnabled: boolean;
  measurementId: string | null;
  siteOrigin: string;
};
export const analyticsTransportConfigSchema = z.strictObject({
  measurementId: z.string().regex(/^G-[A-Z0-9]{4,32}$/),
  siteOrigin: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      );
    })
    .transform((value) => new URL(value).origin),
});
export type AnalyticsTransportConfig = z.infer<typeof analyticsTransportConfigSchema>;
export type AnalyticsTransport = { send(event: PortfolioAnalyticsEvent): void };

/**
 * Create once per browser document, after the composition validates the public release gate.
 * This owns no cookies/storage/listeners, and never reads a browser URL or environment.
 */
export function createAnalyticsSession({
  runtime,
  createTransport,
}: {
  runtime: AnalyticsRuntime;
  createTransport(config: AnalyticsTransportConfig): AnalyticsTransport;
}) {
  const config = analyticsTransportConfigSchema.safeParse({
    measurementId: runtime.measurementId,
    siteOrigin: runtime.siteOrigin,
  });
  const enabled = runtime.publicSiteEnabled === true && canMeasure(runtime) && config.success;
  let lastCompletedPage: string | null = null;
  let initialized = false;
  let transport: AnalyticsTransport | null = null;

  function track(event: PortfolioAnalyticsEvent): void {
    if (!enabled || !config.success) return;
    const parsed = portfolioAnalyticsEventSchema.safeParse(event);
    if (!parsed.success) return;
    const safeEvent = parsed.data;
    if (safeEvent.name === 'page_view') {
      const key = safeEvent.pagePath;
      if (lastCompletedPage === key) return;
      // Do not retry a failed send on a remount: that could have sent before throwing.
      lastCompletedPage = key;
    }
    try {
      if (!initialized) {
        initialized = true;
        transport = createTransport(config.data);
      }
      transport?.send(safeEvent);
    } catch {
      // Fail closed after any partial initialization/send failure; a later action must
      // never bypass a failed denied-consent command or retry an ambiguous send.
      transport = null;
    }
  }
  function completeNavigation(context: PublicAnalyticsContext): void {
    const parsed = publicAnalyticsContextSchema.safeParse(context);
    if (parsed.success) track({ name: 'page_view', ...parsed.data });
  }
  function trackContact(purpose: AnalyticsContactPurpose, context: PublicAnalyticsContext): void {
    const parsed = publicAnalyticsContextSchema.safeParse(context);
    if (!parsed.success) return;
    if (purpose === 'email') track({ name: 'contact_email_click', ...parsed.data });
    if (purpose === 'linkedin') track({ name: 'contact_linkedin_click', ...parsed.data });
    if (purpose === 'resume') track({ name: 'resume_open', ...parsed.data });
  }
  return { track, completeNavigation, trackContact };
}
export type AnalyticsSession = ReturnType<typeof createAnalyticsSession>;
