import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { retryPublicationUpdate } from '../helpers/payload/publication-updates';
import { releaseEditorialLease } from '../helpers/payload/editorial-revision';
import { runtimePublication } from '../helpers/payload/publication-runtime';
import { readPublicRoot, withPublicRootWriter } from '../helpers/payload/public-root';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e18-native-publication-ui');
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: /^Email/ }).fill(fixture.user.email);
  await page.getByLabel(/^Password/).fill('Synthetic-editorial-test-password-123!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function saved(page: Page, collection: string, id: string, action: () => Promise<void>) {
  const response = page.waitForResponse(
    (item) =>
      item.url().includes(`/api/${collection}/${id}`) && item.request().method() === 'PATCH',
  );
  await action();
  const result = await response;
  expect(result.status()).toBe(200);
  return result.json();
}
test('Native CMS persists pending shared and localized updates through reload and retries without resetting unsaved edits', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native E1.8 ordering', sortOrder: 1 },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `native-publication-${randomUUID()}`;
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Previously confirmed Native title',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(content.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  for (const [collection, doc] of [
    ['cases', parent],
    ['case-content', content],
  ] as const)
    await releaseEditorialLease(collection, doc.id, doc.leaseToken!, await fixture.request());
  await login(page);
  await page.goto(`/admin/collections/cases/${parent.id}`);
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  await withPublicRootWriter(runtimePublication().directory, async () => {
    await page.locator('#field-sortOrder').fill('8');
    const result = await saved(page, 'cases', parent.id, () =>
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    );
    expect(result.publicationReceipt.state).toBe('update-pending');
    await expect(page.locator('[data-publication-state="update-pending"]')).toContainText(
      'Alterações salvas',
    );
    await page.reload();
    await expect(page.locator('[data-publication-state="update-pending"]')).toBeVisible();
    await page.screenshot({
      path: 'docs/verification/artifacts/E1.8/native-shared-pending.png',
      fullPage: true,
    });
  });
  await page.locator('#field-internalTitle').fill('Unsaved internal label stays in form');
  const revision = await page
    .locator('[data-editorial-revision]')
    .getAttribute('data-editorial-revision');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  await expect(page.locator('#field-internalTitle')).toHaveValue(
    'Unsaved internal label stays in form',
  );
  await expect(page.locator('[data-editorial-revision]')).toHaveAttribute(
    'data-editorial-revision',
    revision!,
  );
  await expect(
    page.getByText('As alterações atuais são independentes da última atualização pública.'),
  ).toBeVisible();
  await page.reload();
  await page.goto(`/admin/collections/case-content/${content.id}`);
  await withPublicRootWriter(runtimePublication().directory, async () => {
    await page.locator('#field-title').fill('New Native publication confirmed after retry');
    const result = await saved(page, 'case-content', content.id, () =>
      page.locator('#action-save').click(),
    );
    expect(result.publicationReceipt.state).toBe('update-pending');
    const previous = await request.get(`/pt/cases/${slug}`);
    expect(previous.status()).toBe(200);
    expect(await previous.text()).toContain('Previously confirmed Native title');
    await page.reload();
    await expect(page.locator('[data-publication-state="update-pending"]')).toBeVisible();
    await page.screenshot({
      path: 'docs/verification/artifacts/E1.8/native-case-pending.png',
      fullPage: true,
    });
  });
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  expect(await (await request.get(`/pt/cases/${slug}`)).text()).toContain(
    'New Native publication confirmed after retry',
  );
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.8/native-case-confirmed.png',
    fullPage: true,
  });
  expect((await request.get(`/api/case-content/${content.id}/publication-status`)).status()).toBe(
    401,
  );
});

