import { expect, test } from '@playwright/test';

function expectPrivateUncachedResponse(headers: Record<string, string>) {
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['set-cookie']).toBeUndefined();
  expect(headers.etag).toBeUndefined();
  expect(
    Object.keys(headers).some(
      (name) =>
        name.startsWith('x-portfolio-render-') ||
        name.startsWith('x-middleware-request-x-portfolio-render-'),
    ),
  ).toBe(false);
}

// No seed is required: an unknown supported-locale path is 404 independently of
// published content, FS coverage or the Native origin's health.
for (const locale of ['pt', 'en'] as const) {
  test(`${locale}: unknown one-segment and deep pages retain localized 404 for HTML, HEAD and Flight`, async ({
    request,
  }) => {
    const title = locale === 'pt' ? 'Página não encontrada' : 'Page not found';
    const otherTitle = locale === 'pt' ? 'Page not found' : 'Página não encontrada';
    const otherLocale = locale === 'pt' ? 'en' : 'pt';
    for (const pathname of [`/${locale}/not-a-public-page`, `/${locale}/not-a-public-page/deep`]) {
      for (const flight of [false, true]) {
        for (const method of ['GET', 'HEAD'] as const) {
          const options = {
            method,
            maxRedirects: 0,
            headers: {
              Cookie: `portfolio_locale=${otherLocale}`,
              'Accept-Language': otherLocale,
              'If-None-Match': '*',
              'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT',
              'x-portfolio-render-context': 'FORGED',
              ...(flight ? { RSC: '1' } : {}),
            },
          };
          let response = await request.fetch(pathname, options);
          if (flight) {
            // Next 16 validates the RSC cache key against router headers. With
            // none of those headers, the valid key is the empty, present _rsc
            // parameter. The intentionally missing key receives one canonical
            // redirect; it must never negotiate a locale or change the path.
            expect(response.status(), `${method} ${pathname} Flight canonicalization`).toBe(307);
            const redirectHeaders = response.headers();
            expectPrivateUncachedResponse(redirectHeaders);
            expect(await response.body()).toHaveLength(0);
            expect(redirectHeaders.location).toBeDefined();
            const originalUrl = new URL(response.url());
            const flightUrl = new URL(redirectHeaders.location, originalUrl);
            expect(flightUrl.origin).toBe(originalUrl.origin);
            expect(flightUrl.pathname).toBe(pathname);
            expect(flightUrl.hash).toBe('');
            expect([...flightUrl.searchParams.entries()]).toEqual([['_rsc', '']]);
            response = await request.fetch(flightUrl.href, options);
          }
          expect(response.status(), `${method} ${pathname} Flight=${flight}`).toBe(404);
          const headers = response.headers();
          expectPrivateUncachedResponse(headers);
          expect(headers.location).toBeUndefined();
          expect(headers['content-type']).toContain(flight ? 'text/x-component' : 'text/html');
          if (method === 'HEAD') {
            expect(await response.body()).toHaveLength(0);
          } else {
            const body = await response.text();
            expect(body).toContain(title);
            expect(body).not.toContain(otherTitle);
            expect(body).not.toContain('FORGED');
            if (!flight) {
              expect(body).toMatch(new RegExp(String.raw`<html\b[^>]*\slang="${locale}"(?=[\s>])`));
              expect(body).toContain(`<title>${title}</title>`);
              expect(body).toContain('name="robots" content="noindex, nofollow"');
            }
          }
        }
      }
    }
  });
}
