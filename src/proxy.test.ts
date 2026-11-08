import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { readServerEnv } from './config/server-env';
import { publicRootDirectory } from './helpers/payload/public-root-directory';
import { withPublicRootWriter } from './helpers/payload/public-root';
import { installPayloadProvider } from './helpers/payload/runtime';
import {
  readPublicRenderContext,
  PUBLIC_RENDER_CONTEXT_HEADER,
} from './config/public-render-context';
import { proxy, config } from './proxy';
let directory: string;
let env: ReturnType<typeof readServerEnv>;
let server: Server | undefined;
let nativeCalls: number;
const secret = 'Synthetic-proxy-composition-secret-at-least-32-characters';
const mediaId = '11111111-1111-4111-8111-111111111111';
const query = `url=${encodeURIComponent(`/media/${mediaId}/original`)}&w=64&q=75`;
function configure(overrides: Record<string, string> = {}) {
  const input = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: secret,
    DATABASE_URI: `postgres://synthetic:local@127.0.0.1:55433/adfl_test_proxy_${randomUUID().replaceAll('-', '')}`,
    SITE_ORIGIN: 'http://127.0.0.1:3100',
    MEDIA_BUCKET: 'adfl-test-proxy',
    ...overrides,
  };
  for (const [key, value] of Object.entries(input)) vi.stubEnv(key, value);
  env = readServerEnv(process.env);
  directory = publicRootDirectory(env);
}
function request(pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://untrusted.invalid${pathname}`, init);
}
async function publicImage() {
  const object = { key: 'a'.repeat(64), sha256: 'a'.repeat(64), byteLength: 100 };
  await withPublicRootWriter(directory, async (_, commit) =>
    commit({
      generation: randomUUID(),
      subjects: {
        'case-content/synthetic': {
          operationId: 'operation',
          targetRevision: 'revision',
          value: {
            media: [
              {
                id: mediaId,
                manifest: {
                  revision: randomUUID(),
                  kind: 'image',
                  original: {
                    variant: 'original',
                    object,
                    type: 'image/png',
                    width: 80,
                    height: 60,
                  },
                  variants: [],
                },
              },
            ],
          },
        },
      },
    }),
  );
}
beforeEach(() => {
  configure();
  nativeCalls = 0;
  installPayloadProvider(async () => {
    nativeCalls++;
    throw new Error('Synthetic unavailable Native provider');
  });
});
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.resolve('.work/publication') + path.sep))
    throw new Error('Unsafe cleanup');
  await rm(resolved, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it('passes a signed404 through Next.next while replacing forged incoming context', async () => {
  const response = await proxy(
    request('/pt/about', {
      headers: {
        'x-portfolio-render-context': 'FORGED',
        'x-middleware-request-x-portfolio-render-context': 'FORGED',
        rsc: '1',
      },
    }),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  const token = response.headers.get(`x-middleware-request-${PUBLIC_RENDER_CONTEXT_HEADER}`)!;
  expect(token).not.toContain('FORGED');
  expect(
    (
      await readPublicRenderContext(new Headers({ [PUBLIC_RENDER_CONTEXT_HEADER]: token }), {
        publicationDirectory: directory,
        secret,
      })
    ).context,
  ).toMatchObject({ status: 404, locale: 'pt', pin: null });
  expect(response.headers.get(PUBLIC_RENDER_CONTEXT_HEADER)).toBeNull();
  expect(nativeCalls).toBe(0);
});
// Exercise Next's real matcher consumer rather than inspecting config source text.
it.each(['/pt', '/en', '/pt/unknown', '/en/unknown', '/pt/unknown/deep', '/en/unknown/deep'])(
  'runs Proxy for the entire supported locale surface: %s',
  (pathname) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${pathname}` })).toBe(true);
  },
);
it.each(['/admin', '/api/cases', '/fr/unknown', '/unknown', '/preview', '/media/a/original'])(
  'keeps unrelated surfaces outside the public Proxy matcher: %s',
  (pathname) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${pathname}` })).toBe(
      false,
    );
  },
);
it.each([
  ['GET', '/pt/unknown', 'pt'],
  ['HEAD', '/pt/unknown/deep', 'pt'],
  ['GET', '/en/unknown', 'en'],
  ['HEAD', '/en/unknown/deep', 'en'],
] as const)(
  'passes unknown %s %s to the Page as a locale-bound no-store404',
  async (method, pathname, locale) => {
    const response = await proxy(
      request(pathname, {
        method,
        headers: {
          cookie: `portfolio_locale=${locale === 'pt' ? 'en' : 'pt'}`,
          'if-none-match': '*',
          'if-modified-since': 'Thu, 01 Jan 2099 00:00:00 GMT',
          rsc: '1',
        },
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    const token = response.headers.get(`x-middleware-request-${PUBLIC_RENDER_CONTEXT_HEADER}`)!;
    const loaded = await readPublicRenderContext(
      new Headers({ [PUBLIC_RENDER_CONTEXT_HEADER]: token }),
      {
        publicationDirectory: directory,
        secret,
      },
      { pathname, method },
    );
    expect(loaded.context).toMatchObject({ locale, status: 404, pin: null });
    expect(await response.text()).toBe('');
    expect(nativeCalls).toBe(0);
  },
);
it('passes safe503 to the Page when no healthy Native origin can classify missing coverage', async () => {
  const response = await proxy(request('/pt', { method: 'HEAD' }));
  expect(response.status).toBe(503);
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('retry-after')).toBe('60');
  expect(response.headers.get('x-robots-tag')).toContain('noindex');
  expect(await response.text()).toBe('');
  expect(nativeCalls).toBe(1);
});
it('leaves an excluded API path outside the public render transport', async () => {
  const response = await proxy(request('/api/cases'));
  expect(response.status).toBe(200);
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.has(`x-middleware-request-${PUBLIC_RENDER_CONTEXT_HEADER}`)).toBe(false);
  expect(nativeCalls).toBe(0);
});
it('denies unsupported HTML methods without emitting a render token', async () => {
  const response = await proxy(request('/pt', { method: 'POST' }));
  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('GET, HEAD');
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(nativeCalls).toBe(0);
});
it('fails closed without a token if server configuration cannot authenticate context', async () => {
  vi.stubEnv('PAYLOAD_SECRET', 'bad');
  const response = await proxy(request('/pt'));
  expect(response.status).toBe(503);
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(response.headers.get('retry-after')).toBe('60');
  expect(await response.text()).toBe('');
});
it('returns the image helper refusal directly instead of entering the optimizer', async () => {
  const response = await proxy(request('/_next/image?url=https://untrusted.invalid/a&w=64&q=75'));
  expect(response.status).toBe(400);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(nativeCalls).toBe(0);
});
it('passes only a valid signed and root-authorized inner image request to Next', async () => {
  await publicImage();
  const expires = Math.floor(Date.now() / 1000) + 30;
  const key = createHmac('sha256', secret).update('portfolio-next-image-key-v1').digest('hex');
  const signature = createHmac('sha256', key)
    .update(`portfolio-next-image-v1\n${expires}\nGET\n${query}\nimage/webp`)
    .digest('hex');
  const response = await proxy(
    request(`/_next/image?${query}`, {
      headers: {
        accept: 'image/webp',
        'x-portfolio-image-authorization': `${expires}.${signature}`,
      },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(nativeCalls).toBe(0);
});
it('does not strip image authentication and turn a forged inner request into an outer fetch', async () => {
  await publicImage();
  const response = await proxy(
    request(`/_next/image?${query}`, { headers: { 'x-portfolio-image-authorization': 'FORGED' } }),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(nativeCalls).toBe(0);
});
it('preserves the final external no-store wrapper from the image helper using a synthetic HTTP origin', async () => {
  server = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public,max-age=3600' });
    res.end('synthetic optimized HTTP bytes; not a Next optimizer proof');
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  vi.stubEnv('INTERNAL_HTTP_ORIGIN', `http://127.0.0.1:${address.port}`);
  await publicImage();
  const response = await proxy(
    request(`/_next/image?${query}`, {
      headers: {
        host: 'untrusted.invalid',
        'x-forwarded-host': '169.254.169.254',
        accept: 'image/webp',
      },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(await response.text()).toContain('synthetic optimized HTTP');
  expect(nativeCalls).toBe(0);
});
it('requires an explicit trusted internal origin in production regardless of Host/forwarded headers', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('SITE_ORIGIN', 'https://public.example.invalid');
  const response = await proxy(
    request(`/_next/image?${query}`, {
      headers: {
        host: '127.0.0.1:3100',
        'x-forwarded-host': '127.0.0.1:3100',
        'x-forwarded-proto': 'http',
      },
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(nativeCalls).toBe(0);
});
it.each([404, 410, 503] as const)(
  'returns a direct safe case%s without a render token and strips the HEAD body',
  async (status) => {
    let slug = status === 404 ? 'INVALID' : 'unknown';
    if (status === 410) {
      slug = 'withdrawn';
      const contentId = randomUUID();
      await withPublicRootWriter(directory, async (_, commit) =>
        commit({
          generation: randomUUID(),
          subjects: {
            [`case-content/${contentId}`]: {
              operationId: 'operation',
              targetRevision: 'revision',
              value: {
                kind: 'case',
                caseId: randomUUID(),
                contentId,
                locale: 'pt',
                slug: null,
                slugs: [slug],
                detail: null,
              },
            },
          },
        }),
      );
    }
    const get = await proxy(request(`/pt/cases/${slug}`));
    expect(get.status).toBe(status);
    expect(get.headers.get('x-middleware-next')).toBeNull();
    expect(get.headers.get('x-middleware-override-headers')).toBeNull();
    expect(get.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const text = await get.text();
    expect(text).not.toContain(slug);
    expect(text).toContain('<html lang="pt">');
    const head = await proxy(
      request(`/pt/cases/${slug}`, {
        method: 'HEAD',
        headers: { 'if-none-match': '*', 'if-modified-since': new Date().toUTCString() },
      }),
    );
    expect(head.status).toBe(status);
    expect([...head.headers]).toEqual([...get.headers]);
    expect(await head.text()).toBe('');
  },
);
it('keeps negative case HTML and classification headers independent of the visited slug', async () => {
  const a = await proxy(request('/en/cases/PRIVATE'));
  const b = await proxy(request('/en/cases/UNKNOWN'));
  expect(a.status).toBe(404);
  expect(b.status).toBe(404);
  expect(await a.text()).toBe(await b.text());
  expect([...a.headers]).toEqual([...b.headers]);
  expect(nativeCalls).toBe(0);
});
it.each(['/preview-ui', '/preview-ui/invalid', `/preview-ui/pt/case-content/${mediaId}/case`])(
  'runs the private pre-stream authorization boundary for %s',
  (pathname) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${pathname}` })).toBe(true);
  },
);
it('does not claim neighboring paths as a private preview surface', () => {
  expect(unstable_doesMiddlewareMatch({ config, url: 'http://localhost/preview-ui-extra' })).toBe(
    false,
  );
});
it('fails closed before Next when private authentication is unavailable and ignores forged public authority', async () => {
  const response = await proxy(
    request(`/preview-ui/pt/case-content/${mediaId}/case`, {
      headers: {
        [PUBLIC_RENDER_CONTEXT_HEADER]: 'FORGED',
        'x-middleware-request-x-portfolio-render-context': 'FORGED',
        rsc: '1',
      },
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(response.headers.has('x-middleware-override-headers')).toBe(false);
  expect(response.headers.get('cache-control')).toContain('private');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await response.text()).toBe('');
  expect(nativeCalls).toBe(1);
});
