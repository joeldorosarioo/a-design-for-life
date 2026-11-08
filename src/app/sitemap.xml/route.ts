import { buildPublicSitemap, renderPublicSitemap } from '@/config/build-public-index';
import { readPublicSitemap } from '@/config/read-public-index';
import { readServerEnv } from '@/config/server-env';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { installPayloadProvider } from '@/helpers/payload/runtime';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const env = readServerEnv(process.env);
  const headers = new Headers({ 'Cache-Control': 'no-store, max-age=0' });
  const unavailable = () => {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('Retry-After', '60');
    return new Response(null, { status: 503, headers });
  };
  try {
    let xml: string;
    if (env.APP_ENV !== 'production') {
      xml = renderPublicSitemap(
        buildPublicSitemap({
          origin: env.SITE_ORIGIN,
          indexable: false,
          pages: { pt: false, en: false },
          cases: [],
        }),
      );
    } else {
      const root = await readPublicRoot(publicRootDirectory(env));
      if (!root) return unavailable();
      // A complete Root never initializes Native or reads SQL.
      installPayloadProvider(async () => {
        const [{ default: config }, { getPayload }] = await Promise.all([
          import('@payload-config'),
          import('payload'),
        ]);
        return getPayload({ config });
      });
      xml = await readPublicSitemap(root, env.SITE_ORIGIN);
      headers.set(publicGenerationHeader, root.generation);
    }
    headers.set('Content-Type', 'application/xml');
    return new Response(xml, { headers });
  } catch {
    return unavailable();
  }
}
