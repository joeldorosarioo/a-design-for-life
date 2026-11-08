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
        { label: 'Link externo', value: 'external' },
        { label: 'Página do site', value: 'page' },
        { label: 'Projeto', value: 'case' },
        { label: 'Currículo neste idioma', value: 'resume' },
        { label: 'Contato nesta página', value: 'contact' },
      ],
    },
    {
      name: 'url',
      label: 'Endereço do link',
      type: 'text',
      defaultValue: '',
      admin: {
        condition: (_data, siblings) => siblings.destination === 'external',
        description:
          'Cole um link completo, como https://exemplo.com ou mailto:contato@exemplo.com.',
      },
    },
    {
      name: 'page',
      label: 'Página',
      type: 'select',
      options: [
        { label: 'Página inicial', value: 'home' },
        { label: 'Projetos', value: 'cases' },
        { label: 'Sobre', value: 'about' },
      ],
      admin: { condition: (_data, siblings) => siblings.destination === 'page' },
    },
    {
      name: 'case',
      label: 'Projeto de destino',
      type: 'relationship',
      relationTo: 'cases',
      admin: {
        condition: (_data, siblings) => siblings.destination === 'case',
        description: 'O link usa a versão publicada no mesmo idioma do texto.',
      },
    },
  ],
});
