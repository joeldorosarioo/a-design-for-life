import '@payload-config';
import { authorizePreview } from '@/helpers/payload/preview-session';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
function escapeHTML(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizePreview(request);
  if (!authorization.ok) {
    const invalid = authorization.error.code === 'invalid-input';
    return Response.json(
      { error: invalid ? 'Invalid preview request.' : 'Preview unavailable.' },
      {
        status: invalid
          ? 400
          : authorization.error.message === 'Authentication required.'
            ? 401
            : 403,
        headers,
      },
    );
  }
  const { collection, id, locale, document, returnTo, payload } = authorization.value;
  if (!new URL(request.url).searchParams.has('view')) {
    const query = new URLSearchParams({ collection, id, locale, view: '1' });
    if (returnTo) query.set('returnTo', returnTo);
    return new Response(null, {
      status: 307,
      headers: {
        ...headers,
        Location: new URL(`/preview?${query}`, payload.config.serverURL).href,
      },
    });
  }
  // Contract preview only. Full portfolio presentation belongs to stage 2.
  const title =
    document.title ?? (collection === 'site-navigation' ? 'Navegação' : 'Perfil profissional');
  const summary = document.summary ?? '';
  const back = returnTo
    ? `<a href="${escapeHTML(returnTo)}">${locale === 'en' ? 'Back' : 'Voltar'}</a>`
    : '';
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title></head><body><main><h1>${escapeHTML(title)}</h1><p>${escapeHTML(summary)}</p>${back}</main></body></html>`;
  return new Response(html, {
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}
