import 'server-only';
import { headers } from 'next/headers';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { parsePrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import { readServerEnv } from './server-env';
import { readPrivatePageModel } from './read-private-page-model';

// RSC has a separate graph from Proxy. Register a lazy Native factory, without
// carrying the Proxy's authorization, model or account into this request.
installPayloadProvider(async () => {
  const [{ default: config }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ]);
  return getPayload({ config });
});

export async function readPrivatePageRequest(pathname: string, query: string) {
  parsePrivatePreviewPath(pathname);
  const env = readServerEnv(process.env);
  const incoming = await headers();
  const url = new URL(pathname, env.SITE_ORIGIN);
  url.search = query;
  return readPrivatePageModel(new Request(url, { headers: new Headers(incoming) }), {
    origin: env.SITE_ORIGIN,
  });
}
