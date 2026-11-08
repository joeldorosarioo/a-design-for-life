import 'server-only';
import type { Field } from 'payload';

export function casePresentationFields(): Field[] {
  return [
    {
      name: 'titleEmphasis',
      label: 'Trecho final em destaque',
      type: 'text',
      admin: {
        description:
          'Escreva só a continuação. O site une os dois campos para formar o título completo.',
      },
    },
  ];
}

export function sectionPresentationFields(): Field[] {
  return [
    {
      name: 'presentation',
      label: 'Formato da seção',
      type: 'select',
      defaultValue: 'narrative',
      options: [
        { label: 'Texto e imagens', value: 'narrative' },
        { label: 'Etapas do processo', value: 'process' },
        { label: 'Antes e depois', value: 'comparison' },
        { label: 'Aprendizados', value: 'learnings' },
      ],
      admin: {
        description:
          'Em Antes e depois, adicione exatamente dois blocos de texto. Coloque o cenário inicial primeiro e a proposta em seguida.',
      },
    },
    {
      name: 'eyebrow',
      label: 'Linha acima do título',
      type: 'text',
      admin: {
        description: 'Use uma indicação curta, como Processo ou Aprendizados.',
      },
    },
    {
      name: 'description',
      label: 'Introdução da seção',
      type: 'textarea',
      admin: {
        description: 'Aparece antes dos blocos de texto e imagem.',
      },
    },
    {
      name: 'note',
      label: 'Observação da seção',
      type: 'textarea',
      admin: {
        description: 'Use para uma ressalva ou um detalhe de contexto.',
      },
    },
  ];
}
