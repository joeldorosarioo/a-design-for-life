// @vitest-environment jsdom
import React, { StrictMode, Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createAnalyticsSession } from '../analytics-session';
import type { PortfolioAnalyticsEvent } from '../contracts/event.schema';
import { AnalyticsProvider } from './analytics-provider';
import { TrackedLink } from './tracked-link';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const home = { locale: 'en', pagePath: '/en' } as const;
const about = { locale: 'en', pagePath: '/en/about' } as const;
function capture(enabled = true) {
  const events: PortfolioAnalyticsEvent[] = [];
  const session = createAnalyticsSession({
    runtime: {
      environment: 'production',
      area: 'public',
      preview: false,
      publicSiteEnabled: enabled,
      measurementId: 'G-TESTONLY1',
      siteOrigin: 'https://portfolio.example.invalid',
    },
    createTransport: () => ({
      send(event) {
        events.push(event);
      },
    }),
  });
  return { session, events };
}

it('counts one completed view across StrictMode and a provider remount with the same document session', () => {
  const { session, events } = capture();
  const view = render(
    <StrictMode>
      <AnalyticsProvider session={session} context={home}>
        <main>Public home</main>
      </AnalyticsProvider>
    </StrictMode>,
  );
  expect(events).toEqual([{ name: 'page_view', locale: 'en', pagePath: '/en' }]);
  view.unmount();
  render(
    <AnalyticsProvider session={session} context={home}>
      <main>Public home</main>
    </AnalyticsProvider>,
  );
  expect(events).toHaveLength(1);
  expect(screen.getByRole('main')).toHaveTextContent('Public home');
});

it('counts completed A to B to A transitions without counting a same-page rerender', () => {
  const { session, events } = capture();
  const view = render(
    <AnalyticsProvider session={session} context={home}>
      A
    </AnalyticsProvider>,
  );
  view.rerender(
    <AnalyticsProvider session={session} context={{ ...home }}>
      A updated
    </AnalyticsProvider>,
  );
  view.rerender(
    <AnalyticsProvider session={session} context={about}>
      B
    </AnalyticsProvider>,
  );
  view.rerender(
    <AnalyticsProvider session={session} context={home}>
      A
    </AnalyticsProvider>,
  );
  expect(events).toEqual([
    { name: 'page_view', locale: 'en', pagePath: '/en' },
    { name: 'page_view', locale: 'en', pagePath: '/en/about' },
    { name: 'page_view', locale: 'en', pagePath: '/en' },
  ]);
});

it('does not count a suspended navigation that is replaced before it commits', () => {
  const { session, events } = capture();
  const pending = new Promise<never>(() => {});
  function Content({ suspend = false }) {
    if (suspend) throw pending;
    return <main>Public page</main>;
  }
  const view = render(
    <Suspense fallback={<p>Loading</p>}>
      <AnalyticsProvider session={session} context={home}>
        <Content />
      </AnalyticsProvider>
    </Suspense>,
  );
  view.rerender(
    <Suspense fallback={<p>Loading</p>}>
      <AnalyticsProvider session={session} context={about}>
        <Content suspend />
      </AnalyticsProvider>
    </Suspense>,
  );
  view.rerender(
    <Suspense fallback={<p>Loading</p>}>
      <AnalyticsProvider session={session} context={home}>
        <Content />
      </AnalyticsProvider>
    </Suspense>,
  );
  expect(events).toEqual([{ name: 'page_view', locale: 'en', pagePath: '/en' }]);
});

it('adds no visible wrapper or consent choice while disabled', () => {
  const { session, events } = capture(false);
  const { container } = render(
    <AnalyticsProvider session={session} context={home}>
      <main>Public content</main>
    </AnalyticsProvider>,
  );
  expect(container.children).toHaveLength(1);
  expect(container.firstElementChild?.tagName).toBe('MAIN');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(events).toEqual([]);
});

