import 'server-only';
import type { Metadata } from 'next';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import { caseDetailDTOSchema, slugSchema, type CaseDetailDTO } from '@/features/cases';
import type { ImageUseDTO } from '@/features/media-library';

export type LocalizedMetadataInput = {
  locale: Locale;
  page: { kind: 'home' | 'cases' | 'about' } | { kind: 'case'; path: string };
  origin: string;
  profile: ProfileDTO | null;
  detail?: CaseDetailDTO;
  publishedAlternates: Partial<Record<Locale, string>>;
  indexable: boolean;
  status?: 200 | 404 | 410 | 503;
};
const pageSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('home') }),
  z.strictObject({ kind: z.literal('cases') }),
  z.strictObject({ kind: z.literal('about') }),
  z.strictObject({ kind: z.literal('case'), path: z.string() }),
]);
const alternativesSchema = z.strictObject({ pt: z.string().optional(), en: z.string().optional() });
const statusSchema = z.union([z.literal(200), z.literal(404), z.literal(410), z.literal(503)]);
function validatedOrigin(value: string) {
  const origin = new URL(value);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    value.includes('?') ||
    value.includes('#') ||
    value !== value.trim()
  )
    throw new TypeError('Metadata requires an HTTP(S) origin without extra data.');
  return new URL(origin.origin);
}
function staticPath(locale: Locale, kind: 'home' | 'cases' | 'about') {
  return kind === 'home'
    ? `/${locale}`
    : kind === 'cases'
      ? `/${locale}/cases`
      : `/${locale}/${locale === 'pt' ? 'sobre' : 'about'}`;
}
function casePath(path: string, locale: Locale) {
  const match = /^\/(pt|en)\/cases\/([^/]+)$/.exec(path);
  if (!match || match[1] !== locale || !slugSchema.safeParse(match[2]).success)
    throw new TypeError('Metadata case path must match its explicit locale and slug.');
  return path;
}
function text(...values: (string | null | undefined)[]) {
  for (const value of values) if (value?.trim()) return value.trim();
  return undefined;
}
function originalImage(image: ImageUseDTO | null | undefined, origin: URL) {
  if (!image) return undefined;
  return [{ url: new URL(`/media/${image.mediaId}/original`, origin).toString(), alt: image.alt }];
}
function technicalTitle(locale: Locale, status: 404 | 410 | 503, casePage: boolean) {
  if (status === 404)
    return casePage
      ? locale === 'pt'
        ? 'Case não encontrado'
        : 'Case not found'
      : locale === 'pt'
        ? 'Página não encontrada'
        : 'Page not found';
  if (status === 410) return locale === 'pt' ? 'Case indisponível' : 'Case unavailable';
  return locale === 'pt' ? 'Conteúdo indisponível' : 'Content unavailable';
}

/** Pure projection of already-confirmed DTOs; publication/identity selection belongs to its caller. */
export function buildLocalizedMetadata(input: LocalizedMetadataInput): Metadata {
  const locale = localeSchema.parse(input.locale);
  const page = pageSchema.parse(input.page);
  const origin = validatedOrigin(input.origin);
  const pathname =
    page.kind === 'case' ? casePath(page.path, locale) : staticPath(locale, page.kind);
  const alternates = alternativesSchema.parse(input.publishedAlternates);
  const languages: Partial<Record<Locale, string>> = {};
  for (const language of ['pt', 'en'] as const) {
    const path = alternates[language];
    if (path === undefined) continue;
    const valid = page.kind === 'case' ? casePath(path, language) : staticPath(language, page.kind);
    if (path !== valid || (language === locale && path !== pathname))
      throw new TypeError('Metadata alternate does not match its published page and locale.');
    languages[language] = new URL(path, origin).toString();
  }
  const status = statusSchema.parse(input.status === undefined ? 200 : input.status);
  if (status !== 200)
    return {
      title: technicalTitle(locale, status, page.kind === 'case'),
      description: null,
      robots: { index: false, follow: false },
      alternates: null,
      openGraph: null,
      twitter: null,
    };
  const indexable = z.boolean().parse(input.indexable);
  let title: string | undefined;
  let description: string | undefined;
  let image: ImageUseDTO | null | undefined;
  if (page.kind === 'case') {
    const detail = caseDetailDTOSchema.parse(input.detail);
    if (detail.locale !== locale || detail.path !== pathname)
      throw new TypeError('Metadata case DTO must match its own locale and path.');
    title = text(detail.seo.title, detail.title);
    description = text(detail.seo.description, detail.summary);
    image = detail.seo.image ?? detail.cover;
  } else {
    const profile = profileDTOSchema.parse(input.profile);
    if (profile.locale !== locale) throw new TypeError('Metadata profile must match its locale.');
    const seoKey = page.kind === 'home' ? 'home' : page.kind === 'cases' ? 'listing' : 'about';
    const heading = page.kind === 'home' ? text(profile.home.title, '') : profile[seoKey].title;
    title = text(
      profile.seo[`${seoKey}Title`],
      page.kind === 'home'
        ? [heading, text(profile.home.titleEmphasis)].filter(Boolean).join(' ')
        : heading,
    );
    description = text(profile.seo[`${seoKey}Description`], profile[seoKey].description);
    image = profile.seo.image;
  }
  const canonical = new URL(pathname, origin).toString();
  return {
    metadataBase: origin,
    title,
    description,
    robots: { index: indexable, follow: indexable },
    alternates: { canonical, languages },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      images: originalImage(image, origin),
    },
  };
}
