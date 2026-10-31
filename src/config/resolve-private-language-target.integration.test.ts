import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../testing/fixtures/editorial-auth';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { authorizePrivatePreviewRequest } from './prepare-private-preview-request';
import { resolvePrivateLanguageTarget } from './resolve-private-language-target';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let originalRoot: PublicRoot | null;
const ids = {} as Record<'pt' | 'en', { profile: string; navigation: string; content: string }>;
let untranslatedContent: string;
const options = () => ({ origin: process.env.SITE_ORIGIN! });
function incoming(
  collection = 'professional-profiles',
  id = ids.pt.profile,
  page = 'home',
  authenticated = true,
) {
  return new Request(`${options().origin}/preview-ui/pt/${collection}/${id}/${page}`, {
    headers: {
      origin: options().origin,
      'sec-fetch-site': 'same-origin',
      ...(authenticated ? { cookie } : {}),
    },
  });
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-private-language-target');
  installPayloadProvider(async () => fixture.payload);
  await clearStructuralFixture(fixture.payload);
  originalRoot = await readPublicRoot(runtimePublication().directory);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const parent = await fixture.payload.create({
    collection: 'cases',
    draft: true,
    data: { internalTitle: 'PRIVATE TRANSLATION SOURCE' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  for (const locale of ['pt', 'en'] as const) {
    const profile = await fixture.payload.create({
      collection: 'professional-profiles',
      draft: true,
      data: { ...profilePublicationFixture(image.id, pdf.id), locale, _status: 'draft' } as never,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const navigation = await fixture.payload.create({
      collection: 'site-navigation',
      draft: true,
      data: { ...navigationFixture(), locale, _status: 'draft' } as never,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const content = await fixture.payload.create({
      collection: 'case-content',
      draft: true,
      data: {
        ...casePublicationFixture(image.id),
        case: parent.id,
        locale,
        slug: null,
        _status: 'draft',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    ids[locale] = { profile: profile.id, navigation: navigation.id, content: content.id };
  }
  const untranslated = await fixture.payload.create({
    collection: 'cases',
    draft: true,
    data: { internalTitle: 'PRIVATE NO COUNTERPART' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  untranslatedContent = (
    await fixture.payload.create({
      collection: 'case-content',
      draft: true,
      data: {
        ...casePublicationFixture(image.id),
        case: untranslated.id,
        locale: 'pt',
        slug: null,
        _status: 'draft',
      },
      req: await fixture.request(),
      overrideAccess: false,
    })
  ).id;
  const login = await authHTTP(
    'login',
    { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    undefined,
    'e2-private-language-target',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  expect((await authorizePrivatePreviewRequest(incoming(), options())).ok).toBe(true);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it.each(['home', 'about', 'cases'] as const)(
  'uses the authorized counterpart profile ID for the private %s page',
  async (page) => {
    expect(
      await resolvePrivateLanguageTarget(
        incoming('professional-profiles', ids.pt.profile, page),
        options(),
      ),
    ).toBe(`/preview-ui/en/professional-profiles/${ids.en.profile}/${page}`);
  },
);
it('keeps a navigation preview scoped to the counterpart Native navigation document', async () => {
  expect(
    await resolvePrivateLanguageTarget(incoming('site-navigation', ids.pt.navigation), options()),
  ).toBe(`/preview-ui/en/site-navigation/${ids.en.navigation}/home`);
});
it('matches a draft case by permanent identity and never derives or requires a public slug', async () => {
  expect(
    await resolvePrivateLanguageTarget(incoming('case-content', ids.pt.content, 'case'), options()),
  ).toBe(`/preview-ui/en/case-content/${ids.en.content}/case`);
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(originalRoot);
});
it('does not invent a counterpart case or fallback to a public listing', async () => {
  expect(
    await resolvePrivateLanguageTarget(
      incoming('case-content', untranslatedContent, 'case'),
      options(),
    ),
  ).toBeNull();
});
it('resolves the reverse EN to PT direction for profile, navigation and permanent case identity', async () => {
  for (const [collection, sourceId, targetId, page] of [
    ['professional-profiles', ids.en.profile, ids.pt.profile, 'about'],
    ['site-navigation', ids.en.navigation, ids.pt.navigation, 'cases'],
    ['case-content', ids.en.content, ids.pt.content, 'case'],
  ] as const) {
    const base = incoming(collection, sourceId, page);
    const request = new Request(base.url.replace('/preview-ui/pt/', '/preview-ui/en/'), {
      headers: base.headers,
    });
    expect(await resolvePrivateLanguageTarget(request, options())).toBe(
      `/preview-ui/pt/${collection}/${targetId}/${page}`,
    );
  }
});
it('does not resolve a private counterpart for an anonymous or foreign-origin request', async () => {
  expect(
    await resolvePrivateLanguageTarget(
      incoming('professional-profiles', ids.pt.profile, 'home', false),
      options(),
    ),
  ).toBeNull();
  const foreign = incoming();
  foreign.headers.set('origin', 'https://outside.invalid');
  expect(await resolvePrivateLanguageTarget(foreign, options())).toBeNull();
});
it('reauthenticates rather than retaining a target after session revocation', async () => {
  const request = incoming();
  expect(await resolvePrivateLanguageTarget(request, options())).not.toBeNull();
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  expect(await resolvePrivateLanguageTarget(request, options())).toBeNull();
});
