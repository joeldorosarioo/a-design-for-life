import { expect, test } from '@playwright/test';

test('o painel nativo é renderizado pelo build de produção local', async ({ page }) => {
  const response = await page.goto('/admin/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('textbox', { name: /^Email/ })).toBeVisible();
});

test('cadastro inicial anônimo não cria conta pela API HTTP nativa', async ({ request }) => {
  const response = await request.post('/api/users/first-register', {
    data: { email: 'anonymous@example.invalid', password: 'Synthetic-anonymous-password-123!' },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).not.toHaveProperty('token');
});
