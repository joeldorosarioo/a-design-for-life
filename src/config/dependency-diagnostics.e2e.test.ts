import { expect, test } from '@playwright/test';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('protects dependency diagnostics with the Native session and keeps public readiness minimal', async ({
  baseURL,
  request,
}) => {
  inspectOwnedTestDatabase();
  const endpoint = '/api/operations/diagnostics';
  const anonymous = await request.get(endpoint);
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()['cache-control']).toBe('private, no-store');
  expect(await anonymous.text()).toBe('');

  const origin = new URL(baseURL!).origin;
  const fixture = await createEditorialPayloadFixture('e3-dependency-diagnostics');
  try {
    const login = await request.post('/api/users/login', {
      headers: { origin },
      data: {
        email: fixture.user.email,
        password: 'Synthetic-editorial-test-password-123!',
      },
    });
    expect(login.status()).toBe(200);
    const diagnostics = await request.get(endpoint, { headers: { origin } });
    expect(diagnostics.status()).toBe(200);
    expect(diagnostics.headers()['cache-control']).toBe('private, no-store');
    expect(diagnostics.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(await diagnostics.json()).toEqual({
      postgresql: 'reachable',
      r2: 'not-configured',
    });

    const readiness = await request.get('/health?details=1');
    expect(readiness.status()).toBe(200);
    expect(await readiness.json()).toEqual({ status: 'ready' });
  } finally {
    await fixture.payload.destroy();
  }
});
