import { expect, it } from 'vitest';
import { renderCaseRouteResponse } from './case-route-response';
it('emits permanent redirects with no storage so reusing own history cannot retain A to B', async () => {
  const response = renderCaseRouteResponse({ status: 308, location: '/pt/cases/current' });
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('/pt/cases/current');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it.each([410, 503] as const)(
  'preserves %s with localized safe HTML, links and no indexing',
  async (status) => {
    const response = renderCaseRouteResponse({ status, locale: 'pt' });
    expect(response.status).toBe(status);
    const html = await response.text();
    expect(html).toContain('Case indisponível');
    expect(html).toContain('href="/pt/cases"');
    expect(html).toContain('href="/pt#contact"');
    expect(html).toContain('content="noindex, nofollow"');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toContain('no-store');
    if (status === 503) expect(response.headers.get('retry-after')).toBe('60');
  },
);
it('escapes public editorial text at the HTML boundary', async () => {
  const response = renderCaseRouteResponse({
    status: 200,
    locale: 'en',
    slug: 'current',
    case: { id: crypto.randomUUID(), title: '<script>alert(1)</script>', summary: 'A & B' },
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});
it('localizes a404 from request locale without distinguishing private reservations', async () => {
  const response = renderCaseRouteResponse({ status: 404 }, 'en');
  expect(await response.text()).toContain('<html lang="en">');
});

it('renders the Portuguese404 message as valid Unicode', async () => {
  const response = renderCaseRouteResponse({ status: 404 }, 'pt');
  expect(await response.text()).toContain('Case n\u00e3o encontrado');
});
