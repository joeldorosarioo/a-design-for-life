import { expect, it } from 'vitest';
import { profileDTOSchema } from '@/features/professional-profile';
import type { ContextualLink } from '../contracts/contextual-link.schema';
import { resolveContextualLink } from './resolve-contextual-link';

const caseId = '00000000-0000-4000-8000-000000000010';
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  contacts: { email: null, linkedin: null },
  resumeId: '00000000-0000-4000-8000-000000000020',
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
  routes: [
    { caseId, locale: 'pt' as const, path: '/pt/cases/identidade-publicada' },
    { caseId, locale: 'en' as const, path: '/en/cases/different-published-slug' },
  ],
};
it.each([
  ['home', '/pt'],
  ['cases', '/pt/cases'],
  ['about', '/pt/sobre'],
] as const)('resolves the typed %s destination in the current locale', (page, href) => {
  expect(resolveContextualLink({ linkType: 'custom', destination: 'page', page }, context)).toEqual(
    { href },
  );
});
it('resolves the published case by UUID and current locale, never translating a slug', () => {
  expect(
    resolveContextualLink({ linkType: 'custom', destination: 'case', case: caseId }, context),
  ).toEqual({ href: '/pt/cases/identidade-publicada' });
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      { ...context, locale: 'en', profile: { ...profile, locale: 'en' } },
    ),
  ).toEqual({ href: '/en/cases/different-published-slug' });
});
it('keeps unavailable current-locale case text without a clickable link', () => {
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'case', case: caseId },
      { ...context, routes: context.routes.filter((route) => route.locale === 'en') },
    ),
  ).toBeNull();
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'case', case: '00000000-0000-4000-8000-000000000099' },
      context,
    ),
  ).toBeNull();
});
it('uses the current profile PDF and forces its approved accessible new tab behavior', () => {
  expect(
    resolveContextualLink({ linkType: 'custom', destination: 'resume', newTab: false }, context),
  ).toEqual({ href: '/media/00000000-0000-4000-8000-000000000020/original', newTab: true });
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'resume' },
      { ...context, profile: { ...profile, resumeId: null } },
    ),
  ).toBeNull();
});
it('keeps contact in the current page and preserves explicit external link behavior', () => {
  expect(resolveContextualLink({ linkType: 'custom', destination: 'contact' }, context)).toEqual({
    href: '#contact',
  });
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'external', url: 'https://example.invalid/work' },
      context,
    ),
  ).toEqual({ href: 'https://example.invalid/work' });
  expect(
    resolveContextualLink(
      {
        linkType: 'custom',
        destination: 'external',
        url: 'mailto:hello@example.invalid',
        newTab: true,
      },
      context,
    ),
  ).toEqual({ href: 'mailto:hello@example.invalid', newTab: true });
});
it.each([
  { linkType: 'custom', destination: 'external', url: 'javascript:alert(1)' },
  { linkType: 'custom', destination: 'external', url: 'https://user:password@example.invalid' },
  { linkType: 'custom', destination: 'page' },
  { linkType: 'custom', destination: 'case' },
])('renders an invalid legacy or incomplete link as text', (input) => {
  expect(resolveContextualLink(input as ContextualLink, context)).toBeNull();
});
it('rejects a route from another locale or a profile from another generation locale', () => {
  const link = { linkType: 'custom', destination: 'case', case: caseId } as const;
  expect(
    resolveContextualLink(link, {
      ...context,
      routes: [{ caseId, locale: 'pt', path: '/en/cases/leak' }],
    }),
  ).toBeNull();
  expect(
    resolveContextualLink(
      { linkType: 'custom', destination: 'resume' },
      { ...context, profile: { ...profile, locale: 'en' } },
    ),
  ).toBeNull();
});
