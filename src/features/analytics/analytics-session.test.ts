import { describe, expect, it } from 'vitest';
import {
  createAnalyticsSession,
  type AnalyticsRuntime,
  type AnalyticsTransport,
} from './analytics-session';
import type { PortfolioAnalyticsEvent } from './contracts/event.schema';

const allowed: AnalyticsRuntime = {
  environment: 'production',
  area: 'public',
  preview: false,
  publicSiteEnabled: true,
  measurementId: 'G-TESTONLY1',
  siteOrigin: 'https://portfolio.example.invalid',
};
const home = { locale: 'en', pagePath: '/en' } as const;
const about = { locale: 'en', pagePath: '/en/about' } as const;

function capture(runtime: AnalyticsRuntime = allowed) {
  const events: PortfolioAnalyticsEvent[] = [];
  const initialized: unknown[] = [];
  const session = createAnalyticsSession({
    runtime,
    createTransport(config) {
      initialized.push(config);
      return {
        send(event) {
          events.push(event);
        },
      };
    },
  });
  return { session, events, initialized };
}

describe('document-scoped analytics session', () => {
  // Losing either guard would initialize an outbound provider in a forbidden context.
  it.each([
    { environment: 'local' },
    { environment: 'test' },
    { environment: 'staging' },
    { area: 'admin' },
    { area: 'private' },
    { preview: true },
    { publicSiteEnabled: false },
    { measurementId: null },
    { measurementId: 'invalid' },
    { siteOrigin: 'http://127.0.0.1:3000' },
    { siteOrigin: 'https://portfolio.example.invalid/?token=secret' },
    { siteOrigin: 'https://user:password@portfolio.example.invalid' },
  ])('never invokes transport for excluded runtime %j', (override) => {
    const { session, events, initialized } = capture({ ...allowed, ...override });
    session.completeNavigation(home);
    session.trackContact('email', home);
    expect(events).toEqual([]);
    expect(initialized).toEqual([]);
  });

  it('waits for a valid completed navigation or explicit action before initialization', () => {
    const { session, events, initialized } = capture();
    expect(initialized).toEqual([]);
    expect(events).toEqual([]);
    session.completeNavigation(home);
    expect(initialized).toEqual([
      {
        measurementId: 'G-TESTONLY1',
        siteOrigin: 'https://portfolio.example.invalid',
      },
    ]);
    expect(events).toEqual([{ name: 'page_view', locale: 'en', pagePath: '/en' }]);
  });

  // Removing consecutive-completion dedup duplicates React remounts and StrictMode effects.
  it('counts A to B to A while suppressing repeats of each completed page', () => {
    const { session, events, initialized } = capture();
    session.completeNavigation(home);
    session.completeNavigation(home);
    session.completeNavigation(about);
    session.completeNavigation(about);
    session.completeNavigation(home);
    expect(events).toEqual([
      { name: 'page_view', locale: 'en', pagePath: '/en' },
      { name: 'page_view', locale: 'en', pagePath: '/en/about' },
      { name: 'page_view', locale: 'en', pagePath: '/en' },
    ]);
    expect(initialized).toHaveLength(1);
  });

  it('keeps distinct confirmed case paths distinct', () => {
    const { session, events } = capture();
    session.completeNavigation({ locale: 'pt', pagePath: '/pt/cases/project-a' });
    session.completeNavigation({ locale: 'pt', pagePath: '/pt/cases/project-b' });
    expect(events).toEqual([
      { name: 'page_view', locale: 'pt', pagePath: '/pt/cases/project-a' },
      { name: 'page_view', locale: 'pt', pagePath: '/pt/cases/project-b' },
    ]);
  });

  // Only calling completion after commit means an abandoned target has no event.
  it('does not count a target that was never completed', () => {
    const { session, events } = capture();
    session.completeNavigation(home);
    // A router may begin work for about, but it must not call completion until committed.
    expect(events).toEqual([{ name: 'page_view', locale: 'en', pagePath: '/en' }]);
  });

  it('maps fixed contact purposes to minimal action events and counts repeated actions', () => {
    const { session, events } = capture();
    session.trackContact('email', home);
    session.trackContact('linkedin', home);
    session.trackContact('resume', home);
    session.trackContact('resume', home);
    expect(events).toEqual([
      { name: 'contact_email_click', locale: 'en', pagePath: '/en' },
      { name: 'contact_linkedin_click', locale: 'en', pagePath: '/en' },
      { name: 'resume_open', locale: 'en', pagePath: '/en' },
      { name: 'resume_open', locale: 'en', pagePath: '/en' },
    ]);
  });

  it.each([
    { name: 'page_view', ...home, email: 'synthetic@example.invalid' },
    { name: 'page_view', locale: 'en', pagePath: '/en?token=secret' },
    { name: 'page_view', locale: 'pt', pagePath: '/en' },
    { name: 'file_download', ...home },
  ])('rejects invalid runtime event input before any transport invocation', (event) => {
    const { session, events, initialized } = capture();
    session.track(event as PortfolioAnalyticsEvent);
    expect(events).toEqual([]);
    expect(initialized).toEqual([]);
  });

  it('revalidates completion context and contact purpose at runtime', () => {
    const { session, events, initialized } = capture();
    session.completeNavigation({ ...home, href: 'mailto:secret@example.invalid' } as typeof home);
    session.trackContact('email', { ...home, pagePath: '/preview-ui/en' });
    session.trackContact('unexpected' as 'email', home);
    expect(events).toEqual([]);
    expect(initialized).toEqual([]);
  });

  it('uses the same page-view deduplication through track', () => {
    const { session, events } = capture();
    session.track({ name: 'page_view', ...home });
    session.completeNavigation(home);
    expect(events).toHaveLength(1);
  });

  it('does not turn an unavailable transport into a product navigation failure or retry loop', () => {
    let attempts = 0;
    const broken: AnalyticsTransport = {
      send() {
        attempts++;
        throw new Error('unavailable');
      },
    };
    const session = createAnalyticsSession({ runtime: allowed, createTransport: () => broken });
    expect(() => session.completeNavigation(home)).not.toThrow();
    session.completeNavigation(home);
    session.trackContact('resume', home);
    expect(attempts).toBe(1);
  });

  it('does not retry a failing initializer on subsequent actions', () => {
    let attempts = 0;
    const session = createAnalyticsSession({
      runtime: allowed,
      createTransport() {
        attempts++;
        throw new Error('unavailable');
      },
    });
    expect(() => session.trackContact('resume', home)).not.toThrow();
    session.trackContact('email', home);
    expect(attempts).toBe(1);
  });
});

