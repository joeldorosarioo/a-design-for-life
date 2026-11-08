// Executed outside the Playwright test runner so report step titles cannot retain
// the native reset URL, password values, cookies or network request bodies.
import { chromium } from '@playwright/test';
import { authPassword, capturedMessages, capturedResetToken } from './editorial-auth';
let step = 'browser startup';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const origin = process.env.SITE_ORIGIN!;
  step = 'native forgot form';
  await page.goto(`${origin}/admin/forgot`);
  await page.getByRole('textbox', { name: /^Email/ }).fill(process.env.NATIVE_RECOVERY_EMAIL!);
  const forgot = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/users/forgot-password') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Submit$/i }).click();
  if ((await forgot).status() !== 200) throw new Error();
  step = 'local delivery capture';
  const messages = await capturedMessages(process.env.NATIVE_RECOVERY_EMAIL!);
  if (messages.length !== 1) throw new Error();
  const token = capturedResetToken(messages[0].html);
  step = 'native reset navigation';
  await page.goto(`${origin}/admin/reset/${token}`);
  step = 'native hydrated form validation';
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^Reset Password$/i }).click();
  await page.locator('.field-error').first().waitFor({ state: 'visible', timeout: 5_000 });
  step = 'native password inputs';
  await page.getByLabel(/^New Password/i).fill(`${authPassword}ui`);
  await page.getByLabel(/^Confirm Password/i).fill(`${authPassword}ui`);
  await page.waitForFunction(
    () => document.querySelectorAll('.field-error').length === 0,
    undefined,
    { timeout: 5_000 },
  );
  step = 'native reset response';
  const reset = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/users/reset-password' &&
      response.request().method() === 'POST',
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: /^Reset Password$/i }).click();
  if ((await reset).status() !== 200) throw new Error();
  step = 'native session redirect';
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 10_000 });
  const cookie = (await page.context().cookies()).find((cookie) => cookie.name === 'payload-token');
  if (!cookie?.httpOnly || cookie.sameSite !== 'Lax') throw new Error();
  console.info('Native forgot/reset forms and session cookie: PASS');
} catch {
  console.error('Native recovery failed at ' + step + '; secret-bearing details omitted.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
