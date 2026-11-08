// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { navigationPtFixture, navigationEnFixture } from '../../../../testing/fixtures/content';
import { renderCaseRouteResponse } from './case-route-response';
import {
  caseStatePresentationSchema,
  type CaseStatePresentation,
} from '../contracts/case-state-presentation.schema';
const locales = ['pt', 'en'] as const;
const statuses = [404, 410, 503] as const;
function presentation(locale: 'pt' | 'en', status: 404 | 410 | 503): CaseStatePresentation {
  return caseStatePresentationSchema.parse({
    locale,
    status,
    title: `${locale} EDITORIAL ${status}`,
    description: `${locale} EDITORIAL DESCRIPTION`,
    navigation: locale === 'pt' ? navigationPtFixture : navigationEnFixture,
  });
}
for (const locale of locales)
  for (const status of statuses) {
    it(`renders confirmed ${locale}/${status} copy, four destinations and current footer contact without an App Page`, async () => {
      const value = presentation(locale, status);
      const response = renderCaseRouteResponse(
        status === 404 ? { status } : { status, locale },
        locale,
        value,
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      if (status === 503) expect(response.headers.get('retry-after')).toBe('60');
      const html = await response.text();
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.documentElement.lang).toBe(locale);
      expect(document.querySelector('main h1')?.textContent).toBe(value.title);
      expect(document.querySelector('main p')?.textContent).toBe(value.description);
      expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBe(
        '/_portfolio/case-state.css',
      );
      expect(
        Array.from(document.querySelectorAll('header nav a')).map((link) =>
          link.getAttribute('href'),
        ),
      ).toEqual(value.navigation.items.map((item) => item.destination.href));
      expect(document.querySelector('footer #contact')?.getAttribute('tabindex')).toBe('-1');
      expect(document.querySelector('main a[href="#contact"]')?.textContent).toBe(
        value.navigation.items[3].label,
      );
      expect(document.querySelector('footer a[href^="mailto:"]')?.getAttribute('href')).toBe(
        `mailto:${value.navigation.contacts.email}`,
      );
      expect(document.querySelector('footer a[href^="https:"]')?.getAttribute('href')).toBe(
        value.navigation.contacts.linkedin,
      );
      const resumes = Array.from(document.querySelectorAll('a[target="_blank"]'));
      expect(resumes).toHaveLength(2);
      for (const link of resumes) {
        expect(link.getAttribute('href')).toBe(value.navigation.items[2].destination.href);
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.getAttribute('aria-label')).toContain(value.navigation.controls.newTabLabel);
      }
      expect(
        document.querySelector('script,link[rel="canonical"],link[rel="alternate"]'),
      ).toBeNull();
      expect(html).not.toMatch(/_next\/|x-portfolio-render|__next|originalSlug/);
    });
  }
it.each(locales)(
  'keeps unknown/private404 bodies and contractual headers identical for the same %s presentation',
  async (locale) => {
    const value = presentation(locale, 404);
    const unknown = renderCaseRouteResponse({ status: 404 }, locale, value);
    const privateState = renderCaseRouteResponse({ status: 404 }, locale, value);
    expect(await unknown.text()).toBe(await privateState.text());
    expect([...unknown.headers]).toEqual([...privateState.headers]);
  },
);
it('escapes all editorial text and attribute boundaries, including header/footer labels', async () => {
  const value = presentation('pt', 404);
  value.title = '<script>PRIVATE TITLE</script>';
  value.description = '<img src=x onerror="alert(1)"> & description';
  value.navigation.brand.label = 'Brand " onclick="alert(1)';
  value.navigation.footer.title = '<script>FOOTER</script>';
  const html = await renderCaseRouteResponse({ status: 404 }, 'pt', value).text();
  const document = new DOMParser().parseFromString(html, 'text/html');
  expect(document.querySelector('script,[onclick],[onerror]')).toBeNull();
  expect(document.querySelector('h1')?.textContent).toBe(value.title);
  expect(document.querySelector('main p')?.textContent).toBe(value.description);
  expect(document.querySelector('footer h2')?.textContent).toBe(value.navigation.footer.title);
  expect(html).toContain('&lt;script&gt;PRIVATE TITLE&lt;/script&gt;');
});
it('falls back byte-for-byte to A1 for malformed, mismatched or absent presentation', async () => {
  const legacy = await renderCaseRouteResponse({ status: 404 }, 'pt').text();
  const pt = presentation('pt', 404);
  const malformed = {
    ...pt,
    originalSlug: 'PRIVATE REQUEST PATH',
    token: 'FORGED HMAC',
  } as unknown as CaseStatePresentation;
  const unsafe = {
    ...pt,
    navigation: {
      ...pt.navigation,
      items: pt.navigation.items.map((item, index) =>
        index === 0
          ? { ...item, destination: { kind: 'page', href: 'javascript:alert(1)' } }
          : item,
      ),
    },
  } as unknown as CaseStatePresentation;
  for (const value of [
    null,
    undefined,
    presentation('en', 404),
    presentation('pt', 410),
    malformed,
    unsafe,
  ])
    expect(await renderCaseRouteResponse({ status: 404 }, 'pt', value).text()).toBe(legacy);
});
it('does not alter a positive body or redirect when the optional state presentation is supplied', async () => {
  const success = {
    status: 200,
    locale: 'pt',
    slug: 'confirmed',
    case: {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Confirmed title',
      summary: 'Confirmed summary',
    },
  } as const;
  expect(await renderCaseRouteResponse(success, 'pt', presentation('pt', 404)).text()).toBe(
    await renderCaseRouteResponse(success, 'pt').text(),
  );
  const redirect = renderCaseRouteResponse(
    { status: 308, location: '/pt/cases/current' },
    'pt',
    presentation('pt', 404),
  );
  expect(redirect.status).toBe(308);
  expect(redirect.headers.get('location')).toBe('/pt/cases/current');
  expect(await redirect.text()).toBe('');
});
