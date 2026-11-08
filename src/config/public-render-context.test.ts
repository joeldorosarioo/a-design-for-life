import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { mapCaseDetail } from '@/features/cases/server';
import { mapProfile } from '@/features/professional-profile/server';
import { withPublicRootWriter, type PublicRoot } from '@/helpers/payload/public-root';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import {
  preparePublicRenderRequest,
  readPublicRenderContext,
  PUBLIC_RENDER_CONTEXT_HEADER,
  type PublicRenderDecision,
} from './public-render-context';
let directory: string;
let nativeCalls: number;
const secret = 'Synthetic-public-render-secret-at-least-32-characters';
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
function snapshot(title = 'Confirmed case'): PublicRoot {
  const caseId = randomUUID();
  const contentId = randomUUID();
  return {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: entry({ kind: 'case-order', caseId, sortOrder: 0, featured: true }),
      [`case-content/${contentId}`]: entry({
        kind: 'case',
        caseId,
        contentId,
        locale: 'pt',
        slug: 'publico',
        slugs: ['antigo', 'publico'],
        detail: mapCaseDetail({
          id: contentId,
          case: caseId,
          locale: 'pt',
          slug: 'publico',
          title,
          summary: 'Confirmed summary',
          _status: 'published',
          createdAt: '',
          updatedAt: '',
        }),
      }),
      [`professional-profiles/${randomUUID()}`]: entry({
        kind: 'profile',
        locale: 'pt',
        profile: mapProfile({
          id: randomUUID(),
          locale: 'pt',
          _status: 'published',
          identity: { name: 'Confirmed profile' },
          contacts: {
            email: 'confirmed@example.invalid',
            linkedin: 'https://www.linkedin.com/in/synthetic',
          },
          resume: randomUUID(),
          createdAt: '',
          updatedAt: '',
        }),
      }),
      [`site-navigation/${randomUUID()}`]: entry({
        kind: 'navigation',
        locale: 'pt',
        navigation: {
          locale: 'pt',
          header: {
            brandLabel: 'Confirmed brand',
            projectsLabel: 'Projects',
            aboutLabel: 'About',
            resumeLabel: 'Resume',
            contactLabel: 'Contact',
          },
          footer: { emailLabel: 'Email', linkedinLabel: 'LinkedIn', resumeLabel: 'Resume' },
          controls: {
            newTabLabel: 'New tab',
            openMenuLabel: 'Open menu',
            closeMenuLabel: 'Close menu',
            languageLabel: 'Language',
          },
        },
      }),
    },
  };
}
const options = () => ({ publicationDirectory: directory, secret });
const request = (pathname: string, init?: RequestInit) =>
  new Request(`https://untrusted.example.invalid${pathname}`, init);
