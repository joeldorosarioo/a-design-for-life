import { expect, it } from 'vitest';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import { caseDetailDTOSchema, type CaseDetailDTO } from '@/features/cases';
import { buildLocalizedMetadata, type LocalizedMetadataInput } from './build-localized-metadata';
const origin = 'http://127.0.0.1:3100';
const image = {
  mediaId: '11111111-1111-4111-8111-111111111111',
  decorative: false,
  alt: 'Imagem pública confirmada',
  caption: null,
};
function profile(locale: 'pt' | 'en' = 'pt'): ProfileDTO {
  const result = profileDTOSchema.parse({
    locale,
    identity: { name: 'Nome editorial', role: null },
    home: {
      eyebrow: null,
      title: locale === 'pt' ? 'Título da Home' : 'Home heading',
      titleEmphasis: locale === 'pt' ? 'em destaque' : 'emphasis',
      description: 'Home description',
      projectsLabel: null,
    },
    listing: { eyebrow: null, title: 'Projects heading', description: 'Projects description' },
    contacts: { email: null, linkedin: null },
    resumeId: null,
    seo: {
      homeTitle: 'Home SEO',
      homeDescription: 'Home SEO description',
      listingTitle: 'Cases SEO',
      listingDescription: 'Cases SEO description',
      aboutTitle: 'About SEO',
      aboutDescription: 'About SEO description',
      image: null,
    },
  });
  result.about.title = 'About heading';
  result.about.description = 'About description';
  return result;
}
function detail(locale: 'pt' | 'en' = 'pt'): CaseDetailDTO {
  return caseDetailDTOSchema.parse({
    caseId: '22222222-2222-4222-8222-222222222222',
    locale,
    eyebrow: null,
    title: 'Case heading',
    titleParts: { normal: 'Case heading', emphasis: null },
    summary: 'Case summary',
    introduction: null,
    path: locale === 'pt' ? '/pt/cases/publico' : '/en/cases/published',
    cover: null,
    role: null,
    scope: null,
    contextNote: null,
    sections: [],
    contents: [],
    seo: { title: 'Case SEO', description: 'Case SEO description', image: null },
  });
}
function input(overrides: Partial<LocalizedMetadataInput> = {}): LocalizedMetadataInput {
  return {
    locale: 'pt',
    page: { kind: 'home' },
    origin,
    profile: profile(),
    publishedAlternates: { pt: '/pt' },
    indexable: true,
    ...overrides,
  };
}
it('keeps its PT canonical and never advertises an unpublished EN case', () => {
  const create = () =>
    buildLocalizedMetadata(
      input({
        page: { kind: 'case', path: '/pt/cases/publico' },
        profile: null,
        detail: detail(),
        publishedAlternates: { pt: '/pt/cases/publico' },
      }),
    );
  expect(create).not.toThrow();
  const metadata = create();
  expect(metadata.alternates).toEqual({
    canonical: `${origin}/pt/cases/publico`,
    languages: { pt: `${origin}/pt/cases/publico` },
  });
  expect(metadata.alternates?.languages).not.toHaveProperty('en');
});
it.each([
  ['pt', 'home', '/pt'],
  ['en', 'home', '/en'],
  ['pt', 'cases', '/pt/cases'],
  ['en', 'cases', '/en/cases'],
  ['pt', 'about', '/pt/sobre'],
  ['en', 'about', '/en/about'],
] as const)('uses an explicit self canonical for %s %s', (locale, kind, path) => {
  const metadata = buildLocalizedMetadata(
    input({ locale, page: { kind }, profile: profile(locale), publishedAlternates: {} }),
  );
  expect(metadata.alternates?.canonical).toBe(`${origin}${path}`);
  expect(metadata.robots).toEqual({ index: true, follow: true });
});
it('advertises only the supplied published equivalent and keeps EN self canonical', () => {
  const metadata = buildLocalizedMetadata(
    input({
      locale: 'en',
      page: { kind: 'case', path: '/en/cases/published' },
      profile: null,
      detail: detail('en'),
      publishedAlternates: { pt: '/pt/cases/publico', en: '/en/cases/published' },
    }),
  );
  expect(metadata.alternates).toEqual({
    canonical: `${origin}/en/cases/published`,
    languages: { pt: `${origin}/pt/cases/publico`, en: `${origin}/en/cases/published` },
  });
});
it.each(['home', 'cases', 'about'] as const)('uses editor-authored SEO for %s', (kind) => {
  const metadata = buildLocalizedMetadata(input({ page: { kind }, publishedAlternates: {} }));
  const prefix = kind === 'home' ? 'Home' : kind === 'cases' ? 'Cases' : 'About';
  expect(metadata.title).toBe(`${prefix} SEO`);
  expect(metadata.description).toBe(`${prefix} SEO description`);
});
it.each(['home', 'cases', 'about'] as const)(
  'falls back only to the same published page heading/description for %s',
  (kind) => {
    const p = profile();
    for (const field of [
      'homeTitle',
      'homeDescription',
      'listingTitle',
      'listingDescription',
      'aboutTitle',
      'aboutDescription',
    ] as const)
      p.seo[field] = '   ';
    const metadata = buildLocalizedMetadata(
      input({ page: { kind }, profile: p, publishedAlternates: {} }),
    );
    expect(metadata.title).toBe(
      kind === 'home'
        ? 'Título da Home em destaque'
        : kind === 'cases'
          ? 'Projects heading'
          : 'About heading',
    );
    expect(metadata.description).toBe(
      kind === 'home'
        ? 'Home description'
        : kind === 'cases'
          ? 'Projects description'
          : 'About description',
    );
  },
);
it('uses case SEO and falls back to its own title/summary without a structural profile', () => {
  const d = detail();
  d.seo.title = null;
  d.seo.description = '  ';
  const metadata = buildLocalizedMetadata(
    input({
      page: { kind: 'case', path: d.path },
      profile: null,
      detail: d,
      publishedAlternates: {},
    }),
  );
  expect(metadata.title).toBe('Case heading');
  expect(metadata.description).toBe('Case summary');
});
it('does not invent profession or another page description when own copy is absent', () => {
  const p = profile();
  p.seo.homeTitle = null;
  p.seo.homeDescription = null;
  p.home.title = null;
  p.home.titleEmphasis = null;
  p.home.description = null;
  const metadata = buildLocalizedMetadata(input({ profile: p }));
  expect(metadata.title).toBeUndefined();
  expect(metadata.description).toBeUndefined();
  expect(JSON.stringify(metadata)).not.toContain('Nome editorial');
});
it('maps only the confirmed original SEO image and lets the metadata framework escape plain strings', () => {
  const p = profile();
  p.seo.image = image;
  p.seo.homeTitle = 'A <B> & "C"';
  const metadata = buildLocalizedMetadata(input({ profile: p }));
  expect(metadata.title).toBe('A <B> & "C"');
  expect(metadata.openGraph).toMatchObject({
    type: 'website',
    url: `${origin}/pt`,
    title: 'A <B> & "C"',
    images: [{ url: `${origin}/media/${image.mediaId}/original`, alt: image.alt }],
  });
  expect(JSON.stringify(metadata.openGraph)).not.toContain('/thumb');
});
it('uses the case SEO image before its cover and does not borrow another locale profile image', () => {
  const d = detail();
  d.seo.image = image;
  d.cover = { ...image, mediaId: '33333333-3333-4333-8333-333333333333' };
  const metadata = buildLocalizedMetadata(
    input({
      page: { kind: 'case', path: d.path },
      profile: null,
      detail: d,
      publishedAlternates: {},
    }),
  );
  expect(metadata.openGraph).toMatchObject({
    images: [{ url: `${origin}/media/${image.mediaId}/original`, alt: image.alt }],
  });
  d.seo.image = null;
  expect(
    buildLocalizedMetadata(
      input({
        page: { kind: 'case', path: d.path },
        profile: null,
        detail: d,
        publishedAlternates: {},
      }),
    ).openGraph,
  ).toMatchObject({
    images: [
      { url: `${origin}/media/33333333-3333-4333-8333-333333333333/original`, alt: image.alt },
    ],
  });
});
it.each([
  ['pt', 404, 'Página não encontrada'],
  ['en', 404, 'Page not found'],
  ['pt', 410, 'Case indisponível'],
  ['en', 410, 'Case unavailable'],
  ['pt', 503, 'Conteúdo indisponível'],
  ['en', 503, 'Content unavailable'],
] as const)(
  'clears editorial indexing/canonical/alternates for %s status%s',
  (locale, status, title) => {
    const metadata = buildLocalizedMetadata(
      input({ locale, status, profile: null, publishedAlternates: {}, indexable: true }),
    );
    expect(metadata.title).toBe(title);
    expect(metadata.description).toBeNull();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
    expect(metadata.openGraph).toBeNull();
  },
);
it('applies environment noindex without changing positive self canonical', () => {
  const metadata = buildLocalizedMetadata(input({ indexable: false }));
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates?.canonical).toBe(`${origin}/pt`);
});
it.each([
  'https://user:pass@example.invalid',
  'https://example.invalid/path',
  'https://example.invalid?x=1',
  'https://example.invalid#fragment',
  'ftp://example.invalid',
  '/relative',
  'https://example.invalid?',
  'https://example.invalid#',
])('rejects an unsafe origin: %s', (origin) => {
  expect(() => buildLocalizedMetadata(input({ origin }))).toThrow();
});
it.each([
  ['home', { en: 'https://outside.invalid/en' }],
  ['home', { en: '/pt' }],
  ['about', { en: '/en/sobre' }],
  ['cases', { en: '/en/about' }],
  ['home', { pt: '/pt/cases' }],
  ['home', { fr: '/fr' }],
] as const)('rejects external or incompatible alternates for %s', (kind, publishedAlternates) => {
  expect(() =>
    buildLocalizedMetadata(
      input({ page: { kind }, publishedAlternates: publishedAlternates as never }),
    ),
  ).toThrow();
});
it.each([
  '/en/cases/foreign',
  'https://outside.invalid/pt/cases/a',
  '//outside.invalid/pt/cases/a',
  '/pt/cases/UPPER',
  '/pt/cases/a/b',
  '/pt/cases/a?draft=1',
])('rejects an invalid own case path: %s', (path) => {
  expect(() =>
    buildLocalizedMetadata(
      input({ page: { kind: 'case', path }, detail: detail(), publishedAlternates: {} }),
    ),
  ).toThrow();
});
it('rejects a cross-locale DTO, a mismatched case identity path or a missing positive case DTO', () => {
  expect(() => buildLocalizedMetadata(input({ profile: profile('en') }))).toThrow();
  expect(() =>
    buildLocalizedMetadata(
      input({
        page: { kind: 'case', path: '/pt/cases/publico' },
        detail: detail('en'),
        publishedAlternates: {},
      }),
    ),
  ).toThrow();
  expect(() =>
    buildLocalizedMetadata(
      input({
        page: { kind: 'case', path: '/pt/cases/other' },
        detail: detail(),
        publishedAlternates: {},
      }),
    ),
  ).toThrow();
  expect(() =>
    buildLocalizedMetadata(
      input({
        page: { kind: 'case', path: '/pt/cases/publico' },
        detail: undefined,
        publishedAlternates: {},
      }),
    ),
  ).toThrow();
});
