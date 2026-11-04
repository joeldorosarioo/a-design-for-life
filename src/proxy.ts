import { createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { handleNextImage } from '@/features/media-library/server';
import { renderCaseRouteResponse } from '@/features/cases/server';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { readServerEnv, resolveInternalHttpOrigin } from './config/server-env';
import { preparePublicRenderRequest } from './config/public-render-context';
import { readPrivatePageModel } from './config/read-private-page-model';

// Proxy has its own module graph. Register only a lazy factory here; known
// confirmed roots/manifests never load Payload config or initialize its DB.
installPayloadProvider(async () => {
  const [{ default: config }, { getPayload }] = await Promise.all([
    import('./payload.config'),
    import('payload'),
  ]);
  return getPayload({ config });
});

function responseHeaders(status: number, privateResponse = false) {
  const headers = new Headers({
    'Cache-Control': privateResponse ? 'private, no-store' : 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  if ([404, 410, 503].includes(status)) headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (status === 503) headers.set('Retry-After', '60');
  return headers;
}

export async function proxy(request: NextRequest): Promise<Response> {
  try {
    const env = readServerEnv(process.env);
    const pathname = new URL(request.url).pathname;
    if (pathname === '/preview-ui' || pathname.startsWith('/preview-ui/')) {
      const result = await readPrivatePageModel(request, { origin: env.SITE_ORIGIN });
      if (!result.ok) return result.response;
      // Validate the complete authorized presentation before RSC can stream.
      // The Page reauthenticates independently and never consumes this model.
      return NextResponse.next({
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }
    const publicationDirectory = publicRootDirectory(env);
    if (new URL(request.url).pathname === '/_next/image') {
      const internalOrigin = resolveInternalHttpOrigin(env);
      if (!internalOrigin)
        return new Response(null, { status: 503, headers: responseHeaders(503, true) });
      const response = await handleNextImage(request, {
        publicationDirectory,
        internalOrigin,
        secret: createHmac('sha256', env.PAYLOAD_SECRET)
          .update('portfolio-next-image-key-v1')
          .digest('hex'),
      });
      return response ?? NextResponse.next();
    }
    const decision = await preparePublicRenderRequest(request, {
      publicationDirectory,
      secret: env.PAYLOAD_SECRET,
    });
    if (!decision) return NextResponse.next();
    if ('caseStateLocale' in decision) {
      const response = renderCaseRouteResponse(
        decision.status === 404
          ? { status: 404 }
          : { status: decision.status, locale: decision.caseStateLocale },
        decision.caseStateLocale,
        decision.caseStatePresentation,
      );
      if (decision.generation) response.headers.set(publicGenerationHeader, decision.generation);
      return request.method === 'HEAD'
        ? new Response(null, { status: response.status, headers: response.headers })
        : response;
    }
    const headers = responseHeaders(decision.status);
    if (decision.generation) headers.set(publicGenerationHeader, decision.generation);
    if (decision.status === 308) {
      headers.set('Location', new URL(decision.location, env.SITE_ORIGIN).href);
      return new Response(null, { status: 308, headers });
    }
    if (decision.status === 405) {
      headers.set('Allow', 'GET, HEAD');
      return new Response(null, { status: 405, headers });
    }
    return NextResponse.next({
      status: decision.status,
      headers,
      request: { headers: decision.requestHeaders },
    });
  } catch {
    return new Response(null, { status: 503, headers: responseHeaders(503, true) });
  }
}
export const config = {
  matcher: ['/pt/:path*', '/en/:path*', '/_next/image', '/preview-ui/:path*'],
};