// A blacklist here would silently omit a published case's views and contact actions.
it.each([
  ['pt', '/pt/cases/admin'],
  ['en', '/en/cases/api'],
  ['pt', '/pt/cases/draft'],
  ['en', '/en/cases/drafts'],
  ['pt', '/pt/cases/preview'],
  ['en', '/en/cases/preview-ui'],
  ['pt', '/pt/cases/preview-media'],
  ['en', '/en/cases/private'],
  ['pt', '/pt/cases/login'],
  ['en', '/en/cases/logout'],
  ['pt', '/pt/cases/reset'],
  ['en', '/en/cases/reset-password'],
  ['pt', '/pt/cases/forgot-password'],
] as const)(
  'measures the confirmed public case %s %s regardless of its slug words',
  (locale, pagePath) => {
    const { session, events, initialized } = capture();
    const context = { locale, pagePath };
    session.completeNavigation(context);
    session.trackContact('email', context);
    session.trackContact('linkedin', context);
    session.trackContact('resume', context);
    expect(events).toEqual([
      { name: 'page_view', locale, pagePath },
      { name: 'contact_email_click', locale, pagePath },
      { name: 'contact_linkedin_click', locale, pagePath },
      { name: 'resume_open', locale, pagePath },
    ]);
    expect(initialized).toHaveLength(1);
  },
);
