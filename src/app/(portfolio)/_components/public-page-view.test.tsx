// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { profileDTOSchema } from '@/features/professional-profile';
import { caseDetailDTOSchema } from '@/features/cases';
import { navigationDTOSchema } from '@/features/site-navigation';
import { navigationPtFixture } from '../../../../testing/fixtures/content';
import type { PublishedPortfolio } from '@/config/read-published-portfolio';
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
const portfolio: PublishedPortfolio = {
  generation: '00000000-0000-4000-8000-000000000099',
  locale: 'pt',
  profile,
  navigation,
  cases: [detail],
  featured: [detail],
  count: 1,
  routes: [
    {
      caseId: detail.caseId,
      locale: 'pt',
      path: detail.path,
      history: [],
      seo: detail.seo,
      canonical: detail.path,
      alternates: { pt: detail.path },
    },
  ],
  sitemap: ['/pt', '/pt/cases', '/pt/sobre', detail.path],
};
it.each([
  ['home', 'Synthetic Home heading'],
  ['cases', 'Synthetic list heading'],
  ['about', 'Synthetic About heading'],
] as const)(
  'composes the confirmed %s page with the four destinations and current resume',
  (kind, heading) => {
    render(
      <PublicPageView
        kind={kind}
        locale="pt"
        portfolio={portfolio}
        languageControl={<button>English</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    // jsdom's implicit-role query does not apply the contextual header rule.
    // W3C HTML-ARIA: headers inside main/article are generic; inspect the site header.
    const header = screen.getAllByRole('banner').find((element) => !element.closest('main'))!;
    const links = within(within(header).getByRole('navigation')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/pt/cases',
      '/pt/sobre',
      '/media/00000000-0000-4000-8000-000000000001/original',
      '#contact',
    ]);
    expect(links[2]).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(document.getElementById('contact')).not.toBeNull();
    expect(within(header).getByRole('button', { name: 'English' })).toBeVisible();
  },
);
it('passes only the received featured cards to Home and derives actual list count', () => {
  const { unmount } = render(
    <PublicPageView kind="home" locale="pt" portfolio={{ ...portfolio, featured: [] }} />,
  );
  expect(screen.getByRole('heading', { name: 'Synthetic empty title' })).toBeVisible();
  expect(screen.queryByText('Synthetic confirmed case')).toBeNull();
  unmount();
  render(<PublicPageView kind="cases" locale="pt" portfolio={portfolio} />);
  expect(screen.getByText('1 Cases')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Read synthetic case: Synthetic confirmed case' }),
  ).toHaveAttribute('href', '/pt/cases/confirmed-slug');
});
it('keeps a confirmed case readable before structural content has ever been published', () => {
  render(<PublicPageView kind="case" locale="pt" portfolio={null} detail={detail} />);
  expect(screen.getByRole('heading', { level: 1, name: detail.title! })).toBeVisible();
  expect(screen.getByText('Synthetic confirmed summary')).toBeVisible();
  expect(screen.queryByText('Synthetic identity')).toBeNull();
});
it('renders safe state copy without case content and retains the current footer contact', () => {
  render(
    <PublicPageView kind="about" locale="pt" portfolio={portfolio} status={404} detail={detail} />,
  );
  expect(
    screen.getByRole('heading', { level: 1, name: 'Synthetic published not-found' }),
  ).toBeVisible();
  expect(screen.queryByText(detail.title!)).toBeNull();
  expect(document.getElementById('contact')).not.toBeNull();
});
