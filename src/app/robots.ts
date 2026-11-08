import type { MetadataRoute } from 'next';
import { readServerEnv } from '@/config/server-env';
import { buildRobots } from '@/config/build-public-index';

export const dynamic = 'force-dynamic';

/** Runtime policy only: robots does not read Root, content or Native. */
export default function robots(): MetadataRoute.Robots {
  const env = readServerEnv(process.env);
  return buildRobots({
    origin: env.SITE_ORIGIN,
    indexable: env.APP_ENV === 'production',
  });
}
