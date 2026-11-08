import { expect, test } from '@playwright/test';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';

const fixturePassword = 'Synthetic-editorial-test-password-123!';

test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off',
  extraHTTPHeaders: { origin: process.env.SITE_ORIGIN! },
});

test('anonymous preview is rejected without exposing a draft or redirecting', async ({
  request,
}) => {
  const response = await request.get(
    '/preview?collection=case-content&id=00000000-0000-4000-8000-000000000007&locale=pt&returnTo=/pt/cases/private-fixture',
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['location']).toBeUndefined();
  expect(response.headers()['x-robots-tag']).toContain('noindex');
});

test('malformed reset requests consume the outer transport abuse budget', async ({ request }) => {
  let status = 0;
  for (let index = 0; index < 61; index++) {
    const response = await request.post('/api/users/reset-password', { data: {} });
    status = response.status();
  }
  expect(status).toBe(429);
  const caseVariant = await request.post('/api/users/RESET-PASSWORD', { data: {} });
  expect(caseVariant.status()).toBe(429);
  expect(Number(caseVariant.headers()['retry-after']) > 0).toBe(true);
});
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let documentID: string;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.7-preview-http');
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic preview' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const document = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: parent.id,
      locale: 'pt',
      slug: `private-${crypto.randomUUID()}`,
      title: 'PRIVATE <script>preview</script>',
      summary: 'Private preview summary',
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  documentID = document.id;
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});

test('native session follows a safe private redirect and can see only the requested draft locale', async ({
  request,
  playwright,
}) => {
  const login = await request.post('/api/users/login', {
    data: { email: fixture.user.email, password: fixturePassword },
  });
  expect(login.status()).toBe(200);
  expect(Object.hasOwn(await login.json(), 'token')).toBe(false);
  const cookie = login.headers()['set-cookie'] ?? '';
  expect(cookie.includes('HttpOnly')).toBe(true);
  expect(cookie.includes('SameSite=Lax')).toBe(true);
  const entry = await request.get(
    `/preview?collection=case-content&id=${documentID}&locale=pt&returnTo=${encodeURIComponent('/pt/cases/example')}`,
    { maxRedirects: 0 },
  );
  expect(entry.status()).toBe(307);
  expect(entry.headers()['cache-control']).toContain('no-store');
  const location = entry.headers()['location'];
  expect(new URL(location, process.env.SITE_ORIGIN).pathname).toBe('/preview');
  const view = await request.get(location);
  expect(view.status()).toBe(200);
  expect(view.headers()['cache-control']).toContain('no-store');
  const html = await view.text();
  expect(html.includes('PRIVATE &lt;script&gt;preview&lt;/script&gt;')).toBe(true);
  expect(html.includes('<script>preview</script>')).toBe(false);
  expect(html.includes('Private preview summary')).toBe(true);
  expect(html.includes('href="/pt/cases/example"')).toBe(true);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.SITE_ORIGIN });
  try {
    expect((await anonymous.get(location)).status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
  for (const returnTo of [
    'https://external.example/path',
    '//external.example',
    '/%2f%2fexternal.example',
    '/\\external.example',
    '/pt\n/header',
  ]) {
    const external = await request.get(
      `/preview?collection=case-content&id=${documentID}&locale=pt&returnTo=${encodeURIComponent(returnTo)}`,
      { maxRedirects: 0 },
    );
    expect(external.status()).toBe(400);
    expect(external.headers()['location']).toBeUndefined();
  }
  expect(
    (await request.get(`/preview?collection=users&id=${fixture.user.id}&locale=pt`)).status(),
  ).toBe(400);
  expect(
    (await request.get(`/preview?collection=case-content&id=${documentID}&locale=en`)).status(),
  ).toBe(403);
});

test('rejects an untrusted Origin on sensitive native authentication transports including native case variants', async ({
  request,
}) => {
  for (const endpoint of ['login', 'LOGIN']) {
    const login = await request.post(`/api/users/${endpoint}`, {
      headers: { origin: 'https://external.example' },
      data: { email: fixture.user.email, password: fixturePassword },
    });
    expect(login.status()).toBe(403);
    expect(Boolean(login.headers()['set-cookie'])).toBe(false);
  }
});
