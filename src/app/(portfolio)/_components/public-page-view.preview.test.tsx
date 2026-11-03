// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { profileDTOSchema } from '@/features/professional-profile';
import { caseDetailDTOSchema } from '@/features/cases';
import { navigationDTOSchema } from '@/features/site-navigation';
import { navigationPtFixture } from '../../../../testing/fixtures/content';
import type { PortfolioPresentation } from '@/config/portfolio-presentation';
import { resolvePreviewNavigation } from '@/features/site-navigation/server';
import type { CaseLinkResolver } from '@/features/cases/ui';
import { PublicPageView } from './public-page-view';

afterEach(cleanup);
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: 'Synthetic identity', role: null },
  home: {
    eyebrow: 'Synthetic eyebrow',
    title: 'Synthetic Home heading',
    titleEmphasis: null,
    description: 'Synthetic Home description',
    projectsLabel: 'See projects',
  },
  listing: {
    eyebrow: null,
    title: 'Synthetic list heading',
    description: 'Synthetic list description',
  },
  about: {
    eyebrow: null,
    title: 'Synthetic About heading',
    description: 'Synthetic About description',
    introductionHeading: 'Intro',
    introduction: 'Synthetic introduction',
    portrait: null,
    journeyHeading: null,
    journey: null,
    deskPhotograph: null,
    editorialEmphasis: null,
    approachHeading: null,
    approach: null,
    architecturePhotograph: null,
    inMotionHeading: null,
    inMotion: null,
    closingHeading: null,
    closing: null,
    projectsLabel: 'More projects',
  },
  contacts: navigationPtFixture.contacts,
  resumeId: '00000000-0000-4000-8000-000000000001',
  seo: {
    homeTitle: null,
    homeDescription: null,
    listingTitle: null,
    listingDescription: null,
    aboutTitle: null,
    aboutDescription: null,
  },
});
const detail = caseDetailDTOSchema.parse({
  caseId: '00000000-0000-4000-8000-000000000010',
  locale: 'pt',
  title: 'Synthetic confirmed case',
  titleParts: { normal: 'Synthetic confirmed case', emphasis: null },
  eyebrow: null,
  summary: 'Synthetic confirmed summary',
  introduction: null,
  path: '/pt/cases/confirmed-slug',
  cover: null,
  role: null,
  scope: null,
  contextNote: null,
  sections: [],
  contents: [],
  seo: { title: null, description: null, image: null },
});
const navigation = navigationDTOSchema.parse({
  ...navigationPtFixture,
  items: [
    navigationPtFixture.items[0],
    navigationPtFixture.items[1],
    {
      purpose: 'resume',
      label: 'Currículo',
      destination: { kind: 'resume', mediaId: profile.resumeId, newTab: true },
    },
    { purpose: 'contact', label: 'Contato', destination: { kind: 'contact', anchor: '#contact' } },
  ],
  controls: {
    ...navigationPtFixture.controls,
    caseLinkLabel: 'Read synthetic case',
    casesLabel: 'Cases',
    homeLabel: 'Home',
    contentsLabel: 'Contents',
    roleLabel: 'Role',
    scopeLabel: 'Scope',
  },
  messages: {
    emptyCasesTitle: 'Synthetic empty title',
    emptyCasesDescription: 'Synthetic empty description',
    notFoundTitle: 'Synthetic published not-found',
    notFoundDescription: 'Synthetic published absence',
  },
});
const sourceId = '00000000-0000-4000-8000-000000000020';
const contentId = '00000000-0000-4000-8000-000000000021';
const privateBase = `/preview-ui/pt/professional-profiles/${sourceId}`;
const targets = {
  home: `${privateBase}/home`,
  cases: `${privateBase}/cases`,
  about: `${privateBase}/about`,
};
const image = {
  mediaId: '00000000-0000-4000-8000-000000000022',
  decorative: false,
  alt: 'Private raster original',
  caption: null,
};
const privateProfile = profileDTOSchema.parse({
  ...profile,
  home: { ...profile.home, portrait: image },
  homeAbout: { ...profile.homeAbout, aboutLabel: 'About draft author' },
  about: { ...profile.about, portrait: image },
});
const linkFields = { linkType: 'custom', destination: 'page', page: 'about' } as const;
const element = { direction: null, format: '', indent: 0, version: 1 };
const privateDetail = caseDetailDTOSchema.parse({
  ...detail,
  path: `/preview-ui/pt/case-content/${contentId}/case`,
  cover: image,
  sections: [
    {
      readingKey: '00000000-0000-4000-8000-000000000023',
      presentation: 'narrative',
      eyebrow: null,
      heading: 'Private case section',
      description: null,
      note: null,
      blocks: [
        {
          type: 'text',
          readingKey: '00000000-0000-4000-8000-000000000024',
          eyebrow: null,
          heading: null,
          note: null,
          content: {
            root: {
              ...element,
              type: 'root',
              children: [
                {
                  ...element,
                  type: 'paragraph',
                  children: [
                    {
                      ...element,
                      type: 'link',
                      version: 3,
                      fields: linkFields,
                      children: [
                        {
                          type: 'text',
                          version: 1,
                          text: 'Private contextual destination',
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  ],
});
const presentation: PortfolioPresentation = {
  locale: 'pt',
  profile: privateProfile,
  navigation,
  cases: [privateDetail],
  featured: [privateDetail],
  routes: [{ caseId: privateDetail.caseId, locale: 'pt', path: privateDetail.path }],
};
const navigationOverride = resolvePreviewNavigation({
  locale: 'pt',
  profile: privateProfile,
  navigation,
  pageScope: { collection: 'professional-profiles', id: sourceId },
});
// Literal server callback: no new runtime barrel export, module mock or Native document is required.
const resolveLink: CaseLinkResolver = (link) =>
  link.destination === 'page' && link.page === 'about' ? { href: targets.about } : null;
const privateProps = {
  locale: 'pt' as const,
  portfolio: presentation,
  mediaMode: 'preview' as const,
  targets,
  navigationOverride,
  resolveLink,
};
function expectNoPublicLocaleLinks(container: HTMLElement) {
  const publicLinks = Array.from(container.querySelectorAll('a[href]')).filter((link) =>
    /^\/(pt|en)(?:\/|$|[?#])/.test(link.getAttribute('href') ?? ''),
  );
  expect(publicLinks.map((link) => link.getAttribute('href'))).toEqual([]);
}
it.each(['home', 'about', 'cases', 'case'] as const)(
  'keeps the %s header/footer destinations and resume entirely inside private presentation',
  (kind) => {
    const { container } = render(
      <PublicPageView {...privateProps} kind={kind} detail={privateDetail} />,
    );
    const header = screen.getAllByRole('banner').find((element) => !element.closest('main'))!;
    const links = within(within(header).getByRole('navigation')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      targets.cases,
      targets.about,
      `/preview-media/${privateProfile.resumeId}/original`,
      '#contact',
    ]);
    expect(links[2]).toHaveAttribute('target', '_blank');
    expect(links[2]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(header).getByRole('link', { name: navigationOverride.brand.label }),
    ).toHaveAttribute('href', targets.home);
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByRole('link', { name: navigationOverride.brand.label }),
    ).toHaveAttribute('href', targets.home);
    const footerResume = within(footer).getByRole('link', {
      name: `${navigationOverride.footer.resumeLabel} (${navigationOverride.controls.newTabLabel})`,
    });
    expect(footerResume).toHaveAttribute(
      'href',
      `/preview-media/${privateProfile.resumeId}/original`,
    );
    expect(footerResume).toHaveAttribute('target', '_blank');
    expectNoPublicLocaleLinks(container);
  },
);
it('uses private Home projects/About CTAs and featured card paths without adding publication metadata', () => {
  const { container } = render(<PublicPageView {...privateProps} kind="home" />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('link', { name: /See projects/ })).toHaveAttribute('href', targets.cases);
  expect(main.getByRole('link', { name: /About draft author/ })).toHaveAttribute(
    'href',
    targets.about,
  );
  expect(
    main.getByRole('link', { name: 'Read synthetic case: Synthetic confirmed case' }),
  ).toHaveAttribute('href', privateDetail.path);
  expect(
    container.querySelector(
      'link[rel="canonical"], link[rel="alternate"], meta[property="og:url"]',
    ),
  ).toBeNull();
  expectNoPublicLocaleLinks(container);
});
it('uses private About projects and list Home/card destinations', () => {
  const about = render(<PublicPageView {...privateProps} kind="about" />);
  expect(
    within(screen.getByRole('main')).getByRole('link', { name: /More projects/ }),
  ).toHaveAttribute('href', targets.cases);
  expectNoPublicLocaleLinks(about.container);
  about.unmount();
  const list = render(<PublicPageView {...privateProps} kind="cases" />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('link', { name: /Home/ })).toHaveAttribute('href', targets.home);
  expect(
    main.getByRole('link', { name: 'Read synthetic case: Synthetic confirmed case' }),
  ).toHaveAttribute('href', privateDetail.path);
  expectNoPublicLocaleLinks(list.container);
});
it('passes the supplied server contextual resolver into CaseDetail rather than resolving a public page', () => {
  const { container } = render(
    <PublicPageView {...privateProps} kind="case" detail={privateDetail} />,
  );
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('link', { name: 'Voltar aos projetos' })).toHaveAttribute(
    'href',
    targets.cases,
  );
  expect(main.getByRole('link', { name: 'Private contextual destination' })).toHaveAttribute(
    'href',
    targets.about,
  );
  expectNoPublicLocaleLinks(container);
});
it.each(['home', 'about', 'cases', 'case'] as const)(
  'keeps every %s draft raster on preview-media with no optimizer URL or srcset',
  (kind) => {
    const { container } = render(
      <PublicPageView {...privateProps} kind={kind} detail={privateDetail} />,
    );
    const images = screen.getAllByAltText('Private raster original');
    expect(images.length).toBeGreaterThan(0);
    for (const raster of images) {
      expect(raster).toHaveAttribute('src', `/preview-media/${image.mediaId}/original`);
      expect(raster).not.toHaveAttribute('srcset');
    }
    expect(container.innerHTML).not.toContain('/_next/image');
    expect(container.innerHTML).not.toContain(`/media/${image.mediaId}/original`);
  },
);
