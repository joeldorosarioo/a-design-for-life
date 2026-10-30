import { afterAll, beforeAll, expect, it } from 'vitest';
import type { CollectionBeforeOperationHook } from 'payload';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../../testing/fixtures/editorial-auth';
import { installPayloadProvider } from './runtime';
import { GET } from '../../app/(portfolio)/preview/route';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let caseId: string;
let profileId: string;
let navigationId: string;
const marker = 'PRIVATE <script>preview</script>';
const origin = () => process.env.SITE_ORIGIN!;
function request(query: string, authenticated = true, extra: HeadersInit = {}) {
  const headers = new Headers({ origin: origin(), 'sec-fetch-site': 'same-origin' });
  if (authenticated) headers.set('cookie', cookie);
  new Headers(extra).forEach((value, name) => headers.set(name, value));
  return new Request(`${origin()}/preview?${query}`, { headers });
}
function scope(collection = 'case-content', id = caseId, locale = 'pt') {
  return new URLSearchParams({ collection, id, locale }).toString();
}
async function safeFailure(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('x-robots-tag')).toContain('noindex');
  expect(response.headers.has('location')).toBe(false);
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(await response.text()).not.toContain(marker);
}
async function observeNativeDocumentReads<T>(operation: () => Promise<T>) {
  let reads = 0;
  const observer: CollectionBeforeOperationHook = ({ args, operation: nativeOperation }) => {
    if (nativeOperation === 'read') reads++;
    return args;
  };
  const configs = (['case-content', 'professional-profiles', 'site-navigation'] as const).map(
    (collection) => fixture.payload.collections[collection].config,
  );
  const originals = configs.map((config) => config.hooks.beforeOperation);
  for (const config of configs)
    config.hooks.beforeOperation = [...(config.hooks.beforeOperation ?? []), observer];
  try {
    const value = await operation();
    return { value, reads };
  } finally {
    configs.forEach((config, index) => {
      config.hooks.beforeOperation = originals[index];
    });
  }
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-preview-visual-upgrade');
  installPayloadProvider(async () => fixture.payload);
  await clearStructuralFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'PRIVATE legacy source' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const caseDraft = await fixture.payload.create({
    collection: 'case-content',
    draft: true,
    data: {
      case: parent.id,
      locale: 'pt',
      title: marker,
      summary: 'Private saved summary',
      _status: 'draft',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  caseId = caseDraft.id;
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    draft: true,
    data: { locale: 'pt', identity: { name: 'PRIVATE PROFILE' }, _status: 'draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  profileId = profile.id;
  const navigation = await fixture.payload.create({
    collection: 'site-navigation',
    draft: true,
    data: { locale: 'pt', header: { brandLabel: 'PRIVATE NAVIGATION' }, _status: 'draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  navigationId = navigation.id;
  const login = await authHTTP(
    'login',
    {
      email: fixture.user.email,
      password: 'Synthetic-editorial-test-password-123!',
    },
    undefined,
    'e2-preview-visual-upgrade',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  const auth = await fixture.payload.auth({
    headers: new Headers({ cookie, origin: origin(), 'sec-fetch-site': 'same-origin' }),
  });
  expect(auth.user?.collection).toBe('users');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('preserves the explicit no-page legacy307 and escaped view1 HTML/return link', async () => {
  const entry = await GET(
    request(`${scope()}&returnTo=${encodeURIComponent('/pt/cases/example')}`),
  );
  expect(entry.status).toBe(307);
  const target = new URL(entry.headers.get('location')!);
  expect(target.origin).toBe(new URL(origin()).origin);
  expect(target.pathname).toBe('/preview');
  expect(target.searchParams.get('view')).toBe('1');
  expect(target.searchParams.has('page')).toBe(false);
  const view = await GET(request(target.searchParams.toString()));
  expect(view.status).toBe(200);
  const html = await view.text();
  expect(html).toContain('PRIVATE &lt;script&gt;preview&lt;/script&gt;');
  expect(html).not.toContain('<script>preview</script>');
  expect(html).toContain('Private saved summary');
  expect(html).toContain('href="/pt/cases/example"');
  expect(view.headers.get('cache-control')).toContain('no-store');
  expect(view.headers.get('x-robots-tag')).toContain('noindex');
});
it('preserves anonymous401, mismatched locale403 and unsafe return400 without a redirect', async () => {
  await safeFailure(await GET(request(scope(), false)), 401);
  await safeFailure(await GET(request(scope('case-content', caseId, 'en'))), 403);
  await safeFailure(await GET(request(`${scope()}&returnTo=https%3A%2F%2Foutside.invalid`)), 400);
  await safeFailure(await GET(request(scope(), true, { 'sec-fetch-site': 'cross-site' })), 403);
});
it.each(['home', 'about', 'cases'])(
  'redirects an authorized profile visual %s to a closed private scope',
  async (page) => {
    const response = await GET(
      request(`${scope('professional-profiles', profileId)}&page=${page}&returnTo=%2Fpt`),
    );
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe(new URL(origin()).origin);
    expect(target.pathname).toBe(`/preview-ui/pt/professional-profiles/${profileId}/${page}`);
    expect(target.searchParams.get('returnTo')).toBe('/pt');
    expect([...target.searchParams.keys()]).toEqual(['returnTo']);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await response.text()).toBe('');
  },
);
it('supports a navigation draft visual scope and a case visual scope without requiring public slugs', async () => {
  for (const [collection, id, page] of [
    ['site-navigation', navigationId, 'home'],
    ['case-content', caseId, 'case'],
  ]) {
    const response = await GET(request(`${scope(collection, id)}&page=${page}`));
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe(`/preview-ui/pt/${collection}/${id}/${page}`);
    expect(target.search).toBe('');
    expect(await response.text()).toBe('');
  }
});
it('rejects an unsupported collection/page combination and preserves auth-first behavior', async () => {
  for (const query of [
    `${scope()}&page=home`,
    `${scope('professional-profiles', profileId)}&page=case`,
    `${scope('professional-profiles', profileId)}&page=external`,
    `${scope('professional-profiles', profileId)}&page=`,
  ]) {
    await safeFailure(await GET(request(query)), 400);
    await safeFailure(await GET(request(query, false)), 401);
  }
});
it('rejects duplicate controlled parameters before any ambiguous document lookup, after Native auth', async () => {
  const queries = [
    `${scope()}&collection=case-content`,
    `${scope()}&id=${caseId}`,
    `${scope()}&locale=pt`,
    `${scope()}&view=1&view=1`,
    `${scope()}&returnTo=/pt&returnTo=/pt`,
    `${scope('professional-profiles', profileId)}&page=home&page=home`,
  ];
  for (const query of queries) {
    const result = await observeNativeDocumentReads(() => GET(request(query)));
    await safeFailure(result.value, 400);
    expect(result.reads).toBe(0);
    const anonymous = await observeNativeDocumentReads(() => GET(request(query, false)));
    await safeFailure(anonymous.value, 401);
    expect(anonymous.reads).toBe(0);
  }
});
it('does not follow visitor Host/Forwarded values or external return data when selecting visual destinations', async () => {
  const response = await GET(
    request(`${scope('professional-profiles', profileId)}&page=about`, true, {
      host: 'outside.invalid',
      'x-forwarded-host': 'outside.invalid',
      'x-forwarded-proto': 'https',
    }),
  );
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get('location')!).origin).toBe(new URL(origin()).origin);
  await safeFailure(
    await GET(
      request(
        `${scope('professional-profiles', profileId)}&page=about&returnTo=%2F%2Foutside.invalid`,
      ),
    ),
    400,
  );
});