function headers(decision: PublicRenderDecision | null) {
  if (!decision || !('requestHeaders' in decision)) throw new Error('Missing render decision');
  return decision.requestHeaders;
}
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-render-context-'));
  nativeCalls = 0;
  installPayloadProvider(async () => {
    nativeCalls++;
    throw new Error('Synthetic unavailable Native origin; no healthy classification claim');
  });
});
afterEach(async () => {
  if (!directory.startsWith(path.join(tmpdir(), 'portfolio-render-context-')))
    throw new Error('Unsafe cleanup');
  await rm(directory, { recursive: true, force: true });
});
it('keeps the selected generation across publication and signs only a small context without a CMS body', async () => {
  const a = snapshot('Confirmed A');
  await withPublicRootWriter(directory, async (_, commit) => commit(a));
  await expect(
    (async () => {
      const prepared = await preparePublicRenderRequest(
        request('/pt/cases/publico?generation=forged'),
        options(),
      );
      expect(prepared?.status).toBe(200);
      const h = headers(prepared);
      const token = h.get(PUBLIC_RENDER_CONTEXT_HEADER)!;
      expect(token.length).toBeLessThan(1024);
      expect(token).not.toContain('Confirmed A');
      const b = snapshot('Confirmed B');
      await withPublicRootWriter(directory, async (_, commit) => commit(b));
      const loaded = await readPublicRenderContext(h, options(), {
        pathname: '/pt/cases/publico',
        method: 'GET',
      });
      expect(loaded.root).toEqual(a);
      expect(loaded.context).toMatchObject({
        status: 200,
        locale: 'pt',
        pin: { generation: a.generation },
      });
      const next = await preparePublicRenderRequest(request('/pt'), options());
      expect((await readPublicRenderContext(headers(next), options())).root).toEqual(b);
      expect(nativeCalls).toBe(0);
      return loaded.root?.generation;
    })(),
  ).resolves.toBe(a.generation);
});
it.each(['/pt', '/pt/cases', '/pt/sobre', '/pt/cases/pub%6cico'])(
  'serves a known root without initializing Native: %s',
  async (pathname) => {
    await withPublicRootWriter(directory, async (_, commit) => commit(snapshot()));
    const prepared = await preparePublicRenderRequest(
      request(pathname, { headers: { cookie: 'portfolio_locale=en' } }),
      options(),
    );
    expect(prepared?.status).toBe(200);
    expect((await readPublicRenderContext(headers(prepared), options())).context.locale).toBe('pt');
    expect(nativeCalls).toBe(0);
  },
);
it('strips all own incoming context and override variants while preserving router and image protocol headers', async () => {
  await withPublicRootWriter(directory, async (_, commit) => commit(snapshot()));
  const prepared = await preparePublicRenderRequest(
    request('/pt', {
      headers: {
        'x-portfolio-render-context': 'FORGED',
        'x-portfolio-render-generation': 'FORGED',
        'x-middleware-request-x-portfolio-render-context': 'FORGED',
        'x-middleware-override-headers': 'x-portfolio-render-context',
        rsc: '1',
        'next-router-state-tree': 'synthetic-tree',
        'x-portfolio-image-authorization': 'separate-protocol',
      },
    }),
    options(),
  );
  const h = headers(prepared);
  expect(h.get(PUBLIC_RENDER_CONTEXT_HEADER)).not.toContain('FORGED');
  expect(h.has('x-portfolio-render-generation')).toBe(false);
  expect(h.has('x-middleware-request-x-portfolio-render-context')).toBe(false);
  expect(h.has('x-middleware-override-headers')).toBe(false);
  expect(h.get('rsc')).toBe('1');
  expect(h.get('next-router-state-tree')).toBe('synthetic-tree');
  expect(h.get('x-portfolio-image-authorization')).toBe('separate-protocol');
});
it('rejects forged, malformed, oversized or cross-route/method context without a root fallback', async () => {
  await withPublicRootWriter(directory, async (_, commit) => commit(snapshot()));
  const prepared = await preparePublicRenderRequest(request('/pt', { method: 'HEAD' }), options());
  const h = headers(prepared);
  await expect(
    readPublicRenderContext(h, options(), { pathname: '/en', method: 'HEAD' }),
  ).rejects.toThrow();
  await expect(
    readPublicRenderContext(h, options(), { pathname: '/pt', method: 'GET' }),
  ).rejects.toThrow();
  for (const token of [
    'FORGED',
    'a'.repeat(4097),
    h.get(PUBLIC_RENDER_CONTEXT_HEADER)!.slice(0, -1) + 'z',
  ])
    await expect(
      readPublicRenderContext(new Headers({ [PUBLIC_RENDER_CONTEXT_HEADER]: token }), options()),
    ).rejects.toThrow();
  await expect(readPublicRenderContext(new Headers(), options())).rejects.toThrow();
  await expect(
    readPublicRenderContext(h, { ...options(), secret: secret + 'different' }),
  ).rejects.toThrow();
});
it('rejects a signed but expanded context schema', async () => {
  const encoded = Buffer.from(
    JSON.stringify({
      v: 1,
      method: 'GET',
      pathname: '/pt',
      locale: 'pt',
      status: 503,
      pin: null,
      privateExtra: 'not allowed',
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`portfolio-public-render-context-v1\n${encoded}`)
    .digest('hex');
  await expect(
    readPublicRenderContext(
      new Headers({ [PUBLIC_RENDER_CONTEXT_HEADER]: `${encoded}.${signature}` }),
      options(),
    ),
  ).rejects.toThrow();
});
it('rejects an unavailable pin instead of reading a newly published current root', async () => {
  const a = snapshot();
  await withPublicRootWriter(directory, async (_, commit) => commit(a));
  const prepared = await preparePublicRenderRequest(request('/pt'), options());
  await rm(path.join(directory, 'render-snapshots'), { recursive: true });
  await withPublicRootWriter(directory, async (_, commit) => commit(snapshot('B')));
  await expect(readPublicRenderContext(headers(prepared), options())).rejects.toMatchObject({
    code: 'ENOENT',
  });
});
it('fails closed to503 before rendering when snapshot storage is unavailable', async () => {
  await withPublicRootWriter(directory, async (_, commit) => commit(snapshot()));
  await writeFile(path.join(directory, 'render-snapshots'), 'blocked');
  const prepared = await preparePublicRenderRequest(request('/pt'), options());
  expect(prepared?.status).toBe(503);
  expect((await readPublicRenderContext(headers(prepared), options())).root).toBeNull();
});
it.each(['/pt/about', '/en/sobre', '/pt/cases/a/b', '/pt/cases/a%2Fb', '/pt/cases/UPPER'])(
  'keeps invalid explicit routes404 without reading a corrupt root: %s',
  async (pathname) => {
    await writeFile(path.join(directory, 'current.json'), '{broken');
    const prepared = await preparePublicRenderRequest(request(pathname), options());
    expect(prepared?.status).toBe(404);
    if (prepared && 'caseStateLocale' in prepared) {
      expect(prepared.caseStateLocale).toBe('pt');
    } else {
      const loaded = await readPublicRenderContext(headers(prepared), options());
      expect(loaded.context.pin).toBeNull();
    }
    expect(nativeCalls).toBe(0);
  },
);
it.each([
  ['GET', '/pt/unknown', 'pt', '/pt/unknown'],
  ['HEAD', '/pt/unknown/deep', 'pt', '/pt/unknown/deep'],
  ['GET', '/en/unknown', 'en', '/en/unknown'],
  ['HEAD', '/en/unknown/deep', 'en', '/en/unknown/deep'],
  ['GET', '/pt/unk%6eown/deep', 'pt', '/pt/unknown/deep'],
  ['GET', '/en/unknown%00', 'en', '/en/unknown%00'],
] as const)(
  'signs localized unknown %s %s as404 before reading FS or Native',
  async (method, pathname, locale, expectedPath) => {
    await writeFile(path.join(directory, 'current.json'), '{broken');
    const prepared = await preparePublicRenderRequest(
      request(pathname, {
        method,
        headers: {
          cookie: `portfolio_locale=${locale === 'pt' ? 'en' : 'pt'}`,
          rsc: '1',
          'if-none-match': '*',
        },
      }),
      options(),
    );
    expect(prepared?.status).toBe(404);
    const loaded = await readPublicRenderContext(headers(prepared), options(), {
      pathname: expectedPath,
      method,
    });
    expect(loaded.context).toMatchObject({
      locale,
      pathname: expectedPath,
      status: 404,
      pin: null,
    });
    expect(loaded.root).toBeNull();
    expect(headers(prepared).get('rsc')).toBe('1');
    expect(await readdir(directory)).toEqual(['current.json']);
    expect(nativeCalls).toBe(0);
  },
);
it.each([
  '/',
  '/admin',
  '/api/cases',
  '/preview',
  '/preview-media/a/original',
  '/media/a/original',
  '/language-preference',
  '/_next/static/a',
  '/_next/image',
  '/fr/cases/a',
  '/pt-BR',
])('ignores surfaces outside its finite public HTML scope: %s', async (pathname) => {
  await expect(preparePublicRenderRequest(request(pathname), options())).resolves.toBeNull();
  expect(nativeCalls).toBe(0);
});
it('returns308 directly from confirmed history without preparing a render pin', async () => {
  await withPublicRootWriter(directory, async (_, commit) => commit(snapshot()));
  await expect(preparePublicRenderRequest(request('/pt/cases/antigo'), options())).resolves.toEqual(
    { status: 308, location: '/pt/cases/publico' },
  );
  expect(nativeCalls).toBe(0);
});
it('keeps410 for a confirmed tombstone independently of missing shell coverage', async () => {
  const a = snapshot();
  for (const subject of Object.values(a.subjects)) {
    const value = subject.value;
    if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'case') {
      value.detail = null;
      value.slug = null;
    }
  }
  await withPublicRootWriter(directory, async (_, commit) => commit(a));
  await writeFile(path.join(directory, 'render-snapshots'), 'blocked pin storage');
  const prepared = await preparePublicRenderRequest(request('/pt/cases/publico'), options());
  expect(prepared).toEqual({ status: 410, caseStateLocale: 'pt' });
  expect(await readdir(directory)).toEqual(['current.json', 'render-snapshots']);
  expect(nativeCalls).toBe(0);
});
it('keeps503 when missing coverage has no healthy Native proof or current is corrupt', async () => {
  for (const content of [undefined, '{broken']) {
    if (content) await writeFile(path.join(directory, 'current.json'), content);
    const prepared = await preparePublicRenderRequest(request('/pt'), options());
    expect(prepared?.status).toBe(503);
    expect((await readPublicRenderContext(headers(prepared), options())).context.pin).toBeNull();
  }
});
it('denies unsupported methods on a recognized public route', async () => {
  await expect(
    preparePublicRenderRequest(request('/pt', { method: 'POST' }), options()),
  ).resolves.toEqual({ status: 405 });
});

it('returns503 before rendering when a legacy required shell label cannot resolve', async () => {
  const a = snapshot();
  for (const subject of Object.values(a.subjects)) {
    const value = subject.value;
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.kind === 'navigation'
    ) {
      const navigation = value.navigation as { header: { resumeLabel: string | null } };
      navigation.header.resumeLabel = null;
    }
  }
  await withPublicRootWriter(directory, async (_, commit) => commit(a));
  const prepared = await preparePublicRenderRequest(request('/pt'), options());
  expect(prepared?.status).toBe(503);
  expect(nativeCalls).toBe(0);
});
it('preserves an independently published detail200 when structural profile/navigation are absent', async () => {
  const a = snapshot();
  a.subjects = Object.fromEntries(
    Object.entries(a.subjects).filter(
      ([key]) => !key.startsWith('professional-profiles/') && !key.startsWith('site-navigation/'),
    ),
  );
  await withPublicRootWriter(directory, async (_, commit) => commit(a));
  const prepared = await preparePublicRenderRequest(request('/pt/cases/publico'), options());
  expect(prepared?.status).toBe(200);
  expect((await readPublicRenderContext(headers(prepared), options())).root).toEqual(a);
  expect(nativeCalls).toBe(0);
});
