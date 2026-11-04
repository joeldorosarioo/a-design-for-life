import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import type { PublicationUpdate } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { type PublicObservation } from '@/helpers/payload/publication-http-verification';
import {
  getPublishedCaseAggregate,
  renderCaseRouteResponse,
  selectCaseStatePresentation,
} from '@/features/cases/server';
import { casePublicSnapshotSchema, confirmedCases } from '@/features/cases/server/case-publication';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation } from '@/features/site-navigation/server';
import { planPublicMediaObservations } from '@/features/media-library/server/publication-media-observation';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { readPublishedPortfolio } from './read-published-portfolio';
import { readPublicSitemap } from './read-public-index';
import { matchesPublicPage, type PublicPageObservation } from './publication-page-observation';

const locales = ['pt', 'en'] as const;
const pages = ['home', 'cases', 'about'] as const;

function pagePath(locale: Locale, kind: (typeof pages)[number]): string {
  if (kind === 'home') return '/' + locale;
  return '/' + locale + '/' + (kind === 'cases' ? 'cases' : locale === 'pt' ? 'sobre' : 'about');
}

function absolute(origin: string, path: string): string {
  return new URL(path, origin).href;
}

function html(path: string, status: number, expected: PublicPageObservation): PublicObservation {
  return {
    path,
    status,
    matches: (body, headers) => matchesPublicPage(body, headers, expected),
  };
}

async function withdrawnCase(
  locale: Locale,
  root: PublicRoot,
): Promise<Omit<PublicObservation, 'path'>> {
  const presentation = await selectCaseStatePresentation({ locale, status: 410, root });
  const expected = renderCaseRouteResponse({ status: 410, locale }, locale, presentation);
  const expectedBody = Buffer.from(await expected.arrayBuffer());
  const robots = expected.headers.get('x-robots-tag');
  return {
    status: expected.status,
    matches: (body, headers) =>
      headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'text/html' &&
      headers.get('x-robots-tag') === robots &&
      expectedBody.equals(body),
  };
}

function json(path: string, expected: unknown): PublicObservation {
  const expectedWire = JSON.parse(JSON.stringify(expected)) as unknown;
  return {
    path,
    status: 200,
    matches(body, headers) {
      return (
        headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json' &&
        isDeepStrictEqual(
          JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)),
          expectedWire,
        )
      );
    },
  };
}

function joinedHeading(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(' ') || null;
}

function publicAlternates(origin: string, alternatives: { locale: Locale; path: string }[]) {
  return Object.fromEntries(
    alternatives.map(({ locale, path }) => [locale, absolute(origin, path)]),
  );
}

