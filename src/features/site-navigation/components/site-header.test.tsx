// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { navigationEnFixture, navigationPtFixture } from '../../../../testing/fixtures/content';
import { SiteHeader } from './site-header';

afterEach(cleanup);

// Reordering or dropping a purpose breaks the same navigation on every page.
it('keeps four ordered destinations and contact on the current page', () => {
  render(<SiteHeader navigation={navigationPtFixture} />);
  expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  const links = within(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  ).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/pt/cases',
    '/pt/sobre',
    '/media/00000000-0000-4000-8000-000000000001/original',
    '#contact',
  ]);
  expect(links.map((link) => link.textContent)).toEqual([
    'Projetos',
    'Sobre',
    'Currículo (abre em nova aba)',
    'Contato',
  ]);
  expect(screen.getByRole('link', { name: 'Marca sintética' })).toHaveAttribute('href', '/pt');
});

// Wrong locale PDF or a blanket external-link target loses the approved tab behavior.
it.each([
  {
    navigation: navigationPtFixture,
    resume: 'Currículo (abre em nova aba)',
    pdf: '/media/00000000-0000-4000-8000-000000000001/original',
  },
  {
    navigation: navigationEnFixture,
    resume: 'Resume (opens in a new tab)',
    pdf: '/media/00000000-0000-4000-8000-000000000002/original',
  },
])('opens only the $navigation.locale resume in another tab', ({ navigation, resume, pdf }) => {
  render(<SiteHeader navigation={navigation} />);
  expect(screen.queryByRole('link', { name: resume })).toBeInTheDocument();
  const resumeLink = screen.getByRole('link', { name: resume });
  expect(resumeLink).toHaveAttribute('href', pdf);
  expect(resumeLink).toHaveAttribute('target', '_blank');
  expect(resumeLink).toHaveAttribute('rel', 'noopener noreferrer');
  for (const link of screen.getAllByRole('link').filter((link) => link !== resumeLink)) {
    expect(link).not.toHaveAttribute('target');
  }
});

// The header must compose the real external language control without inventing one.
it('renders the supplied language control once', () => {
  render(
    <SiteHeader
      navigation={navigationEnFixture}
      languageControl={<button>Switch language</button>}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Switch language' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Switch language' })).toHaveLength(1);
});
