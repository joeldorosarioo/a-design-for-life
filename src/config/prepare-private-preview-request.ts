import 'server-only';
import { authorizePreview, type PreviewContext } from '@/helpers/payload/preview-session';
import {
  parsePrivatePreviewPath,
  type PrivatePreviewScope,
} from '@/helpers/payload/private-preview-path';
export type PrivatePreviewRequestOptions = { origin: string };
export type PrivatePreviewAuthorization =
  | { ok: true; value: { scope: PrivatePreviewScope; context: PreviewContext } }
  | { ok: false; response: Response };

function failure(status: 400 | 401 | 403 | 404 | 405 | 503): PrivatePreviewAuthorization {
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (status === 405) headers.set('Allow', 'GET, HEAD');
  return { ok: false, response: new Response(null, { status, headers }) };
}
function trustedOrigin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    value.includes('?') ||
    value.includes('#') ||
    value !== value.trim()
  )
    throw new TypeError('Invalid configured preview origin.');
  return url.origin;
}

/** Server-only: Page composition must call this independently of the Proxy decision. */
export async function authorizePrivatePreviewRequest(
  request: Request,
  options: PrivatePreviewRequestOptions,
): Promise<PrivatePreviewAuthorization> {
  try {
    const url = new URL(request.url);
    if (url.pathname !== '/preview-ui' && !url.pathname.startsWith('/preview-ui/'))
      return failure(404);
    const origin = trustedOrigin(options.origin);
    let scope: PrivatePreviewScope | null = null;
    try {
      scope = parsePrivatePreviewPath(url.pathname);
    } catch {
      /* Authenticate before revealing scope errors. */
    }
    const methodAllowed = request.method === 'GET' || request.method === 'HEAD';
    const queryAllowed = [...url.searchParams.keys()].every(
      (key) => (key === 'returnTo' || key === '_rsc') && url.searchParams.getAll(key).length === 1,
    );
    // An invalid logical scope reaches Native authentication/origin checks but
    // fails validation before findByID. No visitor query may override the path.
    const logical = new URL('/preview', origin);
    logical.searchParams.set('view', '1');
    if (scope && methodAllowed && queryAllowed) {
      logical.searchParams.set('collection', scope.collection);
      logical.searchParams.set('id', scope.id);
      logical.searchParams.set('locale', scope.locale);
      if (url.searchParams.has('returnTo'))
        logical.searchParams.set('returnTo', url.searchParams.get('returnTo')!);
    }
    const authorization = await authorizePreview(
      new Request(logical, { headers: request.headers }),
    );
    if (!authorization.ok) {
      if (authorization.error.code === 'invalid-input') return failure(methodAllowed ? 400 : 405);
      return failure(authorization.error.message === 'Authentication required.' ? 401 : 403);
    }
    if (!methodAllowed) return failure(405);
    if (!scope || !queryAllowed) return failure(400);
    return { ok: true, value: { scope, context: authorization.value } };
  } catch {
    return failure(503);
  }
}
/** Proxy-facing adapter: no Native context, document or account leaves this function. */
export async function preparePrivatePreviewRequest(
  request: Request,
  options: PrivatePreviewRequestOptions,
): Promise<Response | null> {
  const authorization = await authorizePrivatePreviewRequest(request, options);
  return authorization.ok ? null : authorization.response;
}
