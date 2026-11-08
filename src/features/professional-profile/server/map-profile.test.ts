import { expect, it } from 'vitest';
import type { ProfessionalProfile } from '@/payload-types';
import { mapProfile } from './map-profile';
const document: ProfessionalProfile = {
  id: '433428d4-312b-492f-853a-67601d906a16',
  locale: 'pt',
  _status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  identity: { name: 'Synthetic published fixture', role: 'Synthetic role' },
  home: { title: 'Synthetic Home' },
  listing: { title: 'Synthetic listing' },
  contacts: {
    email: 'synthetic@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic',
  },
  resume: {
    id: 'ddab1d65-bbe3-4a7c-b59a-e43806913d8f',
    createdAt: '',
    updatedAt: '',
    url: 'https://private.example.invalid/object',
    filename: 'private-file.pdf',
  },
};
it('mapeia somente conteúdo público mínimo sem metadata administrativa ou URL privada de recurso', () => {
  const dto = mapProfile(document);
  expect(dto).toMatchObject({
    locale: 'pt',
    identity: { name: document.identity!.name },
    listing: { title: 'Synthetic listing' },
    resumeId: 'ddab1d65-bbe3-4a7c-b59a-e43806913d8f',
  });
  const serialized = JSON.stringify(dto);
  for (const forbidden of [
    '_status',
    'createdAt',
    'updatedAt',
    'private-file',
    'private.example',
    document.id,
  ])
    expect(serialized).not.toContain(forbidden);
});
it('não transforma um draft de Perfil em DTO público', () => {
  expect(
    mapProfile({ ...document, _status: 'draft', identity: { name: 'Private draft text' } }),
  ).toBeUndefined();
});
