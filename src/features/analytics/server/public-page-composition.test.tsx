import type { ReactElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderPublicPage } from '../../../app/(portfolio)/_components/public-page-response';
import { PublicPageView } from '../../../app/(portfolio)/_components/public-page-view';
import type { BrowserAnalyticsBoundaryProps } from '../contracts/composition';
const request = vi.hoisted(() => ({ status: 200, present: true, pathname: '/en' }));
// The verified Next request/snapshot transport is the only replaced application boundary.
// This test inspects composition payloads; it does not claim a publication/DB integration.
vi.mock('@/config/public-page-request', () => ({
  readPublicPageRequest: async () =>
    request.present
      ? {
          context: {
            v: 1,
            method: 'GET',
            locale: 'en',
            pathname: request.pathname,
            status: request.status,
            pin: null,
          },
          root: null,
          portfolio: null,
          detail: undefined,
          routes: [],
          origin: 'https://portfolio.example.invalid',
          indexable: true,
        }
      : null,
}));
beforeEach(() => {
  request.status = 200;
  request.present = true;
  request.pathname = '/en';
  for (const [key, value] of Object.entries({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    PUBLIC_SITE_ENABLED: 'true',
    GA4_MEASUREMENT_ID: 'G-TESTONLY1',
    SITE_ORIGIN: 'https://portfolio.example.invalid',
    PAYLOAD_SECRET: 'synthetic-secret-only-for-composition-tests',
    DATABASE_URI: 'postgres://synthetic:local-only@127.0.0.1:55433/adfl_test_fixture',
    MEDIA_BUCKET: 'adfl-test-fixture',
  }))
    vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());

it('composes the verified public 200 response through the conditional analytics boundary using only selected runtime/context', async () => {
  const result = (await renderPublicPage(
    'home',
    'en',
    '/en',
  )) as ReactElement<BrowserAnalyticsBoundaryProps>;
  expect(result.props.context).toEqual({ locale: 'en', pagePath: '/en' });
  expect(result.props.runtime).toEqual({
    environment: 'production',
    area: 'public',
    preview: false,
    publicSiteEnabled: true,
    measurementId: 'G-TESTONLY1',
    siteOrigin: 'https://portfolio.example.invalid',
  });
  const content = result.props.children as ReactElement<{
    kind: string;
    locale: string;
    status: number;
  }>;
  expect(content.type).toBe(PublicPageView);
  expect(content.props).toMatchObject({ kind: 'home', locale: 'en', status: 200 });
});

it.each(['false', undefined])(
  'keeps the original public response without a boundary when the release flag is %s',
  async (flag) => {
    vi.stubEnv('PUBLIC_SITE_ENABLED', flag);
    const result = (await renderPublicPage('home', 'en', '/en')) as ReactElement;
    expect(result.type).toBe(PublicPageView);
  },
);

it('keeps staging and error responses out of the client boundary', async () => {
  vi.stubEnv('APP_ENV', 'staging');
  expect(((await renderPublicPage('home', 'en', '/en')) as ReactElement).type).toBe(PublicPageView);
  vi.stubEnv('APP_ENV', 'production');
  request.status = 503;
  const result = (await renderPublicPage('home', 'en', '/en')) as ReactElement<{ status: number }>;
  expect(result.type).toBe(PublicPageView);
  expect(result.props.status).toBe(503);
});

it('rejects a missing or mismatched verified snapshot before composing analytics', async () => {
  request.present = false;
  await expect(renderPublicPage('home', 'en', '/en')).rejects.toThrow();
  request.present = true;
  request.pathname = '/en/about';
  await expect(renderPublicPage('home', 'en', '/en')).rejects.toThrow();
});
