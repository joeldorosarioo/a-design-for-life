import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { assertIsolatedTestEnvironment } from '../../testing/setup/test-environment';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';

// Credentials and response bodies never enter browser recordings or attachments.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

type Draft = { id: string; locale: string; _status: string };
async function assertAccountAndDrafts(request: APIRequestContext) {
  const headers = { origin: process.env.SITE_ORIGIN! };
  const users = await request.get('/api/users?depth=0&limit=2', { headers });
  expect(users.status()).toBe(200);
  expect((await users.json()).totalDocs).toBe(1);
  const identities: string[] = [];
  for (const collection of ['professional-profiles', 'site-navigation']) {
    const response = await request.get(`/api/${collection}?draft=true&depth=0&limit=3`, {
      headers,
    });
    expect(response.status()).toBe(200);
    const result = (await response.json()) as { totalDocs: number; docs: Draft[] };
    expect(result.totalDocs).toBe(2);
    expect(result.docs.map(({ locale }) => locale).sort()).toEqual(['en', 'pt']);
    expect(result.docs.every(({ _status }) => _status === 'draft')).toBe(true);
    identities.push(...result.docs.map(({ id, locale }) => `${collection}/${locale}/${id}`));
  }
  return identities.sort();
}

async function capturedMailFiles() {
  const namespace = createHash('sha256')
    .update(process.env.DATABASE_URI!)
    .digest('hex')
    .slice(0, 16);
  try {
    return (await readdir(path.resolve('.work/editorial-mail', namespace))).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

test('creates the first account through Native UI once, with four private drafts and no mail flow', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  if (info.config.workers !== 1 || info.config.fullyParallel)
    throw new Error('First-access proof requires its dedicated serial configuration.');
  assertIsolatedTestEnvironment(process.env);
  inspectOwnedTestDatabase();
  if (
    process.env.ADFL_TEST_FIRST_ACCESS_ENABLED !== 'true' ||
    process.env.EDITORIAL_FIRST_ACCESS_ENABLED !== 'true' ||
    process.env.PUBLIC_SITE_ENABLED !== 'false'
  )
    throw new Error('First-access proof requires its explicit private test opt-in.');
  const origin = process.env.SITE_ORIGIN!;
  const email = `first-access-${process.env.ADFL_TEST_RUN_ID}@example.invalid`;
  const password = 'Synthetic-first-access-browser-password-123!';
  const mailBefore = await capturedMailFiles();
  const mailFlows: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/forgot|reset|invite|email/i.test(pathname)) mailFlows.push(pathname);
  });
  let phase = 'Native create-first-user form';
  try {
    // Dedicated global setup owns a fresh empty DB and applies migrations only;
    // no fixture provisions an account or structural document before this UI.
    const response = await page.goto('/admin/create-first-user');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('textbox', { name: /^Email/ })).toBeVisible();
    await page.getByRole('textbox', { name: /^Email/ }).fill(email);
    await page.getByLabel(/^New Password/i).fill(password);
    await page.getByLabel(/^Confirm Password/i).fill(password);
    phase = 'Native first-register submission';
    const registration = page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === '/api/users/first-register' &&
        candidate.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Create$/i }).click();
    const registered = await registration;
    expect(registered.status()).toBe(200);
    const registeredBody = await registered.json();
    expect(Object.hasOwn(registeredBody, 'token')).toBe(false);
    // The pinned first-register Local API removes its token before generating
    // the auto-login cookie. Complete access through the ordinary Native login.
    await page.waitForURL((url) => url.pathname === '/admin/login');
    phase = 'ordinary Native login after first-account creation';
    await page.getByRole('textbox', { name: /^Email/ }).fill(email);
    await page.getByLabel(/^Password/i).fill(password);
    const firstLogin = page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === '/api/users/login' &&
        candidate.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Login$/i }).click();
    const authenticated = await firstLogin;
    phase = 'ordinary Native login response status';
    expect(authenticated.status()).toBe(200);
    phase = 'ordinary Native login JSON privacy';
    expect(Object.hasOwn(await authenticated.json(), 'token')).toBe(false);
    phase = 'ordinary Native login dashboard redirect';
    await page.waitForURL((url) => url.pathname === '/admin');
    phase = 'ordinary Native login session cookie';
    const cookie = (await page.context().cookies()).find(({ name }) => name === 'payload-token');
    expect(Boolean(cookie?.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
    phase = 'ordinary Native login session read';
    const me = await page.context().request.get('/api/users/me', { headers: { origin } });
    expect(me.status()).toBe(200);
    phase = 'ordinary Native login session identity';
    const identity = (await me.json()).user;
    expect(identity?.email === email && identity?.collection === 'users').toBe(true);
    phase = 'one editorial account and four structural drafts';
    const first = await assertAccountAndDrafts(page.context().request);
    await page.reload();
    expect(await assertAccountAndDrafts(page.context().request)).toEqual(first);
    phase = 'closed second registration after logout';
    const logout = await page.context().request.post('/api/users/logout', { headers: { origin } });
    expect(logout.status()).toBe(200);
    await page.goto('/admin/create-first-user');
    await page.waitForURL((url) => url.pathname === '/admin/login');
    await expect(page.locator('#field-confirm-password')).toHaveCount(0);
    for (const endpoint of ['/api/users/first-register', '/api/users?overrideAccess=true']) {
      const denied = await page.context().request.post(endpoint, {
        headers: { origin },
        data: {
          email: 'second-first-access@example.invalid',
          password,
          context: { trustedAccountProvisioning: true },
          overrideAccess: true,
        },
      });
      expect(denied.status()).toBe(403);
      expect(Object.hasOwn(await denied.json(), 'token')).toBe(false);
    }
    const login = await page.context().request.post('/api/users/login', {
      headers: { origin },
      data: { email, password },
    });
    expect(login.status()).toBe(200);
    expect(await assertAccountAndDrafts(page.context().request)).toEqual(first);
    await page.context().request.post('/api/users/logout', { headers: { origin } });
    expect(mailFlows.length).toBe(0);
    expect(await capturedMailFiles()).toEqual(mailBefore);
    await info.attach('native-first-access.json', {
      body: JSON.stringify({
        status: 'verified',
        loginFlow: 'native-first-register-then-native-login',
        users: 1,
        structuralDrafts: 4,
        secondRegistrationStatus: 403,
        anonymousGenericCreateStatus: 403,
        tokenInJson: false,
        mailFlowRequests: 0,
        capturedMessagesAdded: 0,
      }),
      contentType: 'application/json',
    });
  } catch {
    // Assertion details could contain an unexpected token. Keep failures generic.
    throw new Error(`Native first-access proof failed during ${phase}; private details omitted.`);
  } finally {
    // Close before the runner can produce an error-context DOM snapshot.
    await page.close();
  }
});
