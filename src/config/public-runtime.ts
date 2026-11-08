import 'server-only';
import type { ServerEnv } from './server-env';

export function readPublicRuntime(env: ServerEnv) {
  return {
    siteOrigin: env.SITE_ORIGIN,
    environment: env.APP_ENV,
    analytics:
      env.APP_ENV === 'production' && env.PUBLIC_SITE_ENABLED === 'true' && env.GA4_MEASUREMENT_ID
        ? { measurementId: env.GA4_MEASUREMENT_ID, publicSiteEnabled: true as const }
        : null,
  };
}
export type PublicRuntime = ReturnType<typeof readPublicRuntime>;
