import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLanguagePreference } from './set-language-preference';

const context = { siteOrigin: 'https://portfolio.example' };

afterEach(() => {
  vi.useRealTimers();
});

describe('setLanguagePreference', () => {
  it.each(['pt', 'en'] as const)(
    'writes only the manual %s preference with safe attributes',
    (locale) => {
      const response = new NextResponse();

      setLanguagePreference(locale, response, context);

      expect(response.cookies.get('portfolio_locale')).toMatchObject({
        name: 'portfolio_locale',
        value: locale,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: true,
        maxAge: 15552000,
      });
      const header = response.headers.get('set-cookie');
      expect(header).toContain(`portfolio_locale=${locale};`);
      expect(header).toContain('Path=/');
      expect(header).toContain('Max-Age=15552000');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=lax');
      expect(header).toContain('Secure');
      expect(header).not.toMatch(/Domain=/i);
      expect(response.cookies.getAll()).toHaveLength(1);
    },
  );

  it('uses the supplied HTTP origin even for a redirect to HTTPS', () => {
    const response = NextResponse.redirect('https://portfolio.example/en');

    setLanguagePreference('en', response, { siteOrigin: 'http://127.0.0.1:3101' });

    expect(response.headers.get('set-cookie')).not.toMatch(/; Secure(?:;|$)/);
    expect(response.cookies.get('portfolio_locale')?.secure).toBe(false);
  });

  it('starts the 180-day deadline at each manual call', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = new NextResponse();
    setLanguagePreference('pt', first, context);
    expect(first.cookies.get('portfolio_locale')?.expires).toEqual(
      new Date('2026-06-30T00:00:00Z'),
    );

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const next = new NextResponse();
    setLanguagePreference('en', next, context);
    expect(next.cookies.get('portfolio_locale')?.expires).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  it.each(['pt-BR', 'EN', ' pt ', '', null, undefined, { locale: 'pt' }])(
    'rejects invalid preference %j before changing the response',
    (locale) => {
      const response = new NextResponse();
      response.cookies.set('unrelated', 'keep');

      expect(() => setLanguagePreference(locale, response, context)).toThrow();
      expect(response.headers.getSetCookie()).toEqual(['unrelated=keep; Path=/']);
    },
  );

  it.each([
    '',
    'not a URL',
    '/relative',
    'ftp://portfolio.example',
    'javascript:alert(1)',
    'https://portfolio.example/path',
    'https://portfolio.example?query=1',
    'https://portfolio.example#fragment',
    'https://user:password@portfolio.example',
  ])('rejects invalid origin %j before writing a cookie', (siteOrigin) => {
    const response = new NextResponse();

    expect(() => setLanguagePreference('pt', response, { siteOrigin })).toThrow();
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('preserves unrelated response cookies and status', () => {
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set('unrelated', 'keep');

    setLanguagePreference('pt', response, context);

    expect(response.cookies.get('unrelated')?.value).toBe('keep');
    expect(response.cookies.getAll()).toHaveLength(2);
    expect(response.status).toBe(204);
  });
});
