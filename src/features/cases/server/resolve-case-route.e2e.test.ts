import { sql } from '@payloadcms/db-postgres';
import { expect, test } from '@playwright/test';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const password = 'Synthetic-editorial-test-password-123!';
const slug = () => `http-${crypto.randomUUID()}`;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.5-http');
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});
async function draft(value?: string, locale: 'pt' | 'en' = 'pt', caseId?: string) {
  const parent =
    caseId ??
    (
      await fixture.payload.create({
        collection: 'cases',
        data: { internalTitle: 'Synthetic HTTP route' },
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).id;
  return fixture.payload.create({
    collection: 'case-content',
    data: { case: parent, locale, slug: value },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
    depth: 0,
  });
}
async function save(id: string, data: Record<string, unknown>, asDraft = true) {
  return fixture.payload.update({
    collection: 'case-content',
    id,
    data,
    draft: asDraft,
    overrideAccess: false,
    req: await observedRequest('case-content', id, await fixture.request()),
    depth: 0,
  });
}
async function publish(id: string, value: string) {
  const media = await mediaMetadataFixture(fixture.payload);
  await save(
    id,
    {
      ...casePublicationFixture(media.id),
      slug: value,
      title: 'Real public route title',
      _status: 'published',
    },
    false,
  );
}
test('real HTTP statuses, private404 equivalence, native REST conflict/guards and conditional error requests', async ({
  request,
}) => {
  const a = slug(),
    b = slug();
  const doc = await draft(a);
  const unknown = await request.get(`/pt/cases/${slug()}`, { maxRedirects: 0 });
  const privateResponse = await request.get(`/pt/cases/${a}`, { maxRedirects: 0 });
  expect(privateResponse.status()).toBe(404);
  expect(unknown.status()).toBe(404);
  expect(await unknown.text()).toContain('Case n\u00e3o encontrado');
  expect(await privateResponse.text()).toBe(await unknown.text());
  for (const header of ['content-type', 'cache-control', 'x-robots-tag', 'location', 'etag'])
    expect(privateResponse.headers()[header]).toBe(unknown.headers()[header]);
  expect(await privateResponse.text()).not.toContain('Synthetic');
  await publish(doc.id, a);
  const current = await request.get(`/pt/cases/${a}`);
  expect(current.status()).toBe(200);
  expect(await current.text()).toContain('Real public route title');
  expect(current.headers()['etag']).toBeUndefined();
  const head = await request.head(`/pt/cases/${a}`);
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  await save(doc.id, { slug: b, title: 'PRIVATE DRAFT TITLE', _status: 'draft' });
  expect(await (await request.get(`/pt/cases/${a}`)).text()).not.toContain('PRIVATE DRAFT TITLE');
  expect((await request.get(`/pt/cases/${b}`)).status()).toBe(404);
  await publish(doc.id, b);
  const history = await request.get(`/pt/cases/${a}`, { maxRedirects: 0 });
  expect(history.status()).toBe(308);
  expect(history.headers()['location']).toBe(`/pt/cases/${b}`);
  expect(history.headers()['cache-control']).toContain('no-store');
  const headHistory = await request.head(`/pt/cases/${a}`, { maxRedirects: 0 });
  expect(headHistory.status()).toBe(308);
  expect(await headHistory.body()).toHaveLength(0);
  const english = await draft(a, 'en', doc.case as string);
  await publish(english.id, a);
  await save(doc.id, { _status: 'draft' }, false);
  for (const value of [a, b]) {
    const gone = await request.get(`/pt/cases/${value}`, {
      headers: {
        'If-None-Match': '*',
        'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT',
        'x-case-route-status': '200',
      },
    });
    expect(gone.status()).toBe(410);
    expect(gone.headers()['x-robots-tag']).toBe('noindex, nofollow');
    const html = await gone.text();
    expect(html).toContain('Case indisponível');
    expect(html).toContain('href="/pt/cases"');
    expect(html).toContain('href="/pt#contact"');
    expect(html).not.toContain('PRIVATE');
    const goneHead = await request.head(`/pt/cases/${value}`, {
      headers: { 'If-None-Match': '*' },
    });
    expect(goneHead.status()).toBe(410);
    expect(await goneHead.body()).toHaveLength(0);
  }
  expect((await request.get(`/en/cases/${a}`)).status()).toBe(200);
  expect(
    (
      await request.get(`/pt/cases/${slug()}`, { headers: { 'x-case-route-status': '410' } })
    ).status(),
  ).toBe(404);
  const login = await request.post('/api/users/login', {
    data: { email: fixture.user.email, password },
  });
  expect(login.ok()).toBe(true);
  const other = await draft();
  const observed = await observedRequest('case-content', other.id, await fixture.request());
  const conflict = await request.patch(`/api/case-content/${other.id}?draft=true`, {
    headers: {
      Origin: process.env.SITE_ORIGIN!,
      'x-editorial-revision': observed.headers.get('x-editorial-revision')!,
      'x-editorial-lease': observed.headers.get('x-editorial-lease')!,
    },
    data: { slug: a, _status: 'draft' },
  });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toMatchObject({
    errors: [expect.objectContaining({ code: 'slug-conflict', path: 'slug' })],
  });
  const route = (
    await fixture.payload.find({
      collection: 'case-routes',
      where: { content: { equals: doc.id } },
      limit: 1,
      req: await fixture.request(),
      overrideAccess: true,
    })
  ).docs[0];
  const forged = {
    locale: 'pt',
    slug: slug(),
    case: other.case,
    content: other.id,
    everPublished: true,
    state: 'current',
  };
  expect(
    (
      await request.post('/api/case-routes?overrideAccess=true', {
        headers: { Origin: process.env.SITE_ORIGIN! },
        data: forged,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(`/api/case-routes/${route.id}?overrideAccess=true`, {
        headers: { Origin: process.env.SITE_ORIGIN! },
        data: { case: other.case },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.delete(`/api/case-routes/${route.id}?overrideAccess=true`, {
        headers: { Origin: process.env.SITE_ORIGIN! },
      })
    ).status(),
  ).toBe(403);
  console.info(
    'E1.5 HTTP: 200/308/404/410, HEAD, conditional headers, private equivalence, native409 and registry403 verified',
  );
});
test('one real browser can reverse a previous permanent redirect by reusing owned history without a cached loop', async ({
  page,
}) => {
  const a = slug(),
    b = slug();
  const doc = await draft(a);
  await publish(doc.id, a);
  await publish(doc.id, b);
  const rawDocuments: {
    status: number;
    url: string;
    statusText: string;
    location?: string;
    criticalCH?: string;
    acceptCH?: string;
    nonAuthoritativeReason?: string;
  }[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'document') {
      const headers = response.headers();
      rawDocuments.push({
        status: response.status(),
        url: response.url(),
        statusText: response.statusText(),
        location: headers.location,
        criticalCH: headers['critical-ch'],
        acceptCH: headers['accept-ch'],
        nonAuthoritativeReason: headers['non-authoritative-reason'],
      });
    }
  });
  const documents = () =>
    rawDocuments
      .filter((response, index) => {
        const next = rawDocuments[index + 1];
        // Chromium's Critical-CH negotiation is exposed as an internal 307 to the
        // identical URL. Filter only this fully observed pair, never server redirects.
        return !(
          response.status === 307 &&
          response.statusText === 'Internal Redirect' &&
          response.location === response.url &&
          next?.url === response.url &&
          next.status === 308 &&
          next.criticalCH === 'Sec-CH-Prefers-Color-Scheme' &&
          next.acceptCH === 'Sec-CH-Prefers-Color-Scheme'
        );
      })
      .map((response) => ({ status: response.status, path: new URL(response.url).pathname }));
  await page.goto(`/pt/cases/${a}`);
  await expect(page).toHaveURL(new RegExp(`/pt/cases/${b}$`));
  await expect(page.getByRole('heading', { name: 'Real public route title' })).toBeVisible();
  expect(documents()).toEqual([
    { status: 308, path: `/pt/cases/${a}` },
    { status: 200, path: `/pt/cases/${b}` },
  ]);
  await publish(doc.id, a);
  const start = documents().length;
  await page.goto(`/pt/cases/${b}`);
  await expect(page).toHaveURL(new RegExp(`/pt/cases/${a}$`));
  await expect(page.getByRole('heading', { name: 'Real public route title' })).toBeVisible();
  expect(documents().slice(start)).toEqual([
    { status: 308, path: `/pt/cases/${b}` },
    { status: 200, path: `/pt/cases/${a}` },
  ]);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/pt/cases/${a}$`));
  const control = `/pt/cases/${slug()}`;
  expect((await page.goto(control))?.status()).toBe(404);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/pt/cases/${a}$`));
  await expect(page.getByRole('heading', { name: 'Real public route title' })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${control}$`));
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Real public route title');
  expect(rawDocuments.length).toBeLessThan(12);
  console.info(
    'E1.5 browser raw document sequence including Critical-CH:',
    JSON.stringify(rawDocuments),
  );
  console.info('E1.5 browser application sequence:', JSON.stringify(documents()));
});
test('native Payload suggestion is explicit and title edits preserve manual slug', async ({
  page,
}) => {
  const doc = await draft();
  await releaseEditorialLease('case-content', doc.id, doc.leaseToken!, await fixture.request());
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: /^Email/ }).fill(fixture.user.email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/collections/case-content/${doc.id}`);
  await page.locator('#field-title').fill('Aplicativo de Finanças');
  await expect(page.locator('#field-slug')).toHaveValue('');
  await page.getByRole('button', { name: 'Sugerir a partir do título' }).click();
  await expect(page.locator('#field-slug')).toHaveValue('aplicativo-de-financas');
  await page.locator('#field-slug').fill(slug());
  const manual = await page.locator('#field-slug').inputValue();
  await page.locator('#field-title').fill('Completely different title');
  await expect(page.locator('#field-slug')).toHaveValue(manual);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/case-content/${doc.id}`) &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText(/^Submitting/)).toHaveCount(0);
  await expect(page.locator('#field-slug')).toBeEditable();
  await expect(page.locator('#field-title')).toBeEditable();
  await expect(page.locator('#field-slug')).toHaveValue(manual);
  await expect(page.locator('#field-title')).toHaveValue('Completely different title');
  await page.reload();
  await expect(page.locator('#field-title')).toBeEditable();
  await expect(page.locator('#field-slug')).toHaveValue(manual);
  await expect(page.locator('#field-title')).toHaveValue('Completely different title');
  await expect(page.getByText(/^Submitting/)).toHaveCount(0);
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.5/native-slug-suggestion.png',
    fullPage: true,
  });
});
test('a real PostgreSQL origin query failure returns503 and recovers, never masquerading as404', async ({
  request,
}) => {
  const value = slug();
  const doc = await draft(value);
  await publish(doc.id, value);
  expect((await request.get(`/pt/cases/${value}`)).status()).toBe(200);
  if (
    process.env.APP_ENV !== 'test' ||
    !new URL(process.env.DATABASE_URI!).pathname.startsWith('/adfl_test_')
  )
    throw new Error('Fault injection requires isolated test database');
  await fixture.payload.db.execute({
    db: fixture.payload.db.drizzle,
    sql: sql`ALTER TABLE "case_routes" RENAME TO "e1_5_unavailable_case_routes"`,
  });
  try {
    const unavailable = await request.get(`/pt/cases/${value}`, {
      headers: { 'If-None-Match': '*', 'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT' },
    });
    expect(unavailable.status()).toBe(503);
    expect(unavailable.headers()['retry-after']).toBe('60');
    expect(unavailable.headers()['cache-control']).toContain('no-store');
    expect(unavailable.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(await unavailable.text()).toContain('Case indisponível');
    expect(await unavailable.text()).not.toContain('case_routes');
    expect((await request.head(`/pt/cases/${value}`)).status()).toBe(503);
  } finally {
    await fixture.payload.db.execute({
      db: fixture.payload.db.drizzle,
      sql: sql`ALTER TABLE "e1_5_unavailable_case_routes" RENAME TO "case_routes"`,
    });
  }
  expect((await request.get(`/pt/cases/${value}`)).status()).toBe(200);
  console.info('E1.5 real PostgreSQL relation-unavailable fault: 200 -> 503 GET/HEAD -> 200');
});
