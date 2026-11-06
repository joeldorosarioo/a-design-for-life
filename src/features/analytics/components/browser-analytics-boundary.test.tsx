// @vitest-environment jsdom
import React, { StrictMode, Suspense } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { BrowserAnalyticsBoundary } from './browser-analytics-boundary';
import type { AnalyticsHost } from '../browser/document-analytics';
const io = vi.hoisted(() => ({
  scripts: [] as HTMLScriptElement[],
  load(script: HTMLScriptElement) {
    io.scripts.push(script);
  },
}));
// Keep the real controller/session/lifecycle. Replace only external script execution.
vi.mock('../browser/document-analytics', async (importActual) => {
  const actual = await importActual<typeof import('../browser/document-analytics')>();
  return {
    ...actual,
    mountDocumentAnalytics(input: Parameters<typeof actual.mountDocumentAnalytics>[0]) {
      return actual.mountDocumentAnalytics({ ...input, loadScript: io.load });
    },
  };
});
const runtime = {
  environment: 'production',
  area: 'public',
  preview: false,
  publicSiteEnabled: true,
  measurementId: 'G-TESTONLY1',
  siteOrigin: 'https://portfolio.example.invalid',
};
const home = { locale: 'en', pagePath: '/en' } as const;
const about = { locale: 'en', pagePath: '/en/about' } as const;
let frame: HTMLIFrameElement;
let owner: Document;
let host: AnalyticsHost;
let container: HTMLDivElement;
beforeEach(() => {
  frame = document.createElement('iframe');
  document.body.appendChild(frame);
  owner = frame.contentDocument!;
  Object.defineProperty(owner, 'featurePolicy', {
    configurable: true,
    value: { features: () => ['ch-ua-high-entropy-values'], allowsFeature: () => false },
  });
  host = frame.contentWindow! as AnalyticsHost;
  container = owner.createElement('div');
  owner.body.appendChild(container);
  io.scripts.length = 0;
  vi.stubGlobal('document', owner);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  frame.remove();
});
const events = () =>
  (host.dataLayer ?? []).map((entry) => Array.from(entry)).filter((entry) => entry[0] === 'event');

it('retains one document session through StrictMode/remount and completed A to B to A transitions', () => {
  const view = render(
    <StrictMode>
      <BrowserAnalyticsBoundary runtime={runtime} context={home}>
        <main>Public home</main>
      </BrowserAnalyticsBoundary>
    </StrictMode>,
    { container },
  );
  expect(events().map((entry) => entry[1])).toEqual(['page_view']);
  view.unmount();
  container = owner.createElement('div');
  owner.body.appendChild(container);
  const second = render(
    <BrowserAnalyticsBoundary runtime={runtime} context={home}>
      <main>A</main>
    </BrowserAnalyticsBoundary>,
    { container },
  );
  second.rerender(
    <BrowserAnalyticsBoundary runtime={runtime} context={about}>
      <main>B</main>
    </BrowserAnalyticsBoundary>,
  );
  second.rerender(
    <BrowserAnalyticsBoundary runtime={runtime} context={home}>
      <main>A</main>
    </BrowserAnalyticsBoundary>,
  );
  expect(events().map((entry) => (entry[2] as { page_location: string }).page_location)).toEqual([
    'https://portfolio.example.invalid/en',
    'https://portfolio.example.invalid/en/about',
    'https://portfolio.example.invalid/en',
  ]);
  expect(io.scripts).toHaveLength(1);
  expect(container.children).toHaveLength(1);
  expect(container.firstElementChild?.tagName).toBe('MAIN');
});

it('does not complete a suspended target that is replaced before commit', () => {
  const pending = new Promise<never>(() => {});
  function Content({ suspend = false }) {
    if (suspend) throw pending;
    return <main>Public</main>;
  }
  const view = render(
    <Suspense fallback={<p>Loading</p>}>
      <BrowserAnalyticsBoundary runtime={runtime} context={home}>
        <Content />
      </BrowserAnalyticsBoundary>
    </Suspense>,
    { container },
  );
  view.rerender(
    <Suspense fallback={<p>Loading</p>}>
      <BrowserAnalyticsBoundary runtime={runtime} context={about}>
        <Content suspend />
      </BrowserAnalyticsBoundary>
    </Suspense>,
  );
  view.rerender(
    <Suspense fallback={<p>Loading</p>}>
      <BrowserAnalyticsBoundary runtime={runtime} context={home}>
        <Content />
      </BrowserAnalyticsBoundary>
    </Suspense>,
  );
  expect(events().map((entry) => (entry[2] as { page_location: string }).page_location)).toEqual([
    'https://portfolio.example.invalid/en',
  ]);
  expect(io.scripts).toHaveLength(1);
});

it('respects React cancellation and removes native contacts when the context becomes excluded', async () => {
  const content = (
    <main>
      <a
        href="/synthetic"
        target="_blank"
        data-analytics-purpose="resume"
        onClick={(event) => event.preventDefault()}
      >
        Canceled
      </a>
      <a href="/synthetic" target="_blank" data-analytics-purpose="email">
        Email
      </a>
    </main>
  );
  const view = render(
    <BrowserAnalyticsBoundary runtime={runtime} context={home}>
      {content}
    </BrowserAnalyticsBoundary>,
    { container },
  );
  fireEvent.click(container.querySelector('a')!);
  fireEvent.click(container.querySelectorAll('a')[1]);
  await Promise.resolve();
  expect(events().map((entry) => entry[1])).toEqual(['page_view', 'contact_email_click']);
  view.rerender(
    <BrowserAnalyticsBoundary runtime={{ ...runtime, environment: 'test' }} context={home}>
      {content}
    </BrowserAnalyticsBoundary>,
  );
  fireEvent.click(container.querySelectorAll('a')[1]);
  await Promise.resolve();
  expect(events().map((entry) => entry[1])).toEqual(['page_view', 'contact_email_click']);
});

it('does not initialize the captured transport when mounted only in an excluded environment', () => {
  render(
    <BrowserAnalyticsBoundary runtime={{ ...runtime, environment: 'staging' }} context={home}>
      <main>Unmeasured</main>
    </BrowserAnalyticsBoundary>,
    { container },
  );
  expect(io.scripts).toEqual([]);
  expect(host.dataLayer).toBeUndefined();
  expect(container.textContent).toBe('Unmeasured');
});
