import { expect, it } from 'vitest';
import { profileDTOSchema } from '@/features/professional-profile';
import { resolvePreviewContextualLink } from './resolve-preview-contextual-link';
const contentId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  contacts: { email: null, linkedin: null },
  resumeId: contentId,
  seo: {
    homeTitle: null,
    homeDescription: null,
    listingTitle: null,
    listingDescription: null,
    aboutTitle: null,
    aboutDescription: null,
  },
});
const context = {
  locale: 'pt' as const,
  profile,
  pageScope: { collection: 'professional-profiles' as const, id: profileId },
  routes: [
    {
      caseId,
      contentId,
      locale: 'pt' as const,
      path: `/preview-ui/pt/case-content/${contentId}/case`,
    },
  ],
};
it.each(['home', 'about', 'cases'] as const)(
  'resolves a private %s using only a closed structural scope',
  (page) => {
    expect(
      resolvePreviewContextualLink({ linkType: 'custom', destination: 'page', page }, context),
    ).toEqual({ href: `/preview-ui/pt/professional-profiles/${profileId}/${page}` });
  },
);
it('keeps a private resume on the authenticated original route', () =>
  expect(
    resolvePreviewContextualLink({ linkType: 'custom', destination: 'resume' }, context),
  ).toEqual({ href: `/preview-media/${contentId}/original`, newTab: true }));
it('binds a case link to authorized identity, content ID and the same locale', () => {
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      context,
    ),
  ).toEqual({ href: `/preview-ui/pt/case-content/${contentId}/case` });
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      { ...context, routes: [{ ...context.routes[0], locale: 'en' }] },
    ),
  ).toBeNull();
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      { ...context, routes: [{ ...context.routes[0], path: '/pt/cases/private-slug' }] },
    ),
  ).toBeNull();
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      { ...context, routes: [{ ...context.routes[0], contentId: profileId }] },
    ),
  ).toBeNull();
});
it('keeps safe external/contact semantics and never turns missing destinations into public links', () => {
  expect(
    resolvePreviewContextualLink(
      {
        linkType: 'custom',
        destination: 'external',
        url: 'https://outside.example.invalid',
        newTab: true,
      },
      context,
    ),
  ).toEqual({ href: 'https://outside.example.invalid', newTab: true });
  expect(
    resolvePreviewContextualLink({ linkType: 'custom', destination: 'contact' }, context),
  ).toEqual({ href: '#contact' });
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'page', page: 'home' },
      { ...context, pageScope: undefined },
    ),
  ).toBeNull();
  expect(
    resolvePreviewContextualLink(
      { linkType: 'custom', destination: 'resume' },
      { ...context, profile: null },
    ),
  ).toBeNull();
});
