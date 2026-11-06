import 'server-only';
import type { GroupField } from 'payload';

export function imageUseField(name: string, label: string): GroupField {
  return {
    name,
    label,
    type: 'group',
    admin: {
      description:
        'Selecione a imagem e descreva este uso no idioma do documento. A mesma imagem pode ser reutilizada com descrições diferentes.',
    },
    fields: [
      {
        name: 'media',
        label: 'Arquivo da imagem',
        type: 'upload',
        relationTo: 'media',
        admin: {
          description:
            'Selecione uma imagem da biblioteca ou envie um arquivo JPEG, PNG, WebP ou AVIF de até 10 MB. Não selecione um PDF neste campo.',
        },
      },
      {
        name: 'decorative',
        label: 'Esta imagem é apenas decorativa',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description:
            'Marque somente se a imagem não acrescenta informação ao conteúdo. Nesse caso, ela será ignorada pelos leitores de tela.',
        },
      },
      {
        name: 'alt',
        label: 'Descrição da imagem para leitores de tela',
        type: 'text',
        admin: {
          description:
            'Descreva de forma breve a informação da imagem neste idioma. Obrigatória para publicar uma imagem que não seja decorativa; deixe vazia se ela for apenas decorativa.',
        },
      },
      {
        name: 'caption',
        label: 'Legenda da imagem',
        type: 'textarea',
        admin: {
          description:
            'Texto associado a este uso da imagem, no idioma do documento. Aparece junto da imagem quando a seção prevê legenda; pode incluir contexto ou crédito.',
        },
      },
    ],
  };
}
