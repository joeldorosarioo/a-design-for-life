import 'server-only';
import type { Field } from 'payload';

export function casePresentationFields(): Field[] {
  return [
    {
      name: 'titleEmphasis',
      label: 'Continuação do título em destaque (opcional)',
      type: 'text',
      admin: {
        description:
          'Parte final do título exibida com destaque visual. Escreva somente a continuação: ela será unida ao título principal para formar o título completo do projeto.',
      },
    },
  ];
}

export function sectionPresentationFields(): Field[] {
  return [
    {
      name: 'presentation',
      label: 'Como apresentar esta seção',
      type: 'select',
      defaultValue: 'narrative',
      options: [
        { label: 'Texto e imagens do estudo', value: 'narrative' },
        { label: 'Etapas do processo', value: 'process' },
        { label: 'Antes e depois em dois textos', value: 'comparison' },
        { label: 'Aprendizados', value: 'learnings' },
      ],
      admin: {
        description:
          'Escolha o arranjo visual desta seção. Antes e depois exige exatamente dois blocos de texto, primeiro o cenário inicial e depois a proposta. As outras opções aceitam os blocos de texto e imagem disponíveis.',
      },
    },
    {
      name: 'eyebrow',
      label: 'Texto curto acima do título da seção',
      type: 'text',
      admin: {
        description:
          'Identificação curta exibida antes do título. Exemplo: Processo ou Aprendizados. Também identifica a seção no sumário quando não houver título.',
      },
    },
    {
      name: 'description',
      label: 'Introdução da seção',
      type: 'textarea',
      admin: {
        description:
          'Breve apresentação exibida junto ao título da seção, antes dos blocos de texto e imagem.',
      },
    },
    {
      name: 'note',
      label: 'Observação da seção',
      type: 'textarea',
      admin: {
        description:
          'Informação complementar apresentada junto à abertura da seção, como uma ressalva ou contexto curto.',
      },
    },
  ];
}
