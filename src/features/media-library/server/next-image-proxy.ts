import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { confirmedMedia } from './public-media';
import { classifyMissingPublicMedia } from './classify-missing-public-media';

type NextImageContext = {
  publicationDirectory: string;
  internalOrigin: string;
  secret: string;
  widths?: readonly number[];
  qualities?: readonly number[];
  timeoutMs?: number;
};
const widths = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const signatureHeader = 'x-portfolio-image-authorization';
const signatureLifetime = 30;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};
function empty(status: number) {
  return new Response(null, { status, headers: privateHeaders });
}
function optimizerQuery(request: Request, context: NextImageContext) {
  const url = new URL(request.url);
  const params = url.searchParams;
  if (
    url.pathname !== '/_next/image' ||
    [...params.keys()].length !== 3 ||
    ['url', 'w', 'q'].some((name) => params.getAll(name).length !== 1)
  )
    return null;
  const source = params.get('url')!;
  const match =
    /^\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\/original$/.exec(
      source,
    );
  const width = params.get('w')!;
  const quality = params.get('q')!;
  if (
    !match ||
    !/^[1-9]\d*$/.test(width) ||
    !/^[1-9]\d*$/.test(quality) ||
    !(context.widths ?? widths).includes(Number(width)) ||
    !(context.qualities ?? [75]).includes(Number(quality))
  )
    return null;
  return { mediaId: match[1], query: `url=${encodeURIComponent(source)}&w=${width}&q=${quality}` };
}
function internalOrigin(context: NextImageContext) {
  const origin = new URL(context.internalOrigin);
  if (
    origin.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    context.secret.length < 32
  )
    throw new Error('Invalid internal image configuration');
  const timeout = context.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000)
    throw new Error('Invalid internal image timeout');
  return { origin: origin.origin, timeout };
}
function signature(secret: string, expires: number, query: string, accept: string) {
  return createHmac('sha256', secret)
    .update(`portfolio-next-image-v1\n${expires}\nGET\n${query}\n${accept}`)
    .digest();
}
function trustedInner(request: Request, context: NextImageContext, query: string, accept: string) {
  const provided = request.headers.get(signatureHeader);
  if (!provided) return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(provided);
  const now = Math.floor(Date.now() / 1000);
  if (
    request.method !== 'GET' ||
    !match ||
    Number(match[1]) < now ||
    Number(match[1]) > now + signatureLifetime
  )
    return false;
  return timingSafeEqual(
    Buffer.from(match[2], 'hex'),
    signature(context.secret, Number(match[1]), query, accept),
  );
}

/** null permits only an authenticated inner GET to enter Next's default optimizer. */
export async function handleNextImage(
  request: Request,
  context: NextImageContext,
): Promise<Response | null> {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') return empty(405);
    const parsed = optimizerQuery(request, context);
    if (!parsed) return empty(400);
    const internal = internalOrigin(context);
    const root = await readPublicRoot(context.publicationDirectory);
    const manifest = confirmedMedia(root).find((media) => media.id === parsed.mediaId)?.manifest;
    if (!manifest) return empty(await classifyMissingPublicMedia(parsed.mediaId, root));
    if (
      manifest.kind !== 'image' ||
      manifest.original.variant !== 'original' ||
      !imageTypes.has(manifest.original.type)
    )
      return empty(404);
    const accept = request.headers.get('accept') ?? '';
    if (accept.length > 4096) return empty(400);
    if (request.headers.has(signatureHeader)) {
      return trustedInner(request, context, parsed.query, accept) ? null : empty(404);
    }
    const expires = Math.floor(Date.now() / 1000) + signatureLifetime;
    const upstream = await fetch(`${internal.origin}/_next/image?${parsed.query}`, {
      method: 'GET',
      headers: {
        Accept: accept,
        [signatureHeader]: `${expires}.${signature(context.secret, expires, parsed.query, accept).toString('hex')}`,
      },
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(internal.timeout)]),
    });
    if (upstream.status !== 200) {
      await upstream.body?.cancel();
      return empty([400, 401, 403, 404].includes(upstream.status) ? upstream.status : 503);
    }
    const type = upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!type || !imageTypes.has(type)) {
      await upstream.body?.cancel();
      return empty(503);
    }
    // Consume inside the timeout: an incomplete body must produce 503 before any bytes escape.
    const bytes = await upstream.arrayBuffer();
    const headers = new Headers(privateHeaders);
    headers.set('Content-Type', type);
    headers.set('Vary', 'Accept');
    for (const name of [
      'etag',
      'content-disposition',
      'content-security-policy',
      'x-nextjs-cache',
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // fetch can decode content; do not copy Content-Encoding or the encoded Content-Length.
    return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers });
  } catch {
    return empty(503);
  }
}
