import { afterAll, beforeAll, expect, it } from 'vitest';
import type { CollectionBeforeOperationHook } from 'payload';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../testing/fixtures/editorial-auth';
import { authorizePreview } from '@/helpers/payload/preview-session';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import {
  authorizePrivatePreviewRequest,
  preparePrivatePreviewRequest,
} from './prepare-private-preview-request';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let id: string;
const privateMarker = 'PRIVATE TRANSPORT <script>draft</script>';
const origin = () => process.env.SITE_ORIGIN!;
const options = () => ({ origin: origin() });
const privatePath = () => `/preview-ui/pt/case-content/${id}/case`;
function request(
  path = privatePath(),
  {
    authenticated = true,
    method = 'GET',
    headers = {},
  }: {
    authenticated?: boolean;
    method?: string;
    headers?: HeadersInit;
  } = {},
) {
  const actual = new Headers({ origin: origin(), 'sec-fetch-site': 'same-origin' });
  if (authenticated) actual.set('cookie', cookie);
  new Headers(headers).forEach((value, name) => actual.set(name, value));
  // URL host is deliberately untrusted. The helper receives its logical origin separately.
  return new Request(`https://untrusted-host.invalid${path}`, { method, headers: actual });
}
async function denied(response: Response | null, status: number) {
  expect(response).not.toBeNull();
  expect(response!.status).toBe(status);
  expect(response!.headers.get('cache-control')).toContain('private');
  expect(response!.headers.get('cache-control')).toContain('no-store');
  expect(response!.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response!.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response!.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response!.headers.has('location')).toBe(false);
  expect(response!.headers.has('set-cookie')).toBe(false);
  expect(await response!.text()).toBe('');
}
async function observeCaseReads<T>(operation: () => Promise<T>) {
  const config = fixture.payload.collections['case-content'].config;
  const original = config.hooks.beforeOperation;
  let reads = 0;
  const observer: CollectionBeforeOperationHook = ({ args, operation: nativeOperation }) => {
    if (nativeOperation === 'read') reads++;
    return args;
  };
  config.hooks.beforeOperation = [...(original ?? []), observer];
  try {
    const value = await operation();
    return { value, reads };
  } finally {
    config.hooks.beforeOperation = original;
  }
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-preview-transport');
  installPayloadProvider(async () => fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'PRIVATE SOURCE IDENTITY' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.create({
    collection: 'case-content',
    draft: true,
    data: { case: parent.id, locale: 'pt', title: privateMarker, slug: null, _status: 'draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  id = draft.id;
  const login = await authHTTP(
    'login',
    {
      email: fixture.user.email,
      password: 'Synthetic-editorial-test-password-123!',
    },
    undefined,
    'e2-preview-transport',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  const session = await fixture.payload.auth({
    headers: new Headers({ cookie, origin: origin(), 'sec-fetch-site': 'same-origin' }),
  });
  expect(session.user?.collection).toBe('users');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('has a real Native control for cookie CSRF metadata before testing the new transport', async () => {
  const logical = `${origin()}/preview?collection=case-content&id=${id}&locale=pt&view=1`;
  const browser = await authorizePreview(
    new Request(logical, {
      headers: { cookie, 'sec-fetch-site': 'none' },
    }),
  );
  expect(browser.ok).toBe(true);
  const nonBrowser = await authorizePreview(new Request(logical, { headers: { cookie } }));
  expect(nonBrowser).toMatchObject({
    ok: false,
    error: { code: 'forbidden', message: 'Authentication required.' },
  });
});
it.each(['GET', 'HEAD'])(
  'passes only an authenticated authorized direct %s to the private App Page',
  async (method) => {
    await expect(
      preparePrivatePreviewRequest(request(privatePath(), { method }), options()),
    ).resolves.toBeNull();
  },
);
it('accepts a direct browser navigation without Origin when Native Sec-Fetch-Site is none', async () => {
  const incoming = request();
  incoming.headers.delete('origin');
  incoming.headers.set('sec-fetch-site', 'none');
  await expect(preparePrivatePreviewRequest(incoming, options())).resolves.toBeNull();
});
it('does not accept a non-browser cookie without Origin or Fetch Metadata', async () => {
  const incoming = request();
  incoming.headers.delete('origin');
  incoming.headers.delete('sec-fetch-site');
  await denied(await preparePrivatePreviewRequest(incoming, options()), 401);
});
it('denies anonymous valid, malformed and duplicated scopes before revealing scope errors', async () => {
  for (const path of [privatePath(), '/preview-ui/invalid', `${privatePath()}?id=x&id=y`]) {
    await denied(
      await preparePrivatePreviewRequest(request(path, { authenticated: false }), options()),
      401,
    );
  }
});
it('keeps foreign-Origin cookie rejection and authenticated cross-site rejection separate', async () => {
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), {
        headers: { origin: 'https://outside.invalid' },
      }),
      options(),
    ),
    401,
  );
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), {
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
      options(),
    ),
    403,
  );
});
it('does not use Host or forwarded origin headers to authorize a foreign origin', async () => {
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), {
        headers: {
          origin: 'https://outside.invalid',
          host: '127.0.0.1:3100',
          'x-forwarded-host': '127.0.0.1:3100',
          'x-forwarded-proto': 'http',
        },
      }),
      options(),
    ),
    401,
  );
});
it('validates source collection/page/locale and never returns a Native document to the caller', async () => {
  for (const path of [
    `/preview-ui/pt/users/${fixture.user.id}/home`,
    `/preview-ui/pt/case-content/${id}/home`,
    `/preview-ui/pt/case-content/not-a-uuid/case`,
  ])
    await denied(await preparePrivatePreviewRequest(request(path), options()), 400);
  await denied(
    await preparePrivatePreviewRequest(
      request(`/preview-ui/en/case-content/${id}/case`),
      options(),
    ),
    403,
  );
  await denied(
    await preparePrivatePreviewRequest(
      request('/preview-ui/pt/case-content/00000000-0000-4000-8000-000000000007/case'),
      options(),
    ),
    403,
  );
});
it('rejects duplicate returnTo and query attempts to override a path scope after Native authentication', async () => {
  for (const query of [
    'returnTo=/pt&returnTo=/en',
    'id=00000000-0000-4000-8000-000000000007',
    'collection=users',
    'locale=en',
    'page=home',
    'view=1',
  ])
    await denied(
      await preparePrivatePreviewRequest(request(`${privatePath()}?${query}`), options()),
      400,
    );
});
it('allows a safe return path and framework RSC marker without making either an authority selector', async () => {
  await expect(
    preparePrivatePreviewRequest(
      request(`${privatePath()}?returnTo=%2Fpt%2Fcases&_rsc=synthetic`, {
        headers: { rsc: '1' },
      }),
      options(),
    ),
  ).resolves.toBeNull();
  await denied(
    await preparePrivatePreviewRequest(
      request(`${privatePath()}?returnTo=https%3A%2F%2Foutside.invalid`),
      options(),
    ),
    400,
  );
});
it('denies unsupported methods before Next and does not parse a request body as preview scope', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await preparePrivatePreviewRequest(
      request(privatePath(), { method }),
      options(),
    );
    expect(response?.headers.get('allow')).toBe('GET, HEAD');
    await denied(response, 405);
  }
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), { method: 'POST', authenticated: false }),
      options(),
    ),
    401,
  );
});
it('never returns null for a path outside its owned private surface', async () => {
  await denied(await preparePrivatePreviewRequest(request('/pt'), options()), 404);
});

