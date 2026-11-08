import { describe, expect, it } from 'vitest';
import { createGtagSession, type GtagCommand } from './gtag-session';
import type { AnalyticsRuntime } from './analytics-session';
import type { PortfolioAnalyticsEvent } from './contracts/event.schema';
const runtime: AnalyticsRuntime = {
  environment: 'production',
  area: 'public',
  preview: false,
  publicSiteEnabled: true,
  measurementId: 'G-TESTONLY1',
  siteOrigin: 'https://portfolio.example.invalid',
};
const home = { locale: 'en', pagePath: '/en' } as const;

describe('intercepted gtag boundary', () => {
  it('queues denied consent and sanitized privacy defaults before configuration and measurement', () => {
    const commands: GtagCommand[] = [];
    const session = createGtagSession({
      runtime,
      dispatch: (...command) => {
        commands.push(command);
      },
    });
    expect(commands).toEqual([]);
    session.completeNavigation(home);
    expect(commands).toEqual([
      [
        'consent',
        'default',
        {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        },
      ],
      [
        'set',
        {
          send_page_view: false,
          screen_resolution: '',
          ads_data_redaction: true,
          url_passthrough: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
          language: 'en',
          ignore_referrer: true,
        },
      ],
      ['js', expect.any(Date)],
      ['config', 'G-TESTONLY1', { send_page_view: false }],
      [
        'event',
        'page_view',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
    ]);
  });

  // A direct adapter call must still obey the runtime gate, even outside React.
  it('never dispatches initialization commands while the site is private', () => {
    const commands: GtagCommand[] = [];
    const session = createGtagSession({
      runtime: { ...runtime, publicSiteEnabled: false },
      dispatch: (...command) => {
        commands.push(command);
      },
    });
    session.completeNavigation(home);
    session.trackContact('resume', home);
    expect(commands).toEqual([]);
  });

  it('updates only sanitized public context and emits only the four approved events', () => {
    const commands: GtagCommand[] = [];
    const session = createGtagSession({
      runtime,
      dispatch: (...command) => {
        commands.push(command);
      },
    });
    session.completeNavigation(home);
    session.trackContact('email', home);
    session.trackContact('linkedin', { locale: 'pt', pagePath: '/pt/sobre' });
    session.trackContact('resume', { locale: 'pt', pagePath: '/pt/cases/project-a' });
    expect(commands.filter((command) => command[0] === 'event')).toEqual([
      [
        'event',
        'page_view',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'contact_email_click',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'contact_linkedin_click',
        {
          send_to: 'G-TESTONLY1',
          language: 'pt',
          page_location: 'https://portfolio.example.invalid/pt/sobre',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'resume_open',
        {
          send_to: 'G-TESTONLY1',
          language: 'pt',
          page_location: 'https://portfolio.example.invalid/pt/cases/project-a',
          page_referrer: '',
          page_title: '',
        },
      ],
    ]);
    expect(commands.filter((command) => command[0] === 'config')).toHaveLength(1);
    expect(commands.filter((command) => command[0] === 'consent')).toHaveLength(1);
    expect(commands.at(-2)).toEqual([
      'set',
      {
        page_location: 'https://portfolio.example.invalid/pt/cases/project-a',
        page_referrer: '',
        page_title: '',
        language: 'pt',
        ignore_referrer: true,
      },
    ]);
  });

  it('never dispatches a URL label or invalid event, even from an untyped caller', () => {
    const commands: GtagCommand[] = [];
    const session = createGtagSession({
      runtime,
      dispatch: (...command) => {
        commands.push(command);
      },
    });
    session.track({
      name: 'contact_email_click',
      ...home,
      href: 'mailto:secret@example.invalid',
    } as PortfolioAnalyticsEvent);
    session.track({ name: 'page_view', ...home, pagePath: '/en?token=secret' });
    expect(commands).toEqual([]);
  });
});
it('fails closed if consent initialization dispatch throws before configuration', () => {
  const commands: GtagCommand[] = [];
  const session = createGtagSession({
    runtime,
    dispatch: (...command) => {
      commands.push(command);
      if (command[0] === 'consent') throw new Error('blocked dispatch');
    },
  });
  session.completeNavigation(home);
  session.trackContact('resume', home);
  expect(commands).toEqual([
    [
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ],
  ]);
});
