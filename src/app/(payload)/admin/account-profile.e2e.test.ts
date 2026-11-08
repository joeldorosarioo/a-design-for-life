import { expect, test, type Page } from '@playwright/test';
import { assertIsolatedTestEnvironment } from '../../../../testing/setup/test-environment';
import sharp from 'sharp';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import { pdfUploadFixture } from '../../../../testing/fixtures/media-uploads';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import type { Media } from '@/payload-types';

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

test('a conta salva nome e foto pelo formulário nativo em português e mantém os bytes da foto privados', async ({
  page,
  playwright,
}) => {
  test.setTimeout(60_000);
  await loginInPortuguese(page);
  const imageBytes = await sharp({
    create: { width: 80, height: 80, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const nonce = crypto.randomUUID();
  const uploadedImage = await page.request.post('/api/media', {
    multipart: {
      _payload: JSON.stringify({ label: `Synthetic account portrait ${nonce}` }),
      file: { name: `account-portrait-${nonce}.png`, mimeType: 'image/png', buffer: imageBytes },
    },
  });
  expect(uploadedImage.status()).toBe(201);
  const image = (await uploadedImage.json()).doc as Media;
  const uploadedPdf = await page.request.post('/api/media', {
    multipart: {
      _payload: JSON.stringify({ label: `Synthetic account PDF ${nonce}` }),
      file: {
        name: `account-document-${nonce}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from(pdfUploadFixture()),
      },
    },
  });
  expect(uploadedPdf.status()).toBe(201);
  const pdf = (await uploadedPdf.json()).doc as Media;

  const invalidPhoto = await page.request.patch(`/api/users/${fixture.user.id}`, {
    data: { avatar: pdf.id },
  });
  expect(invalidPhoto.status()).toBe(400);

  await page.goto('/admin/account');
  const name = page.getByRole('textbox', { name: 'Nome de exibição', exact: true });
  await expect(name).toBeVisible();
  const language = page.getByRole('combobox', { name: 'Idioma', exact: true });
  await language.click();
  await expect(page.getByRole('option', { name: 'Português', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await name.fill('Editora sintética do portfólio');
  const photo = page.locator('#field-avatar');
  await expect(photo.getByText('Foto de perfil da conta', { exact: true })).toBeVisible();
  await photo.getByRole('button', { name: 'Escolher entre os existentes', exact: true }).click();
  const picker = page.locator('.list-drawer:visible');
  await expect(picker.getByText(image.filename!, { exact: true })).toBeVisible();
  await expect(picker.getByText(pdf.filename!, { exact: true })).toHaveCount(0);
  await picker.getByText(image.filename!, { exact: true }).click();
  await expect(picker).toHaveCount(0);
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/users/${fixture.user.id}` &&
      response.request().method() === 'PATCH',
  );
  await page.locator('#action-save').click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(name).toHaveValue('Editora sintética do portfólio');
  await expect(photo.getByText(image.filename!, { exact: true })).toBeVisible();
  const current = await page.request.get(`/api/users/${fixture.user.id}?depth=0`);
  expect(current.status()).toBe(200);
  expect(await current.json()).toMatchObject({
    name: 'Editora sintética do portfólio',
    avatar: image.id,
  });

  const previewPath = `/preview-media/${image.id}/original`;
  const avatar = page.locator(`a[href='/admin/account'] img[src$='${previewPath}']`);
  await expect(avatar).toBeVisible();
  expect(
    new URL((await avatar.getAttribute('src')) as string, process.env.SITE_ORIGIN).origin,
  ).toBe(new URL(process.env.SITE_ORIGIN!).origin);
  await expect
    .poll(() => avatar.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  const privatePhoto = await page.request.get(previewPath);
  expect(privatePhoto.status()).toBe(200);
  expect(privatePhoto.headers()['cache-control']).toContain('private');
  expect(privatePhoto.headers()['cache-control']).toContain('no-store');
  expect(await privatePhoto.body()).toEqual(imageBytes);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.SITE_ORIGIN });
  try {
    const denied = await anonymous.get(previewPath);
    expect([401, 403, 404]).toContain(denied.status());
    expect(denied.headers()['cache-control']).toContain('no-store');
  } finally {
    await anonymous.dispose();
  }
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
      name: 'Nome ou marca que leva à página inicial',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Texto no canto superior do site e na assinatura do rodapé/),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Texto para voltar à página inicial',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Título do sumário do projeto',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Título acima da lista de seções que permite navegar pelo projeto/),
  ).toBeVisible();
});
