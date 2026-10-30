import { describe, expect, it } from 'vitest';
import { profileDTOSchema } from '@/features/professional-profile';
import type { NavigationDTO } from '../contracts/navigation-dto.schema';
import { navigationEnFixture, navigationPtFixture } from '../../../../testing/fixtures/content';
import { resolveNavigation } from './resolve-navigation';

const profiles = {
  pt: profileDTOSchema.parse({
    locale: 'pt',
    identity: { name: null, role: null },
    home: {
      eyebrow: null,
      title: null,
      titleEmphasis: null,
      description: null,
      projectsLabel: null,
    },
    listing: { eyebrow: null, title: null, description: null },
    contacts: { email: 'pt@example.invalid', linkedin: 'https://www.linkedin.com/in/synthetic-pt' },
    resumeId: '00000000-0000-4000-8000-000000000001',
    seo: {
      homeTitle: null,
      homeDescription: null,
      listingTitle: null,
      listingDescription: null,
      aboutTitle: null,
      aboutDescription: null,
    },
  }),
  en: profileDTOSchema.parse({
    locale: 'en',
    identity: { name: null, role: null },
    home: {
      eyebrow: null,
      title: null,
      titleEmphasis: null,
      description: null,
      projectsLabel: null,
    },
    listing: { eyebrow: null, title: null, description: null },
    contacts: { email: 'en@example.invalid', linkedin: 'https://www.linkedin.com/in/synthetic-en' },
    resumeId: '00000000-0000-4000-8000-000000000002',
    seo: {
      homeTitle: null,
      homeDescription: null,
      listingTitle: null,
      listingDescription: null,
      aboutTitle: null,
      aboutDescription: null,
    },
  }),
};

function input(locale: 'pt' | 'en' = 'pt') {
  // The unresolved source literals model the existing publication DTO, not resolver output.
  const navigation: NavigationDTO =
    locale === 'pt'
      ? {
          locale: 'pt',
          brand: { label: 'Marca sintética', href: '/pt' },
          items: [
            {
              purpose: 'projects',
              label: 'Projetos',
              destination: { kind: 'page', href: '/pt/cases' },
            },
            { purpose: 'about', label: 'Sobre', destination: { kind: 'page', href: '/pt/sobre' } },
            {
              purpose: 'resume',
              label: 'Currículo',
              destination: {
                kind: 'resume',
                mediaId: '00000000-0000-4000-8000-000000000001',
                newTab: true,
              },
            },
            {
              purpose: 'contact',
              label: 'Contato',
              destination: { kind: 'contact', anchor: '#contact' },
            },
          ],
          footer: {
            eyebrow: 'Contato sintético',
            title: 'Título sintético',
            description: 'Descrição sintética',
            emailLabel: 'E-mail',
            linkedinLabel: 'LinkedIn',
            resumeLabel: 'Currículo',
            copyright: 'Texto sintético',
          },
          controls: {
            newTabLabel: 'abre em nova aba',
            openMenuLabel: 'Abrir menu',
            closeMenuLabel: 'Fechar menu',
            languageLabel: 'Idioma',
          },
          messages: null,
          contacts: {
            email: 'pt@example.invalid',
            linkedin: 'https://www.linkedin.com/in/synthetic-pt',
          },
        }
      : {
          locale: 'en',
          brand: { label: 'Synthetic brand', href: '/en' },
          items: [
            {
              purpose: 'projects',
              label: 'Projects',
              destination: { kind: 'page', href: '/en/cases' },
            },
            { purpose: 'about', label: 'About', destination: { kind: 'page', href: '/en/about' } },
            {
              purpose: 'resume',
              label: 'Resume',
              destination: {
                kind: 'resume',
                mediaId: '00000000-0000-4000-8000-000000000002',
                newTab: true,
              },
            },
            {
              purpose: 'contact',
              label: 'Contact',
              destination: { kind: 'contact', anchor: '#contact' },
            },
          ],
          footer: {
            eyebrow: 'Synthetic contact',
            title: 'Synthetic title',
            description: 'Synthetic description',
            emailLabel: 'Email',
            linkedinLabel: 'LinkedIn',
            resumeLabel: 'Resume',
            copyright: 'Synthetic copy',
          },
          controls: {
            newTabLabel: 'opens in a new tab',
            openMenuLabel: 'Open menu',
            closeMenuLabel: 'Close menu',
            languageLabel: 'Language',
          },
          messages: null,
          contacts: {
            email: 'en@example.invalid',
            linkedin: 'https://www.linkedin.com/in/synthetic-en',
          },
        };
  return { locale, navigation, profile: structuredClone(profiles[locale]) };
}

