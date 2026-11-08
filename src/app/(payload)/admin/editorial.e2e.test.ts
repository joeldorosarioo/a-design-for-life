import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  navigationFixture,
  observedRequest,
  profilePublicationFixture,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { editorialHead, releaseEditorialLease } from '@/helpers/payload/editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const password = 'Synthetic-editorial-test-password-123!';
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-browser');
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});
async function login(page: Page, email: string, pwd = password) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: /^Email/ }).fill(email);
  await page.getByLabel(/^Password/).fill(pwd);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function assertInvalidEffectivePublication(
  request: APIRequestContext,
  anonymous: APIRequestContext,
  collection: 'case-content' | 'site-navigation' | 'professional-profiles',
  id: string,
  invalidData: Record<string, unknown>,
  publicSnapshot: Record<string, unknown>,
) {
  const req = await observedRequest(collection, id, await fixture.request());
  const before = await editorialHead(collection, id, await fixture.request());
  const versionsBefore = await fixture.payload.findVersions({
    collection,
    where: { parent: { equals: id } },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const response = await request.patch(`/api/${collection}/${id}?draft=true`, {
    headers: {
      Origin: process.env.SITE_ORIGIN!,
      'x-editorial-revision': req.headers.get('x-editorial-revision')!,
      'x-editorial-lease': req.headers.get('x-editorial-lease')!,
    },
    data: { ...invalidData, _status: 'published' },
  });
  const publicDoc = await (await anonymous.get(`/api/${collection}/${id}?depth=0`)).json();
  expect(publicDoc).toMatchObject(publicSnapshot);
  expect(response.status()).toBe(400);
  expect((await editorialHead(collection, id, await fixture.request())).editorialRevision).toBe(
    before.editorialRevision,
  );
  expect(
    (
      await fixture.payload.findVersions({
        collection,
        where: { parent: { equals: id } },
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(versionsBefore.totalDocs);
}
test('two real native editors: owner saves, other reads, distinct documents save and exit releases', async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const second = await fixture.payload.create({
    collection: 'users',
    data: { email: `native-second-${crypto.randomUUID()}@example.invalid`, password },
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  const doc = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native shared document' },
    overrideAccess: false,
    req: await fixture.request(),
  });
  const other = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native other document' },
    overrideAccess: false,
    req: await fixture.request(),
  });
  for (const row of [doc, other])
    await releaseEditorialLease('cases', row.id, row.leaseToken!, await fixture.request());
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const owner = await contextA.newPage();
  const reader = await contextB.newPage();
  await login(owner, fixture.user.email);
  await login(reader, second.email);
  await owner.goto(`/admin/collections/cases/${doc.id}`);
  const firstField = owner.locator('#field-internalTitle');
  await expect(firstField).toBeEnabled();
  const oldRevision = await owner
    .locator('[data-editorial-revision]')
    .getAttribute('data-editorial-revision');
  await reader.goto(`/admin/collections/cases/${doc.id}`);
  await reader.locator('#document-locked-view-read-only').click();
  await expect(reader.locator('#field-internalTitle')).toBeDisabled();
  await reader.screenshot({
    path: 'docs/verification/artifacts/E1.4/native-reader.png',
    fullPage: true,
  });
  await owner.screenshot({
    path: 'docs/verification/artifacts/E1.4/native-owner.png',
    fullPage: true,
  });
  await firstField.fill('Saved by native owner');
  const save = owner.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${doc.id}`) && response.request().method() === 'PATCH',
  );
  await owner.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await save).status()).toBe(200);
  await expect(owner.locator('[data-editorial-revision]')).not.toHaveAttribute(
    'data-editorial-revision',
    oldRevision!,
  );
  const token = await owner.locator('[data-editorial-lease]').getAttribute('data-editorial-lease');
  const stale = await owner.request.patch(`/api/cases/${doc.id}?overrideLock=true`, {
    headers: { Origin: process.env.SITE_ORIGIN! },
    data: { internalTitle: 'Stale rejected', editorialRevision: oldRevision, leaseToken: token },
  });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toMatchObject({
    errors: [expect.objectContaining({ code: 'stale-revision' })],
  });
  const steal = await reader.request.patch(`/api/cases/${doc.id}?overrideLock=true`, {
    headers: { Origin: process.env.SITE_ORIGIN! },
    data: { internalTitle: 'Reader steal', editorialRevision: oldRevision, leaseToken: token },
  });
  expect(steal.ok()).toBe(false);
  await reader.goto(`/admin/collections/cases/${other.id}`);
  await expect(reader.locator('#field-internalTitle')).toBeEnabled();
  await reader.locator('#field-internalTitle').fill('Other document saved independently');
  const secondSave = reader.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${other.id}`) && response.request().method() === 'PATCH',
  );
  await reader.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await secondSave).status()).toBe(200);
  const translations: { id: string }[] = [];
  for (const locale of ['pt', 'en'] as const) {
    const translated = await fixture.payload.create({
      collection: 'case-content',
      data: { case: doc.id, locale },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await releaseEditorialLease(
      'case-content',
      translated.id,
      translated.leaseToken!,
      await fixture.request(),
    );
    translations.push(translated);
  }
  await owner.goto(`/admin/collections/case-content/${translations[0].id}`);
  await reader.goto(`/admin/collections/case-content/${translations[1].id}`);
  await expect(owner.locator('#field-title')).toBeEnabled();
  await expect(reader.locator('#field-title')).toBeEnabled();
  await owner.locator('#field-title').fill('Native independent PT');
  await reader.locator('#field-title').fill('Native independent EN');
  const saves = [
    owner.waitForResponse(
      (response) =>
        response.url().includes(`/api/case-content/${translations[0].id}`) &&
        response.request().method() === 'PATCH',
    ),
    reader.waitForResponse(
      (response) =>
        response.url().includes(`/api/case-content/${translations[1].id}`) &&
        response.request().method() === 'PATCH',
    ),
  ];
  await Promise.all([
    owner.getByRole('button', { name: 'Save Draft', exact: true }).click(),
    reader.getByRole('button', { name: 'Save Draft', exact: true }).click(),
  ]);
  expect((await Promise.all(saves)).map((response) => response.status())).toEqual([200, 200]);
  await reader.goto(`/admin/collections/cases/${other.id}`);
  await reader.locator('.doc-controls__popup button').first().click();
  await expect(reader.locator('#action-delete')).toBeHidden();
  await reader.locator('#editorial-delete').click();
  const deleted = reader.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${other.id}`) && response.request().method() === 'DELETE',
  );
  await reader.getByRole('button', { name: 'Confirm', exact: true }).click();
  expect((await deleted).status()).toBe(200);
  await expect(reader).toHaveURL(/\/admin\/collections\/cases(?:\?|$)/);
  await owner.goto('/admin/collections/cases');
  await expect
    .poll(async () => (await editorialHead('cases', doc.id, await fixture.request())).leaseOwner)
    .toBeNull();
  await reader.goto(`/admin/collections/cases/${doc.id}`);
  await expect(reader.locator('#field-internalTitle')).toBeEnabled();
  await expect(reader.locator('#field-internalTitle')).toHaveValue('Saved by native owner');
  await contextA.close();
  await contextB.close();
});
test('anonymous HTTP sees only each independently published locale/group and protected native restore stays draft', async ({
  request,
}) => {
  test.setTimeout(45_000);
  await clearStructuralFixture(fixture.payload);
  const loginResponse = await request.post('/api/users/login', {
    data: { email: fixture.user.email, password },
  });
  expect(loginResponse.ok()).toBe(true);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const anonymous = await (
    await import('@playwright/test')
  ).request.newContext({ baseURL: process.env.SITE_ORIGIN });
  const profiles = [];
  const navigation = [];
  for (const locale of ['pt', 'en'] as const) {
    profiles.push(
      await fixture.payload.create({
        collection: 'professional-profiles',
        data: { locale },
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    );
    navigation.push(
      await fixture.payload.create({
        collection: 'site-navigation',
        data: { locale },
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    );
  }
  for (const [collection, doc, data] of [
    ['professional-profiles', profiles[0], profilePublicationFixture(image.id, pdf.id)],
    ['site-navigation', navigation[0], navigationFixture()],
  ] as const) {
    const req = await observedRequest(collection, doc.id, await fixture.request());
    const published = await request.patch(`/api/${collection}/${doc.id}`, {
      headers: {
        Origin: process.env.SITE_ORIGIN!,
        'x-editorial-revision': req.headers.get('x-editorial-revision')!,
        'x-editorial-lease': req.headers.get('x-editorial-lease')!,
      },
      data: { ...data, _status: 'published' },
    });
    expect(published.ok()).toBe(true);
  }
  await assertInvalidEffectivePublication(
    request,
    anonymous,
    'professional-profiles',
    profiles[0].id,
    { identity: { name: '' } },
    { identity: { name: 'Synthetic name' } },
  );
  await assertInvalidEffectivePublication(
    request,
    anonymous,
    'site-navigation',
    navigation[0].id,
    { header: { brandLabel: '' } },
    { header: { brandLabel: 'Synthetic brandLabel' } },
  );
  expect(await (await anonymous.get('/api/site-navigation/published/pt')).json()).toMatchObject({
    ok: true,
    value: { locale: 'pt' },
  });
  expect((await anonymous.get('/api/site-navigation/published/en')).status()).toBe(404);
  expect((await anonymous.get('/api/professional-profiles/published/en')).status()).toBe(404);
  const req = await observedRequest('site-navigation', navigation[0].id, await fixture.request());
  const headers = {
    Origin: process.env.SITE_ORIGIN!,
    'x-editorial-revision': req.headers.get('x-editorial-revision')!,
    'x-editorial-lease': req.headers.get('x-editorial-lease')!,
  };
  expect(
    (
      await request.patch(`/api/site-navigation/${navigation[0].id}`, {
        headers,
        data: { _status: 'draft' },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await request.patch(`/api/site-navigation/${navigation[0].id}?draft=true`, {
        headers,
        data: { header: { brandLabel: 'Private draft only' }, _status: 'draft' },
      })
    ).ok(),
  ).toBe(true);
  const publicNav = await (await anonymous.get('/api/site-navigation/published/pt')).json();
  expect(publicNav).toMatchObject({
    ok: true,
    value: { brand: { label: 'Synthetic brandLabel' } },
  });
  for (const key of [
    'editorialRevision',
    'contentRevision',
    'leaseToken',
    'leaseOwner',
    'leaseExpiresAt',
  ])
    expect(JSON.stringify(publicNav)).not.toContain(key);
  const publicRaw = await (
    await anonymous.get(`/api/site-navigation/${navigation[0].id}?depth=0`)
  ).json();
  for (const key of [
    'editorialRevision',
    'contentRevision',
    'leaseToken',
    'leaseOwner',
    'leaseExpiresAt',
  ])
    expect(publicRaw).not.toHaveProperty(key);
  const versions = await fixture.payload.findVersions({
    collection: 'site-navigation',
    where: { parent: { equals: navigation[0].id } },
    limit: 100,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const old = versions.docs.find((v) => v.version._status === 'published')!;
  expect(
    (
      await request.post(`/api/site-navigation/versions/${old.id}`, {
        headers: { Origin: process.env.SITE_ORIGIN! },
      })
    ).status(),
  ).toBe(400);
  for (const query of ['', '?draft=false', '?draft=true']) {
    const current = await observedRequest(
      'site-navigation',
      navigation[0].id,
      await fixture.request(),
    );
    const restored = await request.post(`/api/site-navigation/versions/${old.id}${query}`, {
      headers: {
        Origin: process.env.SITE_ORIGIN!,
        'x-editorial-revision': current.headers.get('x-editorial-revision')!,
        'x-editorial-lease': current.headers.get('x-editorial-lease')!,
      },
    });
    expect(restored.ok()).toBe(true);
    expect(
      (
        await fixture.payload.findByID({
          collection: 'site-navigation',
          id: navigation[0].id,
          draft: true,
          depth: 0,
          overrideAccess: false,
          req: await fixture.request(),
        })
      )._status,
    ).toBe('draft');
    expect(await (await anonymous.get('/api/site-navigation/published/pt')).json()).toMatchObject({
      ok: true,
      value: { brand: { label: 'Synthetic brandLabel' } },
    });
  }
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'HTTP independent case' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const pt = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'en' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const observed = await observedRequest('case-content', pt.id, await fixture.request());
  expect(
    (
      await request.patch(`/api/case-content/${pt.id}`, {
        headers: {
          Origin: process.env.SITE_ORIGIN!,
          'x-editorial-revision': observed.headers.get('x-editorial-revision')!,
          'x-editorial-lease': observed.headers.get('x-editorial-lease')!,
        },
        data: { ...casePublicationFixture(image.id), _status: 'published' },
      })
    ).ok(),
  ).toBe(true);
  const publicCases = await (
    await anonymous.get(`/api/case-content?where[case][equals]=${shared.id}&depth=0`)
  ).json();
  expect(publicCases.docs.map((doc: { locale: string }) => doc.locale)).toEqual(['pt']);
  await assertInvalidEffectivePublication(
    request,
    anonymous,
    'case-content',
    pt.id,
    { summary: '' },
    { title: 'Synthetic title', summary: 'Synthetic summary' },
  );
  await anonymous.dispose();
});

test('native version comparison restores a draft; native Save Draft and Publish send the observed revision', async ({
  page,
  request,
}) => {
  test.setTimeout(45_000);
  await clearStructuralFixture(fixture.payload);
  const doc = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'pt' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await fixture.payload.update({
    collection: 'site-navigation',
    id: doc.id,
    data: { ...navigationFixture(), _status: 'published' },
    req: await observedRequest('site-navigation', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  const versions = await fixture.payload.findVersions({
    collection: 'site-navigation',
    where: { parent: { equals: doc.id } },
    limit: 100,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const old = versions.docs.find((v) => v.version._status === 'published')!;
  await fixture.payload.update({
    collection: 'site-navigation',
    id: doc.id,
    data: { header: { brandLabel: 'Latest public navigation' }, _status: 'published' },
    req: await observedRequest('site-navigation', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  await login(page, fixture.user.email);
  await page.goto(`/admin/collections/site-navigation/${doc.id}/versions/${old.id}`);
  await expect(page.locator('.view-version')).toBeVisible();
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.4/native-version-diff.png',
    fullPage: true,
  });
  await expect(page.locator('.restore-version')).toBeHidden();
  await page.getByRole('button', { name: 'Restore as draft', exact: true }).click();
  const restored = page.waitForResponse(
    (response) =>
      response.url().includes(`/versions/${old.id}`) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  expect((await restored).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/admin/collections/site-navigation/${doc.id}$`));
  const brand = page.getByRole('textbox', { name: 'Marca/retorno à Home' });
  await expect(brand).toHaveValue('Synthetic brandLabel');
  expect(
    (await (await request.get(`/api/site-navigation/${doc.id}?depth=0`)).json()).header.brandLabel,
  ).toBe('Latest public navigation');
  await brand.fill('New native draft');
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/site-navigation/${doc.id}`) &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await saved).status()).toBe(200);
  expect(
    (await (await request.get(`/api/site-navigation/${doc.id}?depth=0`)).json()).header.brandLabel,
  ).toBe('Latest public navigation');
  const published = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/site-navigation/${doc.id}`) &&
      response.request().method() === 'PATCH',
  );
  await page.locator('#action-save').click();
  expect((await published).status()).toBe(200);
  expect(
    (await (await request.get(`/api/site-navigation/${doc.id}?depth=0`)).json()).header.brandLabel,
  ).toBe('New native draft');
});

