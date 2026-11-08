import type { MetadataRoute } from 'next';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { readServerEnv } from '@/config/server-env';
import { buildPublicSitemap } from '@/config/build-public-index';
import { readPublicIndex } from '@/config/read-public-index';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = readServerEnv(process.env);
  const indexable = env.APP_ENV === 'production';
  if (!indexable) {
    // Explicit environment policy, not a publication-read error fallback.
    return buildPublicSitemap({
      origin: env.SITE_ORIGIN,
      indexable: false,
      pages: { pt: false, en: false },
      cases: [],
    });
  }
  const root = await readPublicRoot(publicRootDirectory(env));
  if (!root) throw new Error('Confirmed public index unavailable.');
  // A metadata handler can have its own module graph. Install only a factory;
  // complete positive Root coverage never initializes Native or reads SQL.
  installPayloadProvider(async () => {
    const [{ default: config }, { getPayload }] = await Promise.all([
      import('@payload-config'),
      import('payload'),
    ]);
    return getPayload({ config });
  });
  const index = await readPublicIndex(root);
  return buildPublicSitemap({
    origin: env.SITE_ORIGIN,
    indexable,
    pages: index.pages,
    // The builder intentionally accepts only this strict public route shape.
    cases: index.cases.map(({ caseId, locale, path }) => ({
      caseId,
      locale,
      path,
    })),
  });
}
