// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { profileDTOSchema } from '../contracts/profile-dto.schema';
import { HomeContent } from './home-content';

afterEach(cleanup);

// Literal synthetic editorial content. No professional reference content is published by this test.
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: 'Unused synthetic identity', role: null },
  home: {
    eyebrow: 'Synthetic home eyebrow',
    title: 'Synthetic normal title',
    titleEmphasis: 'Synthetic emphasized title',
    description: 'Synthetic hero body',
    projectsLabel: 'Synthetic projects',
    portrait: null,
  },
  homeProjects: {
    eyebrow: 'Synthetic projects eyebrow',
    title: 'Synthetic projects heading',
    description: 'Synthetic projects intro',
  },
  listing: { eyebrow: null, title: null, description: null },
  homeAbout: {
    eyebrow: 'Synthetic about eyebrow',
    title: 'Synthetic about heading',
    description: 'Synthetic about body',
    aboutLabel: 'Synthetic about link',
    trajectory: [
      {
        readingKey: '00000000-0000-4000-8000-000000000002',
        period: 'Synthetic recent period',
        title: 'Synthetic recent role',
        description: 'Synthetic recent body',
      },
      {
        readingKey: '00000000-0000-4000-8000-000000000001',
        period: 'Synthetic earlier period',
        title: 'Synthetic earlier role',
        description: 'Synthetic earlier body',
      },
    ],
  },
  approach: {
    eyebrow: 'Synthetic approach eyebrow',
    title: 'Synthetic approach heading',
    description: 'Synthetic approach intro',
    methods: [
      {
        readingKey: '00000000-0000-4000-8000-000000000004',
        title: 'Synthetic first method',
        description: 'Synthetic method body',
        keywords: 'Synthetic keywords',
      },
      {
        readingKey: '00000000-0000-4000-8000-000000000003',
        title: 'Synthetic second method',
        description: 'Synthetic other method body',
        keywords: null,
      },
    ],
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

const props = {
  profile,
  projectsHref: '/en/cases',
  aboutHref: '/en/about',
  featuredProjects: (
    <article>
      <h3>Synthetic featured case supplied by composition</h3>
    </article>
  ),
};

// Dropping a group, copying a case into Profile, or using the wrong heading level breaks the page structure.
it('presents structured profile groups in reading order and composes the supplied cases once', () => {
  render(<HomeContent {...props} />);
  expect(
    screen.queryByRole('heading', {
      level: 1,
      name: 'Synthetic normal title Synthetic emphasized title',
    }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
    'Synthetic normal title Synthetic emphasized title',
    'Synthetic projects heading',
    'Synthetic featured case supplied by composition',
    'Synthetic about heading',
    'Synthetic recent role',
    'Synthetic earlier role',
    'Synthetic approach heading',
    'Synthetic first method',
    'Synthetic second method',
  ]);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Synthetic keywords')).toBeInTheDocument();
  expect(screen.getByText('Synthetic method body')).not.toBe(
    screen.getByText('Synthetic keywords'),
  );
  expect(
    screen.getByRole('heading', { name: 'Synthetic approach heading' }).closest('section'),
  ).toHaveAttribute('data-reading-key', 'home-approach');
  expect(screen.queryByText('Unused synthetic identity')).not.toBeInTheDocument();
});

// Rebuilding routes from locale here would ignore the validated destinations supplied at composition.
it('uses supplied project and about destinations in the same tab', () => {
  render(<HomeContent {...props} />);
  expect(screen.queryByRole('link', { name: 'Synthetic projects' })).toHaveAttribute(
    'href',
    '/en/cases',
  );
  expect(screen.getByRole('link', { name: 'Synthetic about link' })).toHaveAttribute(
    'href',
    '/en/about',
  );
  for (const link of screen.getAllByRole('link')) expect(link).not.toHaveAttribute('target');
});

// Index identities would attach the old reading context to a different row after reorder.
it('preserves row reading keys after editorial reorder', () => {
  const { rerender } = render(<HomeContent {...props} />);
  expect(screen.queryByRole('heading', { name: 'Synthetic first method' })).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Synthetic first method' }).closest('li'),
  ).toHaveAttribute('data-reading-key', '00000000-0000-4000-8000-000000000004');
  rerender(
    <HomeContent
      {...props}
      profile={{
        ...profile,
        approach: { ...profile.approach, methods: [...profile.approach.methods].reverse() },
      }}
    />,
  );
  const methodList = screen
    .getByRole('heading', { name: 'Synthetic approach heading' })
    .closest('section')!;
  expect(
    within(methodList)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['Synthetic second method', 'Synthetic first method']);
  expect(
    screen.getByRole('heading', { name: 'Synthetic first method' }).closest('li'),
  ).toHaveAttribute('data-reading-key', '00000000-0000-4000-8000-000000000004');
});

// HTML interpretation would execute editorial input; treating every newline as a paragraph loses author line breaks.
it('escapes plain editorial text and preserves paragraph and line boundaries', () => {
  const { container } = render(
    <HomeContent
      {...props}
      profile={{
        ...profile,
        home: {
          ...profile.home,
          description:
            'Synthetic first line\nSynthetic second line\n\n<script>synthetic unsafe text</script>',
        },
      }}
    />,
  );
  expect(screen.queryByText('<script>synthetic unsafe text</script>')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText(/Synthetic first line/).textContent).toBe(
    'Synthetic first line\nSynthetic second line',
  );
});

// Nullable drafts must not create example copy, empty headings, or unnamed actions.
it('omits unavailable editorial content without invented fallbacks', () => {
  const empty = profileDTOSchema.parse({
    ...profile,
    home: {
      eyebrow: null,
      title: null,
      titleEmphasis: null,
      description: null,
      projectsLabel: null,
    },
    homeProjects: { eyebrow: null, title: null, description: null },
    homeAbout: { eyebrow: null, title: null, description: null, trajectory: [], aboutLabel: null },
    approach: { eyebrow: null, title: null, description: null, methods: [] },
  });
  render(<HomeContent {...props} profile={empty} featuredProjects={null} />);
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(document.body).toHaveTextContent('');
});
