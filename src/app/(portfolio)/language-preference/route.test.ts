import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validServerEnv } from '../../../../testing/fixtures/content';
import { POST } from './route';

const origin = 'http://127.0.0.1:3100';

beforeEach(() => {
  for (const [key, value] of Object.entries(validServerEnv())) vi.stubEnv(key, value);
  vi.stubEnv('MEDIA_STORAGE_ROOT', undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function request(body: unknown, requestedOrigin: string | null = origin) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (requestedOrigin !== null) headers.set('origin', requestedOrigin);
  return new Request(`${origin}/language-preference`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /language-preference', () => {
  it.each(['pt', 'en'] as const)(
    'saves only the manual %s preference and does not navigate',
    async (locale) => {
      const response = await POST(request({ locale }));
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain(`portfolio_locale=${locale};`);
      expect(cookies[0]).toContain('Path=/');
      expect(cookies[0]).toContain('Max-Age=15552000');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=lax');
      expect(cookies[0]).not.toMatch(/Domain=|; Secure(?:;|$)/i);
    },
  );

  it.each([
    { locale: 'pt-BR' },
    { locale: 'EN' },
    { locale: ' pt ' },
    { locale: '' },
    { locale: null },
    { locale: 1 },
    {},
    null,
    ['pt'],
    'pt',
    { locale: 'pt', returnTo: 'https://elsewhere.example' },
    { locale: 'en', siteOrigin: 'https://elsewhere.example' },
    { locale: 'pt', visitorId: 'unexpected' },
  ])('rejects a body outside the closed locale-only contract: %j', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([null, 'null', 'https://elsewhere.example', 'http://127.0.0.1:3101', `${origin}/path`])(
    'rejects untrusted Origin %j before changing a cookie',
    async (requestedOrigin) => {
      const response = await POST(request({ locale: 'pt' }, requestedOrigin));
      expect(response.status).toBe(403);
      expect(response.headers.has('set-cookie')).toBe(false);
      expect(response.headers.has('location')).toBe(false);
    },
  );

  it('rejects malformed JSON without setting a cookie', async () => {
    const response = await POST(
      new Request(`${origin}/language-preference`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: '{"locale":',
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('rejects a non-JSON content type even if the text contains a valid locale', async () => {
    const response = await POST(
      new Request(`${origin}/language-preference`, {
        method: 'POST',
        headers: { origin, 'content-type': 'text/plain' },
        body: '{"locale":"pt"}',
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('derives Secure only from the configured HTTPS origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('SITE_ORIGIN', 'https://portfolio.example');
    const response = await POST(
      new Request('http://untrusted.example/language-preference', {
        method: 'POST',
        headers: {
          origin: 'https://portfolio.example',
          'content-type': 'application/json',
          'x-forwarded-proto': 'http',
          'x-forwarded-host': 'untrusted.example',
        },
        body: '{"locale":"en"}',
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/; Secure(?:;|$)/);
  });

  it('restarts the cookie deadline on another manual choice', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = await POST(request({ locale: 'pt' }));
    expect(first.headers.get('set-cookie')).toContain('Expires=Tue, 30 Jun 2026 00:00:00 GMT');
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const next = await POST(request({ locale: 'en' }));
    expect(next.headers.get('set-cookie')).toContain('Expires=Wed, 01 Jul 2026 00:00:00 GMT');
  });
});
