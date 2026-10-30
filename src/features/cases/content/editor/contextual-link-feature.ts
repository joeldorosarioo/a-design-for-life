import 'server-only';
import { LinkFeature } from '@payloadcms/richtext-lexical';
// Native fields keep the link drawer; no free internal URLs or arbitrary relation types.
export const contextualLinkFeature = LinkFeature({
  enabledCollections: [],
  disableAutoLinks: true,
  fields: ({ defaultFields }) => [
    ...defaultFields.filter((field) => field.name === 'text' || field.name === 'newTab'),
    {
      name: 'linkType',
      type: 'select',
      defaultValue: 'custom',
      options: ['custom'],
      required: true,
      admin: { hidden: true },
    },
    {
      name: 'destination',
      label: 'Destino',
      type: 'select',
      required: true,
      defaultValue: 'external',
      options: [
        { label: 'Endereço externo', value: 'external' },
        { label: 'Página do site', value: 'page' },
        { label: 'Case por identidade', value: 'case' },
        { label: 'Currículo do idioma', value: 'resume' },
        { label: 'Contato nesta página', value: 'contact' },
      ],
    },
    {
      name: 'url',
      label: 'Endereço externo',
      type: 'text',
      defaultValue: '',
      admin: { condition: (_data, siblings) => siblings.destination === 'external' },
    },
    {
      name: 'page',
      label: 'Página',
      type: 'select',
      options: ['home', 'cases', 'about'],
      admin: { condition: (_data, siblings) => siblings.destination === 'page' },
    },
    {
      name: 'case',
      label: 'Identidade do case',
      type: 'relationship',
      relationTo: 'cases',
      admin: { condition: (_data, siblings) => siblings.destination === 'case' },
    },
  ],
});
