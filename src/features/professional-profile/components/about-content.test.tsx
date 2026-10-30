// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { profileDTOSchema } from '../contracts/profile-dto.schema';
import { AboutContent } from './about-content';

afterEach(cleanup);

const portrait = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  decorative: false,
  alt: 'Synthetic portrait alt',
  caption: 'Synthetic portrait caption',
};
const profile = profileDTOSchema.parse({
  locale: 'en',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  about: {
    eyebrow: 'Synthetic about eyebrow',
    title: 'Synthetic about title',
    description: 'Synthetic about description',
    introductionHeading: 'Synthetic introduction heading',
    introduction: 'Synthetic introduction paragraph\n\nSynthetic second introduction paragraph',
    portrait,
    journeyEyebrow: 'Synthetic journey eyebrow',
    journeyHeading: 'Synthetic journey heading',
    journey: 'Synthetic journey body',
    deskPhotograph: {
      ...portrait,
      mediaId: '00000000-0000-4000-8000-000000000002',
      alt: 'Synthetic desk alt',
      caption: null,
    },
    editorialEmphasis: 'Synthetic editorial emphasis',
    approachEyebrow: 'Synthetic approach eyebrow',
    approachHeading: 'Synthetic approach heading',
    approach: 'Synthetic approach body',
    architecturePhotograph: {
      ...portrait,
      mediaId: '00000000-0000-4000-8000-000000000003',
      alt: 'Synthetic architecture alt',
      caption: null,
    },
    inMotionEyebrow: 'Synthetic motion eyebrow',
    inMotionHeading: 'Synthetic motion heading',
    inMotion: 'Synthetic motion body',
    closingHeading: 'Synthetic closing heading',
    closing: 'Synthetic closing body',
    projectsLabel: 'Synthetic cases action',
  },
  contacts: { email: null, linkedin: null },
  resumeId: null,
  seo: {
    homeTitle: null,
    homeDescription: null,
    listingTitle: null,
    listingDescription: null,
    aboutTitle: null,
    aboutDescription: null,
  },
});

// Omitting a group or photo loses the fixed editorial sequence.
it('presents the full fixed article using localized text and supplied image uses', () => {
  const { container } = render(<AboutContent profile={profile} projectsHref="/pt/cases" />);
  expect(screen.queryByRole('article')).toBeInTheDocument();
  expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
    'Synthetic about title',
    'Synthetic introduction heading',
    'Synthetic journey heading',
    'Synthetic approach heading',
    'Synthetic motion heading',
    'Synthetic closing heading',
  ]);
  expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
    'Synthetic portrait alt',
    'Synthetic desk alt',
    'Synthetic architecture alt',
  ]);
  expect(screen.getByText('Synthetic second introduction paragraph')).toBeInTheDocument();
  expect(screen.getByText('Synthetic portrait caption').tagName).toBe('FIGCAPTION');
  expect(screen.getByRole('link', { name: 'Synthetic cases action' })).toHaveAttribute(
    'href',
    '/pt/cases',
  );
  expect(screen.getByRole('link', { name: 'Synthetic cases action' })).not.toHaveAttribute(
    'target',
  );
  const sectionKeys = Array.from(container.querySelectorAll('[data-reading-key]')).map((node) =>
    node.getAttribute('data-reading-key'),
  );
  expect(sectionKeys).toEqual([
    'about-opening',
    'about-introduction',
    'about-journey',
    'about-desk',
    'about-emphasis',
    'about-approach',
    'about-in-motion',
    'about-closing',
  ]);
  const body = container.textContent!;
  expect(body.indexOf('Synthetic journey body')).toBeLessThan(
    body.indexOf('Synthetic editorial emphasis'),
  );
  expect(body.indexOf('Synthetic editorial emphasis')).toBeLessThan(
    body.indexOf('Synthetic approach body'),
  );
});

// Semantic correspondence must survive translated titles and text lengths.
it('keeps semantic reading keys in both locales', () => {
  const { container, rerender } = render(
    <AboutContent profile={profile} projectsHref="/en/cases" />,
  );
  const keys = Array.from(container.querySelectorAll('[data-reading-key]')).map((node) =>
    node.getAttribute('data-reading-key'),
  );
  expect(keys).toContain('about-in-motion');
  rerender(
    <AboutContent
      profile={{
        ...profile,
        locale: 'pt',
        about: { ...profile.about, title: 'Título sintético diferente' },
      }}
      projectsHref="/pt/cases"
    />,
  );
  expect(
    Array.from(container.querySelectorAll('[data-reading-key]')).map((node) =>
      node.getAttribute('data-reading-key'),
    ),
  ).toEqual(keys);
});

// A sparse authenticated draft must not substitute a stock professional biography.
it('renders sparse draft data without headings, photographs or actions for missing content', () => {
  const { container } = render(
    <AboutContent
      profile={profileDTOSchema.parse({ ...profile, about: undefined })}
      projectsHref="/en/cases"
    />,
  );
  expect(container).toHaveTextContent('');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

// Dropping section-identification fields would lose the distinct editorial labels in both locales.
it('renders the three editable section eyebrows without deriving labels from position', () => {
  render(<AboutContent profile={profile} projectsHref="/en/cases" />);
  expect(screen.queryByText('Synthetic journey eyebrow')).toBeInTheDocument();
  expect(screen.getByText('Synthetic approach eyebrow')).toBeInTheDocument();
  expect(screen.getByText('Synthetic motion eyebrow')).toBeInTheDocument();
});
