import 'server-only';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import type { RouteResolution } from '../contracts/route-resolution.schema';
import { resolveCaseRoute } from './resolve-case-route';
function escapeHTML(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
export function renderCaseRouteResponse(
  resolution: RouteResolution,
  requestedLocale: 'pt' | 'en' = 'pt',
): Response {
  // A permanent redirect may later be reversed by explicitly reusing owned
  // history. No browser/shared cache may keep a previously emitted A -> B.
  const headers = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  if (resolution.status === 308) {
    headers.set('Location', resolution.location);
    return new Response(null, { status: 308, headers });
  }
  const locale = 'locale' in resolution ? resolution.locale : requestedLocale;
  const english = locale === 'en';
  const title =
    resolution.status === 200
      ? resolution.case.title
      : resolution.status === 404
        ? english
          ? 'Case not found'
          : 'Case não encontrado'
        : english
          ? 'Case unavailable'
          : 'Case indisponível';
  const summary = resolution.status === 200 ? `<p>${escapeHTML(resolution.case.summary)}</p>` : '';
  const robots =
    resolution.status === 200 ? '' : '<meta name="robots" content="noindex, nofollow">';
  if (resolution.status !== 200) headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (resolution.status === 503) headers.set('Retry-After', '60');
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title>${robots}</head><body><main><h1>${escapeHTML(title)}</h1>${summary}<nav aria-label="${english ? 'Continue browsing' : 'Continue navegando'}"><a href="/${locale}/cases">${english ? 'Projects' : 'Projetos'}</a> <a href="/${locale}#contact">${english ? 'Contact' : 'Contato'}</a></nav></main></body></html>`;
  return new Response(html, { status: resolution.status, headers });
}
export async function caseRouteResponse(locale: string, slug: string): Promise<Response> {
  const language = localeSchema.safeParse(locale);
  return renderCaseRouteResponse(
    language.success ? await resolveCaseRoute(language.data, slug) : { status: 404 },
    language.success ? language.data : 'pt',
  );
}
