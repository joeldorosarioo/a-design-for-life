import { expect, test, type APIResponse, type BrowserContext } from '@playwright/test';

function expectPrivate(response: APIResponse) {
  const cache = response.headers()['cache-control'] ?? '';
  expect(cache).toMatch(/(?:^|,)\s*private\s*(?:,|$)/i);
  expect(cache).toMatch(/(?:^|,)\s*no-store\s*(?:,|$)/i);
  expect(cache).not.toMatch(/(?:^|,)\s*public\s*(?:,|$)|s-maxage/i);
}

async function preference(context: BrowserContext) {
  const saved = (await context.cookies()).find((cookie) => cookie.name === 'portfolio_locale');
  expect(saved).toBeDefined();
  if (!saved) throw new Error('Expected the manual language preference');
  return saved;
}

test.describe('language entry and manual preference over production HTTP', () => {
  test('negotiates each root request privately without creating a cookie', async ({
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Expected the configured test origin');
    const cases = [
      { saved: 'pt', accepted: 'en-US', location: '/pt' },
      { saved: 'en', accepted: 'pt-BR', location: '/en' },
      { saved: null, accepted: 'en;q=0.5,pt-BR;q=0.9', location: '/pt' },
      { saved: 'invalid', accepted: 'pt-BR', location: '/pt' },
      { saved: null, accepted: 'fr-FR', location: '/en' },
    ];
    for (const item of cases) {
      await context.clearCookies({ name: 'portfolio_locale' });
      if (item.saved !== null)
        await context.addCookies([{ name: 'portfolio_locale', value: item.saved, url: baseURL }]);
      const response = await context.request.get('/', {
        headers: { 'Accept-Language': item.accepted },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe(item.location);
      expect(response.headers()['set-cookie']).toBeUndefined();
      expectPrivate(response);
    }
  });

  test('ignores external redirect hints and forwarded hosts', async ({ context }) => {
    const response = await context.request.get(
      '/?next=https://elsewhere.example&returnTo=//elsewhere.example',
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'X-Forwarded-Host': 'elsewhere.example',
          'X-Forwarded-Proto': 'https',
        },
        maxRedirects: 0,
      },
    );
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/pt');
    expect(response.headers()['set-cookie']).toBeUndefined();
  });

  test('saves manually, preserves the deadline during visits, and renews on another choice', async ({
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Expected the configured test origin');
    const first = await context.request.post('/language-preference', {
      headers: { Origin: new URL(baseURL).origin },
      data: { locale: 'pt' },
    });
    expect(first.status()).toBe(204);
    expect(first.headers().location).toBeUndefined();
    expectPrivate(first);
    const header = first.headers()['set-cookie'];
    expect(header).toContain('portfolio_locale=pt;');
    expect(header).toMatch(/Max-Age=15552000/i);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).not.toMatch(/Domain=/i);
    const saved = await preference(context);
    expect(saved).toMatchObject({ value: 'pt', path: '/', httpOnly: true, sameSite: 'Lax' });
    expect(saved.secure).toBe(new URL(baseURL).protocol === 'https:');

    // Simulate an already-aged cookie without changing the browser/OS clock.
    const aged = { ...saved, expires: saved.expires - 60 };
    await context.addCookies([aged]);
    for (const method of ['get', 'head'] as const) {
      const visit = await context.request[method]('/', {
        headers: { 'Accept-Language': 'en-US' },
        maxRedirects: 0,
      });
      expect(visit.status()).toBe(307);
      expect(visit.headers().location).toBe('/pt');
      expect(visit.headers()['set-cookie']).toBeUndefined();
      expectPrivate(visit);
      expect((await preference(context)).expires).toBe(aged.expires);
    }

    const next = await context.request.post('/language-preference', {
      headers: { Origin: new URL(baseURL).origin },
      data: { locale: 'en' },
    });
    expect(next.status()).toBe(204);
    expect(next.headers()['set-cookie']).toMatch(/portfolio_locale=en;.*Max-Age=15552000/i);
    const renewed = await preference(context);
    expect(renewed.value).toBe('en');
    expect(renewed.expires).toBeGreaterThan(aged.expires + 50);
    expect((await context.cookies()).map((cookie) => cookie.name)).toEqual(['portfolio_locale']);
  });

  for (const state of ['expired', 'removed'] as const) {
    test(`resumes the browser preference after a cookie is ${state}`, async ({
      context,
      baseURL,
    }) => {
      if (!baseURL) throw new Error('Expected the configured test origin');
      await context.request.post('/language-preference', {
        headers: { Origin: new URL(baseURL).origin },
        data: { locale: 'en' },
      });
      const saved = await preference(context);
      if (state === 'expired') await context.addCookies([{ ...saved, expires: 1 }]);
      else await context.clearCookies({ name: 'portfolio_locale' });
      expect((await context.cookies()).some((cookie) => cookie.name === 'portfolio_locale')).toBe(
        false,
      );
      const response = await context.request.get('/', {
        headers: { 'Accept-Language': 'pt-BR' },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe('/pt');
      expect(response.headers()['set-cookie']).toBeUndefined();
    });
  }

  test('does not negotiate or renew on explicit locale paths', async ({ context, baseURL }) => {
    if (!baseURL) throw new Error('Expected the configured test origin');
    for (const item of [
      { pathname: '/pt', saved: 'en', accepted: 'en-US' },
      { pathname: '/en', saved: 'pt', accepted: 'pt-BR' },
    ]) {
      await context.addCookies([{ name: 'portfolio_locale', value: item.saved, url: baseURL }]);
      const response = await context.request.get(item.pathname, {
        headers: { 'Accept-Language': item.accepted },
        maxRedirects: 0,
      });
      // Content/status correctness is covered by E2.2's published-page journeys.
      expect(response.headers().location).toBeUndefined();
      expect(response.headers()['set-cookie']).toBeUndefined();
      expect(response.status()).not.toBe(307);
      expect(response.status()).not.toBe(308);
    }
  });

  test('keeps the crossed About paths as real 404 responses', async ({ context }) => {
    for (const pathname of ['/pt/about', '/en/sobre']) {
      const response = await context.request.get(pathname, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
      expect(response.headers()['set-cookie']).toBeUndefined();
    }
  });

  test('rejects invalid or foreign manual requests without changing a cookie', async ({
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Expected the configured test origin');
    const origin = new URL(baseURL).origin;
    for (const item of [
      { origin, data: { locale: 'pt-BR' }, status: 400 },
      { origin, data: { locale: 'pt', returnTo: 'https://elsewhere.example' }, status: 400 },
      { origin: 'https://elsewhere.example', data: { locale: 'pt' }, status: 403 },
    ]) {
      const response = await context.request.post('/language-preference', {
        headers: { Origin: item.origin },
        data: item.data,
      });
      expect(response.status()).toBe(item.status);
      expect(response.headers()['set-cookie']).toBeUndefined();
      expect(response.headers().location).toBeUndefined();
      expectPrivate(response);
    }
    const visit = await context.request.get('/language-preference', { maxRedirects: 0 });
    expect(visit.status()).toBe(405);
    expect(visit.headers()['set-cookie']).toBeUndefined();
  });
});
