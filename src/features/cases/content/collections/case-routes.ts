import {
  protectRouteOperation,
  protectRouteChange,
  protectRouteDelete,
} from '../hooks/case-routes';
import 'server-only';
import type { CollectionConfig } from 'payload';

export const CaseRoutes: CollectionConfig = {
  slug: 'case-routes',
  labels: { singular: 'Endereço de projeto', plural: 'Endereços de projetos' },
  admin: {
    hidden: true,
    description:
      'Registro automático dos endereços atuais, reservados e anteriores dos projetos. Não é editado manualmente.',
  },
  hooks: {
    beforeOperation: [protectRouteOperation],
    beforeChange: [protectRouteChange],
    beforeDelete: [protectRouteDelete],
  },
  indexes: [{ fields: ['locale', 'slug'], unique: true }],
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    {
      name: 'locale',
      label: 'Idioma do endereço',
      type: 'select',
      required: true,
      options: [
        { label: 'Português', value: 'pt' },
        { label: 'Inglês', value: 'en' },
      ],
      admin: { description: 'Idioma ao qual este endereço pertence.' },
    },
    {
      name: 'slug',
      label: 'Trecho final do endereço',
      type: 'text',
      required: true,
      admin: {
        description: 'Endereço reservado para o projeto neste idioma, sem o domínio do site.',
      },
    },
    {
      name: 'case',
      label: 'Projeto proprietário do endereço',
      type: 'relationship',
      relationTo: 'cases',
      required: true,
      admin: { description: 'Projeto que mantém a reserva deste endereço.' },
    },
    {
      name: 'content',
      label: 'Conteúdo do projeto neste idioma',
      type: 'relationship',
      relationTo: 'case-content',
      required: true,
      admin: { description: 'Documento de conteúdo responsável por este endereço.' },
    },
    {
      name: 'everPublished',
      label: 'Este endereço já foi publicado',
      type: 'checkbox',
      defaultValue: false,
      required: true,
      admin: {
        description:
          'Registra se o endereço já esteve público, para preservar o histórico e impedir sua reutilização por outro projeto.',
      },
    },
    {
      name: 'state',
      label: 'Situação do endereço',
      admin: {
        description:
          'Indica se o endereço está reservado em rascunho, é o endereço publicado atual ou pertence ao histórico.',
      },
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Reservado no rascunho', value: 'draft' },
        { label: 'Publicado atual', value: 'current' },
        { label: 'Endereço anterior', value: 'historical' },
      ],
      required: true,
    },
  ],
};