it('does not read a document for a duplicated authenticated query or trust a forged public context', async () => {
  const result = await observeCaseReads(() =>
    preparePrivatePreviewRequest(request(`${privatePath()}?returnTo=/pt&returnTo=/en`), options()),
  );
  await denied(result.value, 400);
  expect(result.reads).toBe(0);
  const headers = {
    'x-portfolio-render-context': 'FORGED',
    'x-middleware-request-x-portfolio-render-context': 'FORGED',
  };
  await expect(
    preparePrivatePreviewRequest(request(privatePath(), { headers }), options()),
  ).resolves.toBeNull();
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), { authenticated: false, headers }),
      options(),
    ),
    401,
  );
});

it('keeps anonymous HEAD empty and fails closed for an invalid configured logical origin', async () => {
  await denied(
    await preparePrivatePreviewRequest(
      request(privatePath(), { method: 'HEAD', authenticated: false }),
      options(),
    ),
    401,
  );
  await denied(
    await preparePrivatePreviewRequest(request(), {
      origin: 'https://user:secret@outside.invalid/nested?query=1',
    }),
    503,
  );
});
it('returns Native context only through the server-only Page reauthorization API', async () => {
  const result = await authorizePrivatePreviewRequest(request(), options());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected independently authorized private Page context.');
  expect(result.value.scope).toEqual({
    locale: 'pt',
    collection: 'case-content',
    id,
    page: 'case',
  });
  expect(result.value.context.req.user?.collection).toBe('users');
  expect(result.value.context.payload).toBe(fixture.payload);
  expect(result.value.context.document).toMatchObject({ id, title: privateMarker });
  expect(Object.keys(result.value).sort()).toEqual(['context', 'scope']);
});
it('rejects the same Native session after revocation before the private Page runs', async () => {
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  await denied(await preparePrivatePreviewRequest(request(), options()), 401);
  const page = await authorizePrivatePreviewRequest(request(), options());
  expect(page.ok).toBe(false);
  if (!page.ok) await denied(page.response, 401);
});
