// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PrivateLanguageLink } from './private-language-link';
afterEach(cleanup);
const id = '00000000-0000-4000-8000-000000000001';
it('links to the private counterpart without submitting a public language preference', () => {
  const href = `/preview-ui/en/professional-profiles/${id}/about`;
  const { container } = render(
    <PrivateLanguageLink locale="pt" href={href} languageLabel="Idioma" />,
  );
  expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', href);
  expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('lang', 'en');
  expect(container.querySelector('form')).toBeNull();
  expect(container.innerHTML).not.toContain('/language-preference');
});
it('shows a disabled language control when no authorized counterpart is available', () => {
  render(<PrivateLanguageLink locale="en" href={null} languageLabel="Language" />);
  expect(screen.getByRole('button', { name: 'Português' })).toBeDisabled();
  expect(screen.queryByRole('link')).toBeNull();
});
it.each([
  '/en/about',
  'https://outside.invalid',
  `/preview-ui/pt/professional-profiles/${id}/about`,
])('refuses a non-counterpart destination %s', (href) => {
  expect(() =>
    render(<PrivateLanguageLink locale="pt" href={href} languageLabel="Idioma" />),
  ).toThrow();
});

it.each([
  ['pt', 'en', 'English', '/figma/language-br.svg'],
  ['en', 'pt', 'Português', '/figma/language-en.svg'],
] as const)(
  'identifies current %s visually in an authorized private counterpart link',
  (locale, target, label, flag) => {
    const href = `/preview-ui/${target}/professional-profiles/${id}/about`;
    render(<PrivateLanguageLink locale={locale} href={href} languageLabel="Language" />);
    const control = screen.getByRole('link', { name: label });
    expect(control.querySelector('img')).toHaveAttribute('src', flag);
    expect(control.querySelector('img')).toHaveAttribute('alt', '');
    expect(control).toHaveAttribute('href', href);
    expect(control).toHaveAttribute('lang', target);
  },
);