test('an old native tab keeps its observed revision through focus and reacquisition and shows a save conflict', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const doc = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native stale original' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await releaseEditorialLease('cases', doc.id, doc.leaseToken!, await fixture.request());
  await login(page, fixture.user.email);
  await page.goto(`/admin/collections/cases/${doc.id}`);
  const beforeSave = await page
    .locator('[data-editorial-revision]')
    .getAttribute('data-editorial-revision');
  await page.locator('#field-internalTitle').fill('First native edit');
  const initial = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${doc.id}`) && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await initial).status()).toBe(200);
  await expect(page.locator('[data-editorial-revision]')).not.toHaveAttribute(
    'data-editorial-revision',
    beforeSave!,
  );
  const observed = await page
    .locator('[data-editorial-revision]')
    .getAttribute('data-editorial-revision');
  const other = await page.context().newPage();
  await other.goto(`/admin/collections/cases/${doc.id}`);
  await other.locator('#field-internalTitle').fill('Other native tab committed');
  const committed = other.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${doc.id}`) && response.request().method() === 'PATCH',
  );
  await other.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await committed).status()).toBe(200);
  await page.bringToFront();
  const lease = await page.evaluate(
    async (id) =>
      (
        await fetch(`/api/cases/${id}/editorial-lease`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'acquire' }),
        })
      ).json(),
    doc.id,
  );
  expect(lease.editable).toBe(true);
  expect(lease.revision).not.toBe(observed);
  await expect(page.locator('[data-editorial-revision]')).toHaveAttribute(
    'data-editorial-revision',
    observed!,
  );
  await expect(page.getByText('Updated successfully.', { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
  await page.locator('#field-internalTitle').fill('Old native form must not overwrite');
  const conflict = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/cases/${doc.id}`) && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  const conflictMessage = page.getByText(
    'This document changed. Refresh before saving your changes.',
    { exact: true },
  );
  await expect(conflictMessage).toBeVisible();
  await expect(conflictMessage).toBeInViewport({ ratio: 1 });
  const errorToast = conflictMessage.locator('xpath=ancestor::*[@data-sonner-toast]');
  await expect(errorToast).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const box = await errorToast.boundingBox();
      return box ? Math.round(box.y + box.height) : -1;
    })
    .toBeLessThanOrEqual(720);

  await page.screenshot({
    path: 'docs/verification/artifacts/E1.4/native-stale-conflict.png',
    fullPage: true,
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'cases',
        id: doc.id,
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).internalTitle,
  ).toBe('Other native tab committed');
  await other.close();
});
