import 'server-only';
import type { MetadataRoute } from 'next';
import { z } from 'zod';
import { slugSchema } from '@/features/cases';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import type { Locale } from '@/helpers/i18n/locale.schema';

export type PublicIndexInput = {
  origin: string;
  indexable: boolean;
  pages: Record<Locale, boolean>;
  cases: readonly { caseId: string; locale: Locale; path: string }[];
};
const locales = ['pt', 'en'] as const;
const inputSchema = z.strictObject({
  origin: z.string(),
  indexable: z.boolean(),
  pages: z.strictObject({ pt: z.boolean(), en: z.boolean() }),
  cases: z.array(z.strictObject({ caseId: z.uuid(), locale: localeSchema, path: z.string() })),
});
function configuredOrigin(value: string): string {
  const parsed = new URL(value);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    value.includes('?') ||
    value.includes('#') ||
    value !== value.trim()
  )
    throw new TypeError('Index metadata requires a configured HTTP(S) origin.');
  return parsed.origin;
}
function staticPath(locale: Locale, page: 'home' | 'cases' | 'about') {
  return page === 'home'
    ? `/${locale}`
    : page === 'cases'
      ? `/${locale}/cases`
      : `/${locale}/${locale === 'pt' ? 'sobre' : 'about'}`;
}
type SitemapEntry = { url: string; alternates: { languages: Record<string, string> } };

/** Projects only current confirmed paths; its caller owns publication selection. */
export function buildPublicSitemap(input: PublicIndexInput): SitemapEntry[] {
  const source = inputSchema.parse(input);
  const origin = configuredOrigin(source.origin);
  const identities = new Set<string>();
  const paths = new Set<string>();
  for (const route of source.cases) {
    const match = /^\/(pt|en)\/cases\/([^/]+)$/.exec(route.path);
    const identity = `${route.caseId}/${route.locale}`;
    if (
      !match ||
      match[1] !== route.locale ||
      !slugSchema.safeParse(match[2]).success ||
      identities.has(identity) ||
      paths.has(route.path)
    )
      throw new TypeError('Confirmed index routes are invalid or ambiguous.');
    identities.add(identity);
    paths.add(route.path);
  }
  if (!source.indexable) return [];
  const absolute = (pathname: string) => new URL(pathname, origin).toString();
  const entries: SitemapEntry[] = [];
  for (const locale of locales) {
    if (!source.pages[locale]) continue;
    for (const page of ['home', 'cases', 'about'] as const) {
      entries.push({
        url: absolute(staticPath(locale, page)),
        alternates: {
          languages: Object.fromEntries(
            locales
              .filter((language) => source.pages[language])
              .map((language) => [language, absolute(staticPath(language, page))]),
          ),
        },
      });
    }
  }
  for (const route of [...source.cases].sort((a, b) => a.path.localeCompare(b.path))) {
    entries.push({
      url: absolute(route.path),
      alternates: {
        languages: Object.fromEntries(
          locales.flatMap((locale) => {
            const alternate = source.cases.find(
              (other) => other.caseId === route.caseId && other.locale === locale,
            );
            return alternate ? [[locale, absolute(alternate.path)]] : [];
          }),
        ),
      },
    });
  }
  return entries;
}
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderPublicSitemap(entries: readonly SitemapEntry[]): string {
  const root = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
  const languages = ' xmlns:xhtml="http://www.w3.org/1999/xhtml"';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    root + (entries.length ? languages : '') + '>',
  ];
  // Entries contain only absolute HTTP(S) origins and fixed or validated slug paths.
  for (const { url, alternates } of entries) {
    lines.push('<url>', `<loc>${escapeXml(url)}</loc>`);
    for (const [language, href] of Object.entries(alternates.languages)) {
      lines.push(
        `<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(href)}" />`,
      );
    }
    lines.push('</url>');
  }
  return [...lines, '</urlset>', ''].join('\n');
}

export function buildRobots(
  input: Pick<PublicIndexInput, 'origin' | 'indexable'>,
): MetadataRoute.Robots {
  const origin = configuredOrigin(input.origin);
  if (!z.boolean().parse(input.indexable)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
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
  };
}
