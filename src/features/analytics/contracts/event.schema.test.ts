import { describe, expect, it } from 'vitest';
import { portfolioAnalyticsEventSchema, publicAnalyticsContextSchema } from './event.schema';

const page = { locale: 'en', pagePath: '/en' };

describe('closed analytics payload', () => {
  // A loose object or open event name would leak unapproved metrics/PII.
  it.each(['page_view', 'contact_email_click', 'contact_linkedin_click', 'resume_open'])(
    'accepts only the minimal %s payload',
    (name) => {
      expect(portfolioAnalyticsEventSchema.parse({ name, ...page })).toEqual({ name, ...page });
    },
  );

  it.each(['email', 'href', 'label', 'personName', 'token', 'user_id', 'content', 'client_id'])(
    'rejects an extra %s field rather than silently stripping it',
    (key) => {
      expect(
        portfolioAnalyticsEventSchema.safeParse({ name: 'page_view', ...page, [key]: 'secret' })
          .success,
      ).toBe(false);
    },
  );

  it.each(['scroll', 'file_download', 'click', 'login', 'user_engagement'])(
    'rejects the unapproved %s event',
    (name) => {
      expect(portfolioAnalyticsEventSchema.safeParse({ name, ...page }).success).toBe(false);
    },
  );

  // Accepting arbitrary paths would turn URLs into a PII/preview side channel.
  it.each([
    '/en?email=synthetic@example.invalid',
    '/en#token',
    '//other.invalid/en',
    'https://other.invalid/en',
    '/admin',
    '/en/admin',
    '/api/users/reset-password/token',
    '/preview-ui/en/cases/example',
    '/preview-media/secret/original',
    '/private/en',
    '/en/cases/../../private',
    '/en/cases/token/123',
    '/en/cases/[case]?token=secret',
    '/pt/about',
    '/en/sobre',
    '/en/',
    '/en/%61dmin',
    '/en\\admin',
    '/en\n',
    '/en/cases/project\n',
  ])('rejects unsafe or unapproved page path %j', (pagePath) => {
    expect(publicAnalyticsContextSchema.safeParse({ locale: 'en', pagePath }).success).toBe(false);
  });

  it.each([
    ['pt', '/pt'],
    ['pt', '/pt/cases'],
    ['pt', '/pt/sobre'],
    ['pt', '/pt/cases/synthetic-project'],
    ['en', '/en'],
    ['en', '/en/cases'],
    ['en', '/en/about'],
    ['en', '/en/cases/synthetic-project'],
  ])('permits only the known public %s route template %s', (locale, pagePath) => {
    expect(publicAnalyticsContextSchema.parse({ locale, pagePath })).toEqual({ locale, pagePath });
  });

  it('rejects a locale/path mismatch', () => {
    expect(publicAnalyticsContextSchema.safeParse({ locale: 'pt', pagePath: '/en' }).success).toBe(
      false,
    );
  });

  it('rejects extra public context fields', () => {
    expect(publicAnalyticsContextSchema.safeParse({ ...page, title: 'private' }).success).toBe(
      false,
    );
  });
});

// Case slug text does not change a confirmed public case route into a private route.
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
] as const)('keeps approved events for the confirmed public case %s %s', (locale, pagePath) => {
  const context = { locale, pagePath };
  for (const name of [
    'page_view',
    'contact_email_click',
    'contact_linkedin_click',
    'resume_open',
  ] as const) {
    const event = { name, ...context };
    expect(portfolioAnalyticsEventSchema.safeParse(event)).toEqual({ success: true, data: event });
  }
  expect(publicAnalyticsContextSchema.safeParse(context)).toEqual({ success: true, data: context });
});