export async function planPublicationObservations({
  root,
  operation,
  siteOrigin,
  indexable = false,
}: {
  root: PublicRoot;
  operation: PublicationUpdate;
  siteOrigin: string;
  indexable?: boolean;
}): Promise<PublicObservation[]> {
  const key = operation.subjectCollection + '/' + operation.subjectId;
  const subject = root.subjects[key];
  if (
    !subject ||
    subject.operationId !== operation.operationId ||
    subject.targetRevision !== operation.targetRevision
  )
    throw new Error('Publication observation requires the selected operation.');
  const media = planPublicMediaObservations(
    root,
    key,
    operation.state === 'update-pending' &&
      (operation.subjectCollection === 'case-content' ||
        operation.subjectCollection === 'professional-profiles'),
  );
  const result = new Map<string, PublicObservation>();
  const add = (observation: PublicObservation) => result.set(observation.path, observation);

  if (
    operation.subjectCollection === 'professional-profiles' ||
    operation.subjectCollection === 'site-navigation'
  ) {
    const candidate = subject.value;
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate) ||
      !('locale' in candidate) ||
      (candidate.locale !== 'pt' && candidate.locale !== 'en')
    )
      throw new Error('Public structural locale unavailable.');
    const getPublished =
      operation.subjectCollection === 'professional-profiles'
        ? getPublishedProfile
        : getPublishedNavigation;
    const expected = await getPublished(candidate.locale, undefined, root);
    if (!expected.ok) throw new Error('Public structural projection unavailable.');
    add(json('/api/' + operation.subjectCollection + '/published/' + candidate.locale, expected));
  } else {
    const caseLocales =
      operation.subjectCollection === 'case-content'
        ? [casePublicSnapshotSchema.parse(subject.value).locale]
        : locales;
    for (const locale of caseLocales) {
      const expected = await getPublishedCaseAggregate(locale, root);
      if (!expected.ok) throw new Error('Public case projection unavailable.');
      add(json('/api/case-content/published/' + locale, expected));
    }
  }

  for (const locale of locales) {
    const portfolio = await readPublishedPortfolio(locale, root);
    // Initial structural and order operations precede the first renderable pages.
    if (!portfolio.ok) continue;
    const { profile, cases, featured, sitemap } = portfolio.value;
    for (const kind of pages) {
      const path = pagePath(locale, kind);
      const alternatives = locales.flatMap((language) => {
        const candidate = pagePath(language, kind);
        return sitemap.includes(candidate) ? [{ locale: language, path: candidate }] : [];
      });
      const heading =
        kind === 'home'
          ? joinedHeading(profile.home.title, profile.home.titleEmphasis)
          : kind === 'cases'
            ? profile.listing.title
            : profile.about.title;
      const cards = kind === 'home' ? featured : kind === 'cases' ? cases : undefined;
      add(
        html(path, 200, {
          locale,
          heading: heading || null,
          section:
            kind === 'home' ? 'home-projects' : kind === 'cases' ? 'cases-list' : 'about-opening',
          canonical: absolute(siteOrigin, path),
          alternates: publicAlternates(siteOrigin, alternatives),
          cards: cards?.map(({ caseId, path, title }) => ({ id: caseId, path, title })),
        }),
      );
    }
  }

  if (operation.subjectCollection === 'case-content') {
    const changed = casePublicSnapshotSchema.parse(subject.value);
    const translations = confirmedCases(root).filter((item) => item.caseId === changed.caseId);
    const alternatives = translations.flatMap(({ detail, locale }) =>
      detail ? [{ locale, path: detail.path }] : [],
    );
    for (const item of translations) {
      if (item.detail) {
        const detail = item.detail;
        add(
          html(detail.path, 200, {
            locale: item.locale,
            heading:
              joinedHeading(detail.titleParts.normal, detail.titleParts.emphasis) ?? detail.title,
            section: 'case-opening',
            canonical: absolute(siteOrigin, detail.path),
            alternates: publicAlternates(siteOrigin, alternatives),
          }),
        );
      }
      let withdrawn: Omit<PublicObservation, 'path'> | undefined;
      for (const slug of item.slugs) {
        if (slug === item.slug) continue;
        const path = '/' + item.locale + '/cases/' + slug;
        if (item.detail) {
          const destination = item.detail.path;
          const expected = absolute(siteOrigin, destination);
          add({
            path,
            status: 308,
            matches: (body, headers) => {
              const location = headers.get('location');
              if (location !== expected && location !== destination) return false;
              // Next's router can write the exact Location as the redirect body.
              return (
                body.byteLength === 0 ||
                new TextDecoder('utf-8', { fatal: true }).decode(body) === location
              );
            },
          });
        } else {
          withdrawn ??= await withdrawnCase(item.locale, root);
          add({ path, ...withdrawn });
        }
      }
    }
  }
  if (indexable) {
    const expected = Buffer.from(await readPublicSitemap(root, siteOrigin));
    add({
      path: '/sitemap.xml',
      status: 200,
      matches: (body, headers) =>
        headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/xml' &&
        expected.equals(body),
    });
  }
  return [...result.values(), ...media];
}
