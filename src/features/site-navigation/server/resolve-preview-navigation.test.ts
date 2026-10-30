import { expect, it } from 'vitest';
import { profileDTOSchema } from '@/features/professional-profile';
import { navigationDTOSchema } from '../contracts/navigation-dto.schema';
import { navigationPtFixture } from '../../../../testing/fixtures/content';
import { resolvePreviewNavigation } from './resolve-preview-navigation';
import { resolveNavigation } from './resolve-navigation';
const profileId = '33333333-3333-4333-8333-333333333333';
const resumeId = '00000000-0000-4000-8000-000000000001';
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  contacts: navigationPtFixture.contacts,
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
const navigation = navigationDTOSchema.parse({
  ...navigationPtFixture,
  items: [
    navigationPtFixture.items[0],
    navigationPtFixture.items[1],
    {
      purpose: 'resume',
      label: 'Currículo',
      destination: { kind: 'resume', mediaId: resumeId, newTab: true },
    },
    { purpose: 'contact', label: 'Contato', destination: { kind: 'contact', anchor: '#contact' } },
  ],
});
const input = {
  locale: 'pt' as const,
  profile,
  navigation,
  pageScope: { collection: 'professional-profiles' as const, id: profileId },
};
it('builds private presentation destinations including the header/footer resume without changing public navigation', () => {
  expect(() => resolvePreviewNavigation(input)).not.toThrow();
  expect(resolvePreviewNavigation(input)).toMatchObject({
    locale: 'pt',
    brand: { href: `/preview-ui/pt/professional-profiles/${profileId}/home` },
    items: [
      {
        purpose: 'projects',
        destination: { href: `/preview-ui/pt/professional-profiles/${profileId}/cases` },
      },
      {
        purpose: 'about',
        destination: { href: `/preview-ui/pt/professional-profiles/${profileId}/about` },
      },
      {
        purpose: 'resume',
        destination: { href: `/preview-media/${resumeId}/original`, newTab: true },
      },
      { purpose: 'contact', destination: { href: '#contact' } },
    ],
  });
  expect(resolveNavigation(input).items[2].destination.href).toBe(`/media/${resumeId}/original`);
});
it('refuses an invalid scope or a profile that does not match the requested locale', () => {
  expect(() =>
    resolvePreviewNavigation({
      ...input,
      pageScope: { collection: 'professional-profiles', id: '../outside' },
    }),
  ).toThrow();
  expect(() =>
    resolvePreviewNavigation({ ...input, profile: { ...profile, locale: 'en' } }),
  ).toThrow();
});
