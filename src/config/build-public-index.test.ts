import { expect, it } from 'vitest';
import { buildPublicSitemap, buildRobots, type PublicIndexInput } from './build-public-index';

const origin = 'https://synthetic-portfolio.example.invalid';
const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const source: PublicIndexInput = {
  origin,
  indexable: true,
  pages: { pt: true, en: true },
  cases: [
    { caseId: first, locale: 'pt', path: '/pt/cases/nome-publicado' },
    { caseId: first, locale: 'en', path: '/en/cases/published-name' },
    // The English translation of this identity is a private draft, absent from the source.
    { caseId: second, locale: 'pt', path: '/pt/cases/somente-portugues' },
  ],
};
it('advertises only confirmed translations and their own language-specific canonical paths', () => {
  const sitemap = buildPublicSitemap(source);
  expect(sitemap.map((item) => item.url)).toEqual([
    `${origin}/pt`,
    `${origin}/pt/cases`,
    `${origin}/pt/sobre`,
    `${origin}/en`,
    `${origin}/en/cases`,
    `${origin}/en/about`,
    `${origin}/en/cases/published-name`,
    `${origin}/pt/cases/nome-publicado`,
    `${origin}/pt/cases/somente-portugues`,
  ]);
  expect(sitemap.find((item) => item.url.endsWith('/pt/cases/somente-portugues'))).toEqual({
    url: `${origin}/pt/cases/somente-portugues`,
    alternates: { languages: { pt: `${origin}/pt/cases/somente-portugues` } },
  });
  expect(sitemap.find((item) => item.url.endsWith('/en/cases/published-name'))).toEqual({
    url: `${origin}/en/cases/published-name`,
    alternates: {
      languages: {
        pt: `${origin}/pt/cases/nome-publicado`,
        en: `${origin}/en/cases/published-name`,
      },
    },
  });
  expect(JSON.stringify(sitemap)).not.toContain('/en/cases/somente-portugues');
  expect(JSON.stringify(sitemap)).not.toContain('lastModified');
});
it('omits unpublished structural pages without hiding an independently confirmed case', () => {
  const sitemap = buildPublicSitemap({ ...source, pages: { pt: false, en: false } });
  expect(sitemap).toHaveLength(3);
  expect(sitemap.every((item) => /\/(pt|en)\/cases\//.test(item.url))).toBe(true);
});
it('limits structural alternates to the locales with confirmed profile and navigation', () => {
  const sitemap = buildPublicSitemap({ ...source, pages: { pt: true, en: false }, cases: [] });
  expect(sitemap).toEqual([
    { url: `${origin}/pt`, alternates: { languages: { pt: `${origin}/pt` } } },
    { url: `${origin}/pt/cases`, alternates: { languages: { pt: `${origin}/pt/cases` } } },
    { url: `${origin}/pt/sobre`, alternates: { languages: { pt: `${origin}/pt/sobre` } } },
  ]);
});
it('returns no sitemap entries outside the indexable public production surface', () => {
  expect(buildPublicSitemap({ ...source, indexable: false })).toEqual([]);
  expect(buildRobots({ origin, indexable: false })).toEqual({
    rules: { userAgent: '*', disallow: '/' },
  });
});
it('advertises the configured sitemap only for public production and excludes private entry points', () => {
  expect(buildRobots({ origin, indexable: true })).toEqual({
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/preview',
        '/preview-ui/',
        '/preview-media/',
        '/language-preference',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  });
});
it.each([
  'javascript:alert(1)',
  'https://user:password@example.invalid',
  'https://example.invalid/nested',
  'https://example.invalid/?q=1',
  'https://example.invalid/#fragment',
])('rejects an untrusted non-origin configuration %s', (invalid) => {
  expect(() => buildPublicSitemap({ ...source, origin: invalid })).toThrow();
  expect(() => buildRobots({ origin: invalid, indexable: true })).toThrow();
});
it.each([
  '/en/cases/wrong-locale',
  '/pt/cases/old?query=1',
  '/preview-ui/pt/case-content/private/case',
  '//outside.invalid/path',
  '/pt/cases/Uppercase',
  '/pt/about',
])('rejects paths outside the confirmed locale case contract %s', (invalid) => {
  expect(() =>
    buildPublicSitemap({ ...source, cases: [{ caseId: first, locale: 'pt', path: invalid }] }),
  ).toThrow();
});
it('rejects ambiguous identity/locale and duplicate canonical paths rather than guessing an alternate', () => {
  expect(() =>
    buildPublicSitemap({
      ...source,
      cases: [...source.cases, { caseId: first, locale: 'pt', path: '/pt/cases/ambiguous' }],
    }),
  ).toThrow();
  expect(() =>
    buildPublicSitemap({
      ...source,
      cases: [...source.cases, { caseId: second, locale: 'en', path: '/en/cases/published-name' }],
    }),
  ).toThrow();
});
