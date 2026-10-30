import { expect, it } from 'vitest';
import type { SiteNavigation } from '@/payload-types';
import { profileDTOSchema } from '@/features/professional-profile';
import { mapNavigation } from './map-navigation';
const navigation: SiteNavigation = {
  id: '581e0654-27e2-412b-b954-538354857e9c',
  locale: 'pt',
  _status: 'published',
  createdAt: '',
  updatedAt: '',
  header: {
    brandLabel: 'Synthetic brand',
    projectsLabel: 'Synthetic projects',
    aboutLabel: 'Synthetic about',
    resumeLabel: 'Synthetic resume',
    contactLabel: 'Synthetic contact',
  },
  footer: { title: 'Synthetic footer' },
};
const profile = profileDTOSchema.parse({
  locale: 'pt',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  contacts: {
    email: 'synthetic@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic',
  },
  resumeId: '900ad009-3fa9-4362-b310-a0925e8fa84a',
  seo: {
    homeTitle: null,
    homeDescription: null,
    listingTitle: null,
    listingDescription: null,
    aboutTitle: null,
    aboutDescription: null,
  },
});
it('deriva quatro finalidades/ordem fixas e contatos/currículo somente do Perfil publicado', () => {
  const dto = mapNavigation(navigation, profile);
  expect(dto).toMatchObject({
    locale: 'pt',
    items: [
      {
        purpose: 'projects',
        label: 'Synthetic projects',
        destination: { kind: 'page', href: '/pt/cases' },
      },
      {
        purpose: 'about',
        label: 'Synthetic about',
        destination: { kind: 'page', href: '/pt/sobre' },
      },
      {
        purpose: 'resume',
        destination: { kind: 'resume', mediaId: profile.resumeId, newTab: true },
      },
      { purpose: 'contact', destination: { kind: 'contact', anchor: '#contact' } },
    ],
    contacts: profile.contacts,
  });
  const serialized = JSON.stringify(dto);
  for (const forbidden of ['_status', 'createdAt', 'updatedAt', navigation.id])
    expect(serialized).not.toContain(forbidden);
});
it('não entrega draft nem cruza idiomas ou Perfil indisponível', () => {
  expect(mapNavigation({ ...navigation, _status: 'draft' }, profile)).toBeUndefined();
  expect(mapNavigation(navigation, { ...profile, locale: 'en' })).toBeUndefined();
  expect(mapNavigation(navigation)).toBeUndefined();
});

it('mantém About em inglês e Sobre em português conforme rotas aprovadas', () => {
  expect(
    mapNavigation({ ...navigation, locale: 'en' }, { ...profile, locale: 'en' }),
  ).toMatchObject({
    items: [{ destination: { href: '/en/cases' } }, { destination: { href: '/en/about' } }, {}, {}],
  });
  expect(mapNavigation(navigation, profile)).toMatchObject({
    items: [{}, { destination: { href: '/pt/sobre' } }, {}, {}],
  });
});
