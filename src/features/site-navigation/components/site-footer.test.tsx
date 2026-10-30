// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { navigationEnFixture, navigationPtFixture } from '../../../../testing/fixtures/content';
import { SiteFooter } from './site-footer';

afterEach(cleanup);

// A missing or unfocusable target strands header contact navigation.
it('provides a labeled, programmatically focusable contact list', () => {
  render(<SiteFooter navigation={navigationPtFixture} />);
  expect(screen.queryByRole('list', { name: 'Contato' })).toBeInTheDocument();
  const contacts = screen.getByRole('list', { name: 'Contato' });
  expect(contacts).toHaveAttribute('id', 'contact');
  expect(contacts).toHaveAttribute('tabindex', '-1');
  contacts.focus();
  expect(contacts).toHaveFocus();
  expect(within(contacts).getAllByRole('listitem')).toHaveLength(3);
});

// Changing destinations or applying _blank to every contact violates explicit behavior.
it.each([
  {
    navigation: navigationPtFixture,
    list: 'Contato',
    email: 'E-mail',
    emailHref: 'mailto:pt@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic-pt',
    resume: 'Currículo (abre em nova aba)',
    pdf: '/media/00000000-0000-4000-8000-000000000001/original',
  },
  {
    navigation: navigationEnFixture,
    list: 'Contact',
    email: 'Email',
    emailHref: 'mailto:en@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic-en',
    resume: 'Resume (opens in a new tab)',
    pdf: '/media/00000000-0000-4000-8000-000000000002/original',
  },
])(
  'uses the published $navigation.locale contacts and resume',
  ({ navigation, list, email, emailHref, linkedin, resume, pdf }) => {
    render(<SiteFooter navigation={navigation} />);
    expect(screen.queryByRole('list', { name: list })).toBeInTheDocument();
    const contacts = within(screen.getByRole('list', { name: list }));
    const emailLink = contacts.getByRole('link', { name: email });
    expect(emailLink).toHaveAttribute('href', emailHref);
    expect(emailLink).not.toHaveAttribute('target');
    const linkedinLink = contacts.getByRole('link', { name: 'LinkedIn' });
    expect(linkedinLink).toHaveAttribute('href', linkedin);
    expect(linkedinLink).not.toHaveAttribute('target');
    const resumeLink = contacts.getByRole('link', { name: resume });
    expect(resumeLink).toHaveAttribute('href', pdf);
    expect(resumeLink).toHaveAttribute('target', '_blank');
    expect(resumeLink).toHaveAttribute('rel', 'noopener noreferrer');
  },
);
