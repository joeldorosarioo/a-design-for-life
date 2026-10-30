// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PublicNotFound, { generateMetadata } from './not-found';

const state = vi.hoisted(() => ({ locale: 'pt' as 'pt' | 'en', available: true }));
// Only the Next request boundary is replaced; real state UI and metadata run.
vi.mock('@/config/public-page-request', () => ({
  readPublicPageRequest: async () =>
    state.available
      ? {
          context: {
            v: 1,
            method: 'GET',
            locale: state.locale,
            pathname: `/${state.locale}/unknown`,
            status: 404,
            pin: null,
          },
          portfolio: null,
          detail: undefined,
          routes: [],
          origin: 'http://127.0.0.1:3100',
          indexable: false,
        }
      : null,
}));
afterEach(() => {
  cleanup();
  state.available = true;
});

it.each([
  ['pt', 'Página não encontrada'],
  ['en', 'Page not found'],
] as const)(
  'keeps the %s error body and metadata in the same captured locale',
  async (locale, title) => {
    state.locale = locale;
    render(await PublicNotFound());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(await generateMetadata()).toMatchObject({
      title,
      robots: { index: false, follow: false },
    });
  },
);
it('keeps an unsigned unsupported surface on the safe English fallback', async () => {
  state.available = false;
  render(await PublicNotFound());
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(await generateMetadata()).toMatchObject({
    title: 'Page not found',
    robots: { index: false, follow: false },
  });
});
