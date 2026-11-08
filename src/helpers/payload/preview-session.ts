import 'server-only';
import { createLocalReq, type Payload, type PayloadRequest } from 'payload';
import { z } from 'zod';
import { runtimePayload } from './runtime';
import type { Result } from './editorial-result.schema';

const scopeSchema = z.object({
  collection: z.enum(['case-content', 'site-navigation', 'professional-profiles']),
  id: z.uuid(),
  locale: z.enum(['pt', 'en']),
});
export type PreviewScope = z.infer<typeof scopeSchema>;
export type PreviewContext = PreviewScope & {
  payload: Payload;
  req: PayloadRequest;
  document: Record<string, unknown>;
  returnTo: string | null;
};

function safeReturnPath(value: string | null): string | null {
  if (value === null) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error('Invalid return path');
  }
  // Reject ambiguous encoding, protocol-relative paths, controls and backslashes.
  if (
    !/^\/(?:pt|en)(?:\/[^?#]*)?(?:#[^?]*)?$/.test(value) ||
    /[\\\u0000-\u0020\u007f%]/.test(decoded) ||
    decoded.includes('//') ||
    decoded !== value
  )
    throw new Error('Invalid return path');
  return value;
}

export async function authorizePreview(request: Request): Promise<Result<PreviewContext>> {
  const payload = await runtimePayload();
  const session = await payload.auth({ headers: request.headers });
  if (!session.user || session.user.collection !== 'users')
    return { ok: false, error: { code: 'forbidden', message: 'Authentication required.' } };
  const url = new URL(request.url);
  const trustedOrigin = payload.config.serverURL;
  const origin = request.headers.get('origin');
  // Next can construct request.url with an internal listener host. Native CSRF
  // and the configured public origin are the trust anchors, never Host/Forwarded.
  if (
    (origin && origin !== trustedOrigin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
  const parsed = scopeSchema.safeParse(Object.fromEntries(url.searchParams));
  let returnTo: string | null;
  try {
    returnTo = safeReturnPath(url.searchParams.get('returnTo'));
  } catch {
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview destination.' } };
  }
  if (!parsed.success || (url.searchParams.has('view') && url.searchParams.get('view') !== '1'))
    return { ok: false, error: { code: 'invalid-input', message: 'Invalid preview scope.' } };
  const req = await createLocalReq(
    { user: session.user, req: { headers: request.headers } },
    payload,
  );
  const { collection, id, locale } = parsed.data;
  try {
    const document = await payload.findByID({
      collection,
      id,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    if (document.locale !== locale) {
      return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
    }
    return {
      ok: true,
      value: {
        ...parsed.data,
        payload,
        req,
        document: document as unknown as Record<string, unknown>,
        returnTo,
      },
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'status' in error &&
      (error.status === 404 || error.status === 403 || error.status === 401)
    ) {
      return { ok: false, error: { code: 'forbidden', message: 'Preview unavailable.' } };
    }
    throw error;
  }
}

export function nativePreviewURL(
  collection: PreviewScope['collection'],
  document: Record<string, unknown>,
): string | null {
  const scope = scopeSchema.safeParse({ collection, id: document.id, locale: document.locale });
  if (!scope.success) return null;
  return `/preview?${new URLSearchParams(scope.data)}`;
}
