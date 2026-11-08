import { expect, test, type Page } from '@playwright/test';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  navigationFixture,
  profilePublicationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import { buildPrivatePreviewPath } from '@/helpers/payload/private-preview-path';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let profileId: string, navigationId: string, contentId: string;
const password = 'Synthetic-editorial-test-password-123!';
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-native-multiline');
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'draft',
    } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const navigation = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'draft' } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic multiline control fixture' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'draft',
    } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  profileId = profile.id;
  navigationId = navigation.id;
  contentId = content.id;
  for (const [collection, doc] of [
    ['professional-profiles', profile],
    ['site-navigation', navigation],
    ['cases', parent],
    ['case-content', content],
  ] as const)
    if (doc.leaseToken)
      await releaseEditorialLease(collection, doc.id, doc.leaseToken, await fixture.request());
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});

async function edit(page: Page, collection: string, id: string) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: /^Email/ }).fill(fixture.user.email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/collections/${collection}/${id}`);
}
async function save(page: Page, collection: string, id: string) {
  const response = page.waitForResponse(
    (r) => r.url().includes(`/api/${collection}/${id}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await response).status()).toBe(200);
  const reread = await page.evaluate(async (url) => {
    const result = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    return { status: result.status, data: await result.json() };
  }, `/api/${collection}/${id}?draft=true&depth=0`);
  expect(reread.status).toBe(200);
  return reread.data;
}

test('Native Profile controls preserve authored line breaks through Save Draft and Home/About preview', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const homeAbout = 'Synthetic Home About first line\nSynthetic Home About second line';
  const about = 'Synthetic About first line\nSynthetic About second line';
  const heroEmphasis = 'Synthetic hero emphasis first line\nSynthetic hero emphasis second line';
  await edit(page, 'professional-profiles', profileId);
  await page.locator('#field-home__titleEmphasis').fill(heroEmphasis);
  await page.locator('#field-homeAbout__title').fill(homeAbout);
  await page.locator('#field-about__title').fill(about);
  const reread = await save(page, 'professional-profiles', profileId);
  expect.soft(reread.homeAbout.title).toBe(homeAbout);
  expect.soft(reread.about.title).toBe(about);
  expect.soft(reread.home.titleEmphasis).toBe(heroEmphasis);
  await page.goto(
    buildPrivatePreviewPath({
      locale: 'pt',
      collection: 'professional-profiles',
      id: profileId,
      page: 'home',
    }),
  );
  expect
    .soft(await page.locator('[data-reading-key="home-about"] h2').textContent())
    .toBe(homeAbout);
  expect
    .soft(await page.locator('[data-reading-key="home-hero"] h1 > span').textContent())
    .toBe(heroEmphasis);
  await page.goto(
    buildPrivatePreviewPath({
      locale: 'pt',
      collection: 'professional-profiles',
      id: profileId,
      page: 'about',
    }),
  );
  expect.soft(await page.locator('main h1').textContent()).toBe(about);
});

test('Native Navigation footer title retains authored line breaks through Save Draft and preview', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const title = 'Synthetic footer first line\nSynthetic footer second line';
  await edit(page, 'site-navigation', navigationId);
  await page.locator('#field-footer__title').fill(title);
  const reread = await save(page, 'site-navigation', navigationId);
  expect.soft(reread.footer.title).toBe(title);
  await page.goto(
    buildPrivatePreviewPath({
      locale: 'pt',
      collection: 'site-navigation',
      id: navigationId,
      page: 'home',
    }),
  );
  expect.soft(await page.locator('footer h2').textContent()).toBe(title);
});

test('Native Case section heading retains authored line breaks through Save Draft and preview', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const heading = 'Synthetic section first line\nSynthetic section second line';
  await edit(page, 'case-content', contentId);
  await page.locator('#field-sections__0__heading').fill(heading);
  const reread = await save(page, 'case-content', contentId);
  expect.soft(reread.sections[0].heading).toBe(heading);
  await page.goto(
    buildPrivatePreviewPath({
      locale: 'pt',
      collection: 'case-content',
      id: contentId,
      page: 'case',
    }),
  );
  expect.soft(await page.locator('[id^="section-"] h2').first().textContent()).toBe(heading);
});
