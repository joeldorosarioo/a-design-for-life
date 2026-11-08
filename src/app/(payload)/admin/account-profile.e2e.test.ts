import { expect, test, type Page } from '@playwright/test';
import { assertIsolatedTestEnvironment } from '../../../../testing/setup/test-environment';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';

// Login and account operations use a synthetic owner in the harness-owned database.
// Do not retain authentication responses, cookies or passwords in browser recordings.
// Chromium's emulated context locale overrides page-level Accept-Language headers.
// Use an unsupported locale so the initial navigation actually exercises fallbackLanguage.
test.use({
  locale: 'zz-ZZ',
  trace: 'off',
  screenshot: 'off',
  video: 'off',
  extraHTTPHeaders: { origin: process.env.SITE_ORIGIN! },
});

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const password = 'Synthetic-editorial-test-password-123!';

test.beforeAll(async () => {
  assertIsolatedTestEnvironment(process.env);
  fixture = await createEditorialPayloadFixture('cms-account-profile-browser');
});

test.afterAll(async () => {
  await fixture?.payload.destroy();
});

async function loginInPortuguese(page: Page) {
  // An unsupported browser language falls back to Portuguese before any language cookie exists.
  await page.setExtraHTTPHeaders({ origin: process.env.SITE_ORIGIN!, 'accept-language': 'zz-ZZ' });
  await page.goto('/admin/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await page
    .context()
    .addCookies([{ name: 'payload-lng', value: 'pt', url: process.env.SITE_ORIGIN! }]);
  await page.getByRole('textbox', { name: /^Email/ }).fill(fixture.user.email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('Minha conta mantém o acesso nativo sem os campos de nome e foto', async ({ page }) => {
  await loginInPortuguese(page);
  await page.goto('/admin/account');
  await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveValue(fixture.user.email);
  await expect(page.getByRole('combobox', { name: 'Idioma', exact: true })).toBeVisible();
  await expect(page.locator('#field-name, #field-avatar')).toHaveCount(0);
  await expect(page.locator("a[href='/admin/account'] img")).toHaveCount(0);

  const response = await page.request.get(`/api/users/${fixture.user.id}?depth=0`);
  expect(response.status()).toBe(200);
  const account = await response.json();
  expect(account).toMatchObject({ id: fixture.user.id, email: fixture.user.email });
  expect(account).not.toHaveProperty('name');
  expect(account).not.toHaveProperty('avatar');
});

test('os campos de navegação têm nomes e ajuda em português mesmo no conteúdo inglês', async ({
  page,
}) => {
  await loginInPortuguese(page);
  const existing = await fixture.payload.find({
    collection: 'site-navigation',
    where: { locale: { equals: 'en' } },
    depth: 0,
    limit: 1,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  let navigation = existing.docs[0];
  if (!navigation) {
    navigation = await fixture.payload.create({
      collection: 'site-navigation',
      data: { locale: 'en' },
      draft: true,
      overrideAccess: false,
      req: await fixture.request(),
    });
    await releaseEditorialLease(
      'site-navigation',
      navigation.id,
      navigation.leaseToken!,
      await fixture.request(),
    );
  }
  await page.goto(`/admin/collections/site-navigation/${navigation.id}`);
  const readOnly = page.locator('#document-locked-view-read-only');
  if (await readOnly.isVisible()) await readOnly.click();
  await expect(
    page.getByRole('textbox', {
      name: 'Nome ou marca',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Aparece no cabeçalho e na assinatura do rodapé/)).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Link de volta à página inicial',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Título do sumário',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Aparece acima dos links para as seções do projeto/)).toBeVisible();
});
