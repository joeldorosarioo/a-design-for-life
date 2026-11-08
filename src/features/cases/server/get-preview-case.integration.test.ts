import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq, type PayloadRequest } from 'payload';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import { authHTTP } from '../../../../testing/fixtures/editorial-auth';
import {
  casePublicationFixture,
  profilePublicationFixture,
  navigationFixture,
  mediaMetadataFixture,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { getPreviewProfile } from '@/features/professional-profile/server';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import { getPreviewNavigation } from '@/features/site-navigation/server';
import { getPreviewCase } from './get-preview-case';
import { getPreviewCases } from './get-preview-cases';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let before: PublicRoot | null;
let profilePt: string;
let profileEn: string;
let navigationPt: string;
let navigationEn: string;
let contentNoSlug: string;
let contentFirst: string;
let contentEn: string;
let resumeId: string;
let baselineContentIds: string[];
const fixtureCaseIds = new Set<string>();
async function actorRequest(): Promise<PayloadRequest> {
  const headers = new Headers({
    cookie,
    origin: process.env.SITE_ORIGIN!,
    'sec-fetch-site': 'same-origin',
  });
  const session = await fixture.payload.auth({ headers });
  return createLocalReq({ user: session.user ?? undefined, req: { headers } }, fixture.payload);
}
function profileInput(): ProfileDTO {
  return profileDTOSchema.parse({
    locale: 'pt',
    identity: { name: 'PRIVATE PROFILE PT', role: null },
    home: {
      eyebrow: null,
      title: 'PRIVATE HOME PT',
      titleEmphasis: null,
      description: null,
      projectsLabel: null,
    },
    listing: { eyebrow: null, title: null, description: null },
    contacts: {
      email: 'synthetic@example.invalid',
      linkedin: 'https://www.linkedin.com/in/synthetic',
    },
    resumeId,
    seo: {
      homeTitle: null,
      homeDescription: null,
      listingTitle: null,
      listingDescription: null,
      aboutTitle: null,
      aboutDescription: null,
    },
  });
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-private-preview');
  const login = await authHTTP(
    'login',
    { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    undefined,
    'e2-private-preview',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  expect((await actorRequest()).user?.collection).toBe('users');
  await clearStructuralFixture(fixture.payload);
  before = await readPublicRoot(runtimePublication().directory);
  // Native suites share one isolated test DB. Existing authorized drafts belong
  // in the result; only this fixture's relative order and featured flag are new.
  const baseline = await fixture.payload.find({
    collection: 'case-content',
    where: { locale: { equals: 'pt' } },
    draft: true,
    depth: 0,
    pagination: false,
    limit: 0,
    overrideAccess: false,
    req: await actorRequest(),
    // Native always returns id; it is not a selectable CaseContent field.
    select: { locale: true },
  });
  baselineContentIds = baseline.docs.map((document) => document.id);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  resumeId = pdf.id;
  for (const locale of ['pt', 'en'] as const) {
    const data = profilePublicationFixture(image.id, pdf.id);
    const profile = await fixture.payload.create({
      collection: 'professional-profiles',
      draft: true,
      data: {
        ...data,
        identity: { name: `PRIVATE PROFILE ${locale.toUpperCase()}` },
        home: { title: `PRIVATE HOME ${locale.toUpperCase()}` },
        locale,
        _status: 'draft',
      } as never,
      req: await actorRequest(),
      overrideAccess: false,
    });
    const nav = await fixture.payload.create({
      collection: 'site-navigation',
      draft: true,
      data: {
        ...navigationFixture(),
        header: {
          brandLabel: `PRIVATE NAV ${locale.toUpperCase()}`,
          projectsLabel: 'Projects',
          aboutLabel: 'About',
          resumeLabel: 'Resume',
          contactLabel: 'Contact',
        },
        locale,
        _status: 'draft',
      } as never,
      req: await actorRequest(),
      overrideAccess: false,
    });
    if (locale === 'pt') {
      profilePt = profile.id;
      navigationPt = nav.id;
    } else {
      profileEn = profile.id;
      navigationEn = nav.id;
    }
  }
  for (const [sortOrder, featured, title] of [
    [20, true, 'PRIVATE SECOND'],
    [10, false, 'PRIVATE FIRST'],
  ] as const) {
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'INTERNAL ONLY', sortOrder, featured },
      req: await actorRequest(),
      overrideAccess: false,
    });
    fixtureCaseIds.add(parent.id);
    const content = await fixture.payload.create({
      collection: 'case-content',
      draft: true,
      data: {
        ...casePublicationFixture(image.id),
        title,
        slug: sortOrder === 20 ? null : 'private-slug',
        case: parent.id,
        locale: 'pt',
        _status: 'draft',
      },
      req: await actorRequest(),
      overrideAccess: false,
    });
    if (sortOrder === 20) {
      contentNoSlug = content.id;
      const en = await fixture.payload.create({
        collection: 'case-content',
        draft: true,
        data: {
          ...casePublicationFixture(image.id),
          title: 'PRIVATE EN ONLY',
          case: parent.id,
          locale: 'en',
          _status: 'draft',
        },
        req: await actorRequest(),
        overrideAccess: false,
      });
      contentEn = en.id;
    } else contentFirst = content.id;
  }
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('projects only the actor-selected saved draft profile and refuses a selected foreign locale', async () => {
  await expect(getPreviewProfile('pt', await actorRequest(), profilePt)).resolves.toMatchObject({
    ok: true,
    value: {
      locale: 'pt',
      identity: { name: 'PRIVATE PROFILE PT' },
      home: { title: 'PRIVATE HOME PT' },
    },
  });
  await expect(getPreviewProfile('pt', await actorRequest(), profileEn)).resolves.toMatchObject({
    ok: false,
    error: { code: 'forbidden' },
  });
});
it('projects the actor-selected draft navigation with its own profile and refuses cross-locale IDs', async () => {
  await expect(
    getPreviewNavigation('pt', profileInput(), await actorRequest(), navigationPt),
  ).resolves.toMatchObject({
    ok: true,
    value: {
      locale: 'pt',
      brand: { label: 'PRIVATE NAV PT' },
      items: [
        {
          purpose: 'projects',
          label: 'Projects',
          destination: { kind: 'page', href: '/pt/cases' },
        },
        { purpose: 'about', label: 'About', destination: { kind: 'page', href: '/pt/sobre' } },
        {
          purpose: 'resume',
          label: 'Resume',
          destination: { kind: 'resume', mediaId: resumeId, newTab: true },
        },
        {
          purpose: 'contact',
          label: 'Contact',
          destination: { kind: 'contact', anchor: '#contact' },
        },
      ],
    },
  });
  await expect(
    getPreviewNavigation('pt', profileInput(), await actorRequest(), navigationEn),
  ).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } });
});
it('orders and features its same-locale drafts while retaining every unrelated authorized draft', async () => {
  const result = await getPreviewCases('pt', await actorRequest());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Native preview selection unexpectedly unavailable.');
  expect(result.value.count).toBe(baselineContentIds.length + 2);
  expect(result.value.cases).toHaveLength(baselineContentIds.length + 2);
  expect(result.value.routes.map((route) => route.contentId).sort()).toEqual(
    [...baselineContentIds, contentFirst, contentNoSlug].sort(),
  );
  expect(result.value.cases.filter((card) => fixtureCaseIds.has(card.caseId))).toMatchObject([
    { title: 'PRIVATE FIRST', path: `/preview-ui/pt/case-content/${contentFirst}/case` },
    { title: 'PRIVATE SECOND', path: `/preview-ui/pt/case-content/${contentNoSlug}/case` },
  ]);
  expect(result.value.featured.filter((card) => fixtureCaseIds.has(card.caseId))).toMatchObject([
    { title: 'PRIVATE SECOND' },
  ]);
  expect(
    result.value.routes
      .filter((route) => fixtureCaseIds.has(route.caseId))
      .map((route) => route.contentId),
  ).toEqual([contentFirst, contentNoSlug]);
  expect(result.value.cases.every((card) => card.locale === 'pt')).toBe(true);
  expect(result.value.featured.every((card) => card.locale === 'pt')).toBe(true);
  expect(result.value.routes.every((route) => route.locale === 'pt')).toBe(true);
  expect(JSON.stringify(result.value)).not.toContain('PRIVATE EN ONLY');
});
it('renders a saved case draft without a public slug and refuses a selected foreign-locale document', async () => {
  const result = await getPreviewCase('pt', contentNoSlug, await actorRequest());
  expect(result).toMatchObject({
    ok: true,
    value: { title: 'PRIVATE SECOND', path: `/preview-ui/pt/case-content/${contentNoSlug}/case` },
  });
  await expect(getPreviewCase('pt', contentEn, await actorRequest())).resolves.toMatchObject({
    ok: false,
    error: { code: 'forbidden' },
  });
  if (result.ok)
    for (const privateKey of [
      '_status',
      'editorialRevision',
      'latestPublicationIntent',
      'createdAt',
      'updatedAt',
      'INTERNAL ONLY',
      'manifest',
      'guardRevision',
    ])
      expect(JSON.stringify(result.value)).not.toContain(privateKey);
});
it('keeps Native anonymous access denied and all getters refuse a real request without a session', async () => {
  const anonymous = await createLocalReq({}, fixture.payload);
  await expect(
    fixture.payload.findByID({
      collection: 'professional-profiles',
      id: profilePt,
      draft: true,
      overrideAccess: false,
      req: anonymous,
    }),
  ).rejects.toThrow();
  for (const result of [
    await getPreviewProfile('pt', anonymous, profilePt),
    await getPreviewNavigation('pt', profileInput(), anonymous, navigationPt),
    await getPreviewCase('pt', contentNoSlug, anonymous),
    await getPreviewCases('pt', anonymous),
  ])
    expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } });
});
it('never publishes a draft, advances public root or returns account/storage data', async () => {
  const profile = await getPreviewProfile('pt', await actorRequest(), profilePt);
  expect(profile.ok).toBe(true);
  if (profile.ok)
    for (const key of [
      '_status',
      'editorialRevision',
      'latestPublicationIntent',
      'createdAt',
      'updatedAt',
      'sessions',
      'guardRevision',
      'manifest',
    ])
      expect(JSON.stringify(profile.value)).not.toContain(key);
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(before);
  for (const [collection, id] of [
    ['professional-profiles', profilePt],
    ['site-navigation', navigationPt],
    ['case-content', contentNoSlug],
  ] as const) {
    const saved = await fixture.payload.findByID({
      collection,
      id,
      draft: true,
      req: await actorRequest(),
      overrideAccess: false,
    });
    expect(saved._status).toBe('draft');
  }
});
it('refuses the same cookie after its Native session is revoked', async () => {
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  await expect(getPreviewCase('pt', contentNoSlug, await actorRequest())).resolves.toMatchObject({
    ok: false,
    error: { code: 'forbidden' },
  });
});