describe('resolveNavigation', () => {
  it.each([
    ['pt', navigationPtFixture],
    ['en', navigationEnFixture],
  ] as const)(
    'resolves exactly four %s destinations from published contracts',
    (locale, expected) => {
      expect(resolveNavigation(input(locale))).toEqual(expected);
    },
  );

  it('rejects a requested locale different from the navigation locale', () => {
    const source = input();
    expect(() => resolveNavigation({ ...source, locale: 'en' })).toThrow();
  });

  it('rejects a profile from another locale', () => {
    const source = input();
    expect(() => resolveNavigation({ ...source, profile: profiles.en })).toThrow();
  });

  it.each(['brand', 'projects', 'about'] as const)(
    'rejects a %s path belonging to another locale',
    (part) => {
      const source = input();
      if (part === 'brand') source.navigation.brand.href = '/en';
      if (part === 'projects') source.navigation.items[0].destination.href = '/en/cases';
      if (part === 'about') source.navigation.items[1].destination.href = '/en/about';
      expect(() => resolveNavigation(source)).toThrow();
    },
  );

  it('rejects an obsolete resume reference instead of choosing one silently', () => {
    const source = input();
    source.navigation.items[2].destination.mediaId = '00000000-0000-4000-8000-000000000009';
    expect(() => resolveNavigation(source)).toThrow();
  });

  it.each([null, ''] as const)('rejects a missing resume %j', (resumeId) => {
    const source = input();
    source.profile.resumeId = resumeId;
    expect(() => resolveNavigation(source)).toThrow();
  });

  it.each(['email', 'linkedin'] as const)('rejects obsolete %s in navigation', (field) => {
    const source = input();
    source.navigation.contacts[field] =
      field === 'email' ? 'old@example.invalid' : 'https://linkedin.com/in/old';
    expect(() => resolveNavigation(source)).toThrow();
  });

  it.each([
    ['email', null],
    ['email', ''],
    ['email', 'javascript:alert(1)'],
    ['email', 'person@example.invalid\r\nBcc:other@example.invalid'],
    ['linkedin', null],
    ['linkedin', ''],
    ['linkedin', 'javascript:alert(1)'],
    ['linkedin', '<a href="https://linkedin.com">x</a>'],
    ['linkedin', 'http://linkedin.com/in/synthetic'],
    ['linkedin', 'https://user:password@linkedin.com/in/synthetic'],
    ['linkedin', 'https://linkedin.com.evil.example/in/synthetic'],
  ] as const)('rejects an unsafe or absent %s value %j', (field, value) => {
    const source = input();
    source.profile.contacts[field] = value;
    source.navigation.contacts[field] = value;
    expect(() => resolveNavigation(source)).toThrow();
  });

  it.each([null, '', '   '])('rejects a missing header label %j', (label) => {
    const source = input();
    source.navigation.items[0].label = label;
    expect(() => resolveNavigation(source)).toThrow();
  });

  it('rejects a missing brand label', () => {
    const source = input();
    source.navigation.brand.label = null;
    expect(() => resolveNavigation(source)).toThrow();
  });

  it.each(['newTabLabel', 'openMenuLabel', 'closeMenuLabel', 'languageLabel'] as const)(
    'rejects absent accessible control %s',
    (field) => {
      const source = input();
      source.navigation.controls![field] = null;
      expect(() => resolveNavigation(source)).toThrow();
    },
  );

  it.each(['emailLabel', 'linkedinLabel', 'resumeLabel'] as const)(
    'rejects absent footer link label %s',
    (field) => {
      const source = input();
      source.navigation.footer![field] = null;
      expect(() => resolveNavigation(source)).toThrow();
    },
  );

  it('accepts frozen inputs without mutating them', () => {
    const source = input();
    const before = structuredClone(source);
    Object.freeze(source.profile.contacts);
    Object.freeze(source.profile);
    Object.freeze(source.navigation.items);
    Object.freeze(source.navigation);
    Object.freeze(source);
    expect(resolveNavigation(source)).toEqual(navigationPtFixture);
    expect(source).toEqual(before);
  });
});
