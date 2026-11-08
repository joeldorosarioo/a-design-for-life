import 'server-only';
import type { GroupField } from 'payload';

export function imageUseField(name: string, label: string): GroupField {
  return {
    name,
    label,
    type: 'group',
    admin: {
      description:
        'A mesma imagem pode ter texto alternativo e legenda diferentes em cada página ou idioma.',
    },
    fields: [
      {
        name: 'media',
        label: 'Arquivo',
        type: 'upload',
        relationTo: 'media',
        admin: {
          description:
            'Escolha uma imagem da biblioteca ou envie JPEG, PNG, WebP ou AVIF de até 10 MB.',
        },
      },
      {
        name: 'decorative',
        label: 'Imagem decorativa',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description: 'Marque se a imagem só enfeita a página. Leitores de tela vão ignorá-la.',
        },
      },
      {
        name: 'alt',
        label: 'Texto alternativo',
        type: 'text',
        admin: {
          description:
            'Descreva o que a imagem comunica, no idioma da página. Preencha para publicar uma imagem informativa. Se for decorativa, deixe em branco.',
        },
      },
      {
        name: 'caption',
        label: 'Legenda',
        type: 'textarea',
        admin: {
          description:
            'Pode incluir contexto ou crédito. Aparece junto da imagem nos layouts que exibem legenda.',
        },
      },
    ],
  };
}
