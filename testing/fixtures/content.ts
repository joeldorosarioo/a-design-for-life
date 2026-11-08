import { readServerEnv, type ServerEnv } from '../../src/config/server-env';

export function validServerEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): ServerEnv {
  return readServerEnv({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    PAYLOAD_SECRET: 'synthetic-private-payload-secret-for-tests-only',
    DATABASE_URI: 'postgres://synthetic:local-only@127.0.0.1:55433/adfl_test_fixture',
    SITE_ORIGIN: 'http://127.0.0.1:3100',
    MEDIA_BUCKET: 'adfl-test-fixture',
    ...overrides,
  });
}

// Synthetic literal navigation DTOs for UI and resolver tests; never produced by the resolver.
export const navigationPtFixture = {
  locale: 'pt',
  brand: { label: 'Marca sintética', href: '/pt' },
  items: [
    { purpose: 'projects', label: 'Projetos', destination: { kind: 'page', href: '/pt/cases' } },
    { purpose: 'about', label: 'Sobre', destination: { kind: 'page', href: '/pt/sobre' } },
    {
      purpose: 'resume',
      label: 'Currículo',
      destination: {
        kind: 'resume',
        href: '/media/00000000-0000-4000-8000-000000000001/original',
        newTab: true,
      },
    },
    { purpose: 'contact', label: 'Contato', destination: { kind: 'contact', href: '#contact' } },
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
  contacts: { email: 'pt@example.invalid', linkedin: 'https://www.linkedin.com/in/synthetic-pt' },
} satisfies ResolvedNavigationDTO;

export const navigationEnFixture = {
  locale: 'en',
  brand: { label: 'Synthetic brand', href: '/en' },
  items: [
    { purpose: 'projects', label: 'Projects', destination: { kind: 'page', href: '/en/cases' } },
    { purpose: 'about', label: 'About', destination: { kind: 'page', href: '/en/about' } },
    {
      purpose: 'resume',
      label: 'Resume',
      destination: {
        kind: 'resume',
        href: '/media/00000000-0000-4000-8000-000000000002/original',
        newTab: true,
      },
    },
    { purpose: 'contact', label: 'Contact', destination: { kind: 'contact', href: '#contact' } },
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
  contacts: { email: 'en@example.invalid', linkedin: 'https://www.linkedin.com/in/synthetic-en' },
} satisfies ResolvedNavigationDTO;

import type { ResolvedNavigationDTO } from '../../src/features/site-navigation';
