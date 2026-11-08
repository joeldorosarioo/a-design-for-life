// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import { CaseGrid, CaseList, CaseState } from './case-list';
afterEach(cleanup);

it('exposes permanent case identities as reading anchors instead of only React list keys', () => {
  const { container } = render(
    <CaseGrid
      cases={cases}
      caseLinkLabel="Read synthetic case"
      emptyState={{ title: 'Empty', description: 'No cases' }}
    />,
  );
  expect(
    Array.from(container.querySelectorAll('article')).map((card) =>
      card.getAttribute('data-reading-key'),
    ),
  ).toEqual([
    'case-card:00000000-0000-4000-8000-000000000002',
    'case-card:00000000-0000-4000-8000-000000000001',
  ]);
});
const cases: CaseCardDTO[] = [
  {
    caseId: '00000000-0000-4000-8000-000000000002',
    locale: 'en',
    eyebrow: 'Second supplied eyebrow',
    title: 'Second supplied title',
    summary: '<script>Literal summary</script>',
    path: '/en/cases/second',
    cover: null,
  },
  {
    caseId: '00000000-0000-4000-8000-000000000001',
    locale: 'en',
    eyebrow: 'First supplied eyebrow',
    title: 'First supplied title',
    summary: 'First supplied summary',
    path: '/en/cases/first',
    cover: null,
  },
];
const emptyState = { title: 'No published studies', description: 'Return after publication.' };
const gridProps = { cases, caseLinkLabel: 'Read study', emptyState };
const listProps = {
  ...gridProps,
  opening: {
    eyebrow: 'Published work',
    title: 'All studies',
    description: 'Supplied listing introduction',
  },
  homeHref: '/en',
  homeLabel: 'Return home',
  countLabel: 'cases',
};

// Sorting by title or rebuilding a slug would diverge from the confirmed generation.
it('reuses cards in received order without adding listing opening or count', () => {
  const { container } = render(<CaseGrid {...gridProps} headingLevel={3} />);
  expect(screen.queryAllByRole('article')).toHaveLength(2);
  expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
    'Second supplied title',
    'First supplied title',
  ]);
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/en/cases/second',
    '/en/cases/second',
    '/en/cases/first',
    '/en/cases/first',
  ]);
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  expect(
    within(screen.getAllByRole('article')[0]).getByText('Second supplied eyebrow'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Read study: Second supplied title' }),
  ).not.toHaveAttribute('target');
  expect(screen.getByText('<script>Literal summary</script>')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  expect(screen.queryByText('2 cases')).not.toBeInTheDocument();
});

// Existing confirmed snapshots have no new CTA field; they must keep a real named route link.
it('keeps the named title link and body when legacy content has no CTA label', () => {
  render(<CaseGrid {...gridProps} caseLinkLabel={null} />);
  expect(screen.queryByRole('link', { name: 'Second supplied title' })).toHaveAttribute(
    'href',
    '/en/cases/second',
  );
  expect(screen.getByText('<script>Literal summary</script>')).toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.queryByRole('link', { name: /^Read study:/ })).not.toBeInTheDocument();
});

it('derives the displayed count from current received cases and uses supplied opening and home link', () => {
  const { rerender } = render(<CaseList {...listProps} />);
  expect(screen.queryByRole('heading', { level: 1, name: 'All studies' })).toBeInTheDocument();
  expect(screen.getByText('2 cases')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/en');
  rerender(<CaseList {...listProps} cases={[cases[0]]} />);
  expect(screen.getByText('1 cases')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'First supplied title' })).not.toBeInTheDocument();
});

it('shows explicit empty copy and keeps failure presentation distinct from an empty list', () => {
  const { rerender } = render(<CaseGrid {...gridProps} cases={[]} />);
  expect(screen.queryByRole('heading', { name: 'No published studies' })).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  rerender(
    <CaseState
      title="Temporarily unavailable"
      description="Supplied published failure message"
      links={[
        { href: '/en/cases', label: 'Try again' },
        { href: '/en', label: 'Home' },
      ]}
    />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Temporarily unavailable');
  expect(screen.queryByText('No published studies')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/en/cases',
    '/en',
  ]);
});
