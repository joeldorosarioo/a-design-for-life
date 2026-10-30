import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /', () => {
  it.each([
    ['pt', 'en-US,en;q=0.9', '/pt'],
    ['en', 'pt-BR,pt;q=0.9', '/en'],
    [null, 'en;q=0.5,pt-BR;q=0.9', '/pt'],
    [null, 'pt;q=0.4,en-US;q=0.9', '/en'],
    ['invalid', 'pt-BR', '/pt'],
    ['pt-BR', 'fr-FR', '/en'],
    [null, 'pt;q=invalid,en;q=0.5', '/en'],
    [null, 'fr-FR', '/en'],
    [null, null, '/en'],
  ] as const)(
    'temporarily negotiates %j / %j to %s without saving a preference',
    (saved, accepted, location) => {
      const headers = new Headers();
      if (saved !== null) headers.set('cookie', `portfolio_locale=${saved}`);
      if (accepted !== null) headers.set('accept-language', accepted);
      const response = GET(new NextRequest('http://127.0.0.1:3100/', { headers }));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(location);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.has('set-cookie')).toBe(false);
    },
  );

  it('never turns a query or untrusted host into the redirect destination', () => {
    const response = GET(
      new NextRequest(
        'https://untrusted.example/?next=https://elsewhere.example&returnTo=//elsewhere.example',
        {
          headers: {
            host: 'elsewhere.example',
            'x-forwarded-host': 'elsewhere.example',
            'x-forwarded-proto': 'http',
            'accept-language': 'pt-BR',
          },
        },
      ),
    );
    expect(response.headers.get('location')).toBe('/pt');
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('re-evaluates independent visits instead of reusing another visitor preference', () => {
    expect(
      GET(
        new NextRequest('http://127.0.0.1:3100/', { headers: { cookie: 'portfolio_locale=pt' } }),
      ).headers.get('location'),
    ).toBe('/pt');
    expect(
      GET(
        new NextRequest('http://127.0.0.1:3100/', { headers: { cookie: 'portfolio_locale=en' } }),
      ).headers.get('location'),
    ).toBe('/en');
    expect(
      GET(
        new NextRequest('http://127.0.0.1:3100/', { headers: { 'accept-language': 'fr' } }),
      ).headers.get('location'),
    ).toBe('/en');
  });
});