import { illustrativeCaseDraft } from '../features/cases/content/fields/case-presentation.fixture';
test('Native CMS rejects a stale retry and keeps withdrawal pending until the public root changes', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native stale receipt' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const slug = `native-stale-${randomUUID()}`;
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug,
      title: 'Confirmed baseline',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(content.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  await releaseEditorialLease(
    'case-content',
    content.id,
    content.leaseToken!,
    await fixture.request(),
  );
  await login(page);
  await page.goto(`/admin/collections/case-content/${content.id}`);
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  await withPublicRootWriter(runtimePublication().directory, async () => {
    await page.locator('#field-title').fill('Older pending Native title');
    const result = await saved(page, 'case-content', content.id, () =>
      page.locator('#action-save').click(),
    );
    expect(result.publicationReceipt.state).toBe('update-pending');
    await page.reload();
    await expect(page.locator('[data-publication-state="update-pending"]')).toBeVisible();
  });
  const newer = await fixture.payload.update({
    collection: 'case-content',
    id: content.id,
    data: { title: 'Newer confirmed Native title', _status: 'published' },
    req: await observedRequest('case-content', content.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    await retryPublicationUpdate(newer.latestPublicationIntent!, await fixture.request()),
  ).toMatchObject({ ok: true, value: { state: 'public' } });
  const confirmed = await readPublicRoot(runtimePublication().directory);
  const retry = page.waitForResponse(
    (item) => item.url().endsWith('/publication-retry') && item.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  expect((await (await retry).json()).value.state).toBe('superseded');
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  await expect(page.locator('#field-title')).toHaveValue('Older pending Native title');
  await expect(
    page.getByText('As alterações atuais são independentes da última atualização pública.'),
  ).toBeVisible();
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(confirmed);
  expect(await (await request.get(`/pt/cases/${slug}`)).text()).toContain(
    'Newer confirmed Native title',
  );
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.8/native-stale-retry.png',
    fullPage: true,
  });
  await page.reload();
  await withPublicRootWriter(runtimePublication().directory, async () => {
    await page.locator('.doc-controls__popup button').first().click();
    await page.locator('#editorial-unpublish').click();
    const result = await saved(page, 'case-content', content.id, () =>
      page.getByRole('button', { name: 'Confirm', exact: true }).click(),
    );
    expect(result.publicationReceipt.state).toBe('update-pending');
    await expect(page.locator('[data-publication-state="update-pending"]')).toBeVisible();
    expect((await request.get(`/pt/cases/${slug}`)).status()).toBe(200);
    await page.reload();
    await expect(page.locator('[data-publication-state="update-pending"]')).toBeVisible();
    await page.screenshot({
      path: 'docs/verification/artifacts/E1.8/native-withdraw-pending.png',
      fullPage: true,
    });
  });
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('[data-publication-state="public"]')).toBeVisible();
  expect((await request.get(`/pt/cases/${slug}`)).status()).toBe(410);
});

test('Native CMS edits the illustrative Figma model only as a private draft', async ({
  page,
  request,
}) => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Illustrative Figma draft — not a real project' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const slug = `illustrative-private-${randomUUID()}`;
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: { ...illustrativeCaseDraft(), case: parent.id, slug } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const before = await readPublicRoot(runtimePublication().directory);
  await releaseEditorialLease(
    'case-content',
    content.id,
    content.leaseToken!,
    await fixture.request(),
  );
  await login(page);
  await page.goto(`/admin/collections/case-content/${content.id}`);
  await expect(page.locator('#field-title')).toHaveValue('Uma jornada');
  await expect(page.locator('#field-titleEmphasis')).toHaveValue('mais simples.');
  await expect(page.locator('#field-contextNote')).toHaveValue(/Case ilustrativo/);
  await page.locator('#field-titleEmphasis').fill('mais clara.');
  const result = await saved(page, 'case-content', content.id, () =>
    page.getByRole('button', { name: 'Save Draft', exact: true }).click(),
  );
  expect(result.doc._status).toBe('draft');
  expect(result.publicationReceipt).toBeUndefined();
  await page.reload();
  await expect(page.locator('#field-titleEmphasis')).toHaveValue('mais clara.');
  // Native blocks render their fields when they enter the viewport. Exercise the
  // actual editors before recording the model, rather than capturing placeholders.
  const blocks = page.locator('.blocks-field');
  for (let index = 0; index < (await blocks.count()); index++) {
    const block = blocks.nth(index);
    await block.scrollIntoViewIfNeeded();
  }
  const narrative = page.locator('.rich-text-lexical [contenteditable="true"]').first();
  await narrative.scrollIntoViewIfNeeded();
  await expect(narrative).toContainText('O que a pessoa precisa saber para avançar?');
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.8/native-figma-draft.png',
    fullPage: true,
  });
  const current = await fixture.payload.findByID({
    collection: 'case-content',
    id: content.id,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(current.sections?.map((section) => section.id)).toEqual(
    content.sections?.map((section) => section.id),
  );
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(before);
  expect((await request.get(`/pt/cases/${slug}`)).status()).toBe(404);
});