it('tracks fixed link purposes while preserving native href, label and new-tab attributes', () => {
  const { session, events } = capture();
  render(
    <AnalyticsProvider session={session} context={home}>
      <TrackedLink purpose="email" href="mailto:synthetic@example.invalid">
        Write email
      </TrackedLink>
      <TrackedLink
        purpose="linkedin"
        href="https://www.linkedin.com/in/synthetic"
        target="_blank"
        rel="noopener noreferrer"
      >
        LinkedIn
      </TrackedLink>
      <TrackedLink
        purpose="resume"
        href="/media/synthetic/original"
        target="_blank"
        rel="noopener noreferrer"
      >
        Resume
      </TrackedLink>
    </AnalyticsProvider>,
  );
  const email = screen.getByRole('link', { name: 'Write email' });
  expect(email).toHaveAttribute('href', 'mailto:synthetic@example.invalid');
  // Intercept only native navigation, after the real React action handler.
  let nativeActionPreserved = false;
  document.addEventListener(
    'click',
    (event) => {
      nativeActionPreserved = !event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  fireEvent.click(email);
  fireEvent.click(screen.getByRole('link', { name: 'LinkedIn' }));
  const resume = screen.getByRole('link', { name: 'Resume' });
  fireEvent.click(resume);
  expect(resume).toHaveAttribute('href', '/media/synthetic/original');
  expect(resume).toHaveAttribute('target', '_blank');
  expect(resume).toHaveAttribute('rel', 'noopener noreferrer');
  expect(nativeActionPreserved).toBe(true);
  expect(events).toEqual([
    { name: 'page_view', locale: 'en', pagePath: '/en' },
    { name: 'contact_email_click', locale: 'en', pagePath: '/en' },
    { name: 'contact_linkedin_click', locale: 'en', pagePath: '/en' },
    { name: 'resume_open', locale: 'en', pagePath: '/en' },
  ]);
});

it('skips prevented actions and right-clicks, but counts the middle-button open action once', () => {
  const { session, events } = capture();
  render(
    <AnalyticsProvider session={session} context={home}>
      <TrackedLink
        purpose="resume"
        href="/media/synthetic/original"
        target="_blank"
        onClick={(event) => event.preventDefault()}
      >
        Canceled
      </TrackedLink>
      <TrackedLink purpose="resume" href="/media/synthetic/original" target="_blank">
        Resume
      </TrackedLink>
    </AnalyticsProvider>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Canceled' }));
  const resume = screen.getByRole('link', { name: 'Resume' });
  fireEvent.click(resume, { button: 1 });
  fireEvent(resume, new MouseEvent('auxclick', { button: 2, bubbles: true }));
  fireEvent(resume, new MouseEvent('auxclick', { button: 1, bubbles: true }));
  expect(events).toEqual([
    { name: 'page_view', locale: 'en', pagePath: '/en' },
    { name: 'resume_open', locale: 'en', pagePath: '/en' },
  ]);
});

it('does not read the functional locale cookie or browser storage during measurement', () => {
  vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
    throw new Error('cookie read');
  });
  vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
    throw new Error('cookie write');
  });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage read');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage write');
  });
  const { session, events } = capture();
  render(
    <AnalyticsProvider session={session} context={home}>
      <TrackedLink purpose="resume" href="/media/synthetic/original" target="_blank">
        Resume
      </TrackedLink>
    </AnalyticsProvider>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Resume' }));
  expect(events).toEqual([
    { name: 'page_view', locale: 'en', pagePath: '/en' },
    { name: 'resume_open', locale: 'en', pagePath: '/en' },
  ]);
});

it('keeps an ordinary accessible link functional without a provider', () => {
  render(
    <TrackedLink purpose="resume" href="/media/synthetic/original" target="_blank">
      Resume
    </TrackedLink>,
  );
  const resume = screen.getByRole('link', { name: 'Resume' });
  expect(resume).toHaveAttribute('href', '/media/synthetic/original');
  expect(() => fireEvent.click(resume)).not.toThrow();
});
