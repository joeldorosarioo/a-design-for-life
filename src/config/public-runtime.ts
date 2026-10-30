import 'server-only';
import type { ServerEnv } from './server-env';

export function readPublicRuntime(env: ServerEnv) {
  return {
    siteOrigin: env.SITE_ORIGIN,
    environment: env.APP_ENV,
    analytics: null,
  };
}

export type PublicRuntime = ReturnType<typeof readPublicRuntime>;
