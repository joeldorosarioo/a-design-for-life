import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import { disposeCapturedMessages } from '../../../testing/fixtures/editorial-auth';
// Native recovery links/password fields must never enter traces, screenshots or snapshots.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.7-reset-ui');
});
test.afterAll(async () => {
  if (fixture) {
    await disposeCapturedMessages([fixture.user.email]);
    await fixture.payload.destroy();
  }
});

test('native admin security headers preserve the real login form and its resources', async ({
  page,
}) => {
  const response = await page.goto('/admin/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('textbox', { name: /^Email/ })).toBeVisible();
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
});

test('real native forgot and reset forms use captured delivery and the native session cookie', async () => {
  const result = spawnSync(
    process.execPath,
    ['--conditions=react-server', '--import', 'tsx', 'testing/fixtures/native-recovery-browser.ts'],
    {
      env: { ...process.env, NATIVE_RECOVERY_EMAIL: fixture.user.email },
      stdio: 'inherit',
      windowsHide: true,
      timeout: 25_000,
    },
  );
  expect(Boolean(result.error)).toBe(false);
  expect(result.status).toBe(0);
});
