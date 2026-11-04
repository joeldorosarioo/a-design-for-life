import React, { type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  composePublicAnalytics,
  type PublicAnalyticsComposition,
} from './public-analytics-boundary';
import type { BrowserAnalyticsBoundaryProps } from '../contracts/composition';

const child = <main>Confirmed public content</main>;
const allowed: PublicAnalyticsComposition = {
  children: child,
  verifiedPublic: true,
  area: 'public',
  preview: false,
  status: 200,
  context: { locale: 'en', pagePath: '/en/cases/private' },
  runtime: {
    environment: 'production',
    siteOrigin: 'https://portfolio.example.invalid',
    analytics: { measurementId: 'G-TESTONLY1', publicSiteEnabled: true },
  },
};

describe('server-confirmed analytics composition', () => {
  it.each([
    { verifiedPublic: false },
    { area: 'admin' },
    { area: 'private' },
    { preview: true },
    { status: 404 },
    { status: 410 },
    { status: 503 },
    { runtime: { ...allowed.runtime, environment: 'local' } },
    { runtime: { ...allowed.runtime, environment: 'test' } },
    { runtime: { ...allowed.runtime, environment: 'staging' } },
    { runtime: { ...allowed.runtime, analytics: null } },
    {
      runtime: {
        ...allowed.runtime,
        analytics: { measurementId: 'G-TESTONLY1', publicSiteEnabled: false },
      },
    },
    { runtime: { ...allowed.runtime, siteOrigin: 'http://127.0.0.1:3100' } },
    { context: { locale: 'en', pagePath: '/preview-ui/en' } },
    { context: { locale: 'en', pagePath: '/en?token=secret' } },
  ])(
    'returns children without loading any client boundary for excluded context %j',
    async (override) => {
      let loads = 0;
      const result = await composePublicAnalytics(
        { ...allowed, ...override } as PublicAnalyticsComposition,
        async () => {
          loads++;
          return import('../components/browser-analytics-boundary');
        },
      );
      expect(result).toBe(child);
      expect(loads).toBe(0);
    },
  );

  // Eager module loading or a function-bearing session would violate this RSC contract.
  it('loads only after the public gate and passes only selected serializable configuration/context', async () => {
    let loads = 0;
    const result = await composePublicAnalytics(allowed, async () => {
      loads++;
      return import('../components/browser-analytics-boundary');
    });
    expect(loads).toBe(1);
    expect(React.isValidElement(result)).toBe(true);
    const props = (result as ReactElement<BrowserAnalyticsBoundaryProps>).props;
    expect(props.runtime).toEqual({
      environment: 'production',
      area: 'public',
      preview: false,
      publicSiteEnabled: true,
      measurementId: 'G-TESTONLY1',
      siteOrigin: 'https://portfolio.example.invalid',
    });
    expect(props.context).toEqual({ locale: 'en', pagePath: '/en/cases/private' });
    expect(Object.keys(props).sort()).toEqual(['children', 'context', 'runtime']);
    expect(JSON.parse(JSON.stringify({ runtime: props.runtime, context: props.context }))).toEqual({
      runtime: props.runtime,
      context: props.context,
    });
    expect(renderToStaticMarkup(result)).toBe('<main>Confirmed public content</main>');
  });
});
it('preserves public children when the optional client chunk cannot load', async () => {
  let loads = 0;
  const result = await composePublicAnalytics(allowed, async () => {
    loads++;
    throw new Error('chunk unavailable');
  });
  expect(result).toBe(child);
  expect(loads).toBe(1);
});
