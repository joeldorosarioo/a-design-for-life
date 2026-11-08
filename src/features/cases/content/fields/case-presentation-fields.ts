import 'server-only';
import type { Field } from 'payload';

export function casePresentationFields(): Field[] {
  return [
    {
      name: 'titleEmphasis',
      label: 'Ênfase final do título',
      type: 'text',
      admin: {
        description: 'Sufixo opcional do título. O título completo é derivado das duas partes.',
      },
    },
  ];
}

export function sectionPresentationFields(): Field[] {
  return [
    {
      name: 'presentation',
      label: 'Apresentação da seção',
      type: 'select',
      defaultValue: 'narrative',
      options: [
        { label: 'Narrativa', value: 'narrative' },
        { label: 'Processo', value: 'process' },
        { label: 'Comparação textual antes e depois', value: 'comparison' },
        { label: 'Aprendizados', value: 'learnings' },
      ],
      admin: {
        description: 'Composição predefinida. Comparação exige dois blocos de texto ao publicar.',
      },
    },
    { name: 'eyebrow', label: 'Identificação visível da seção e do sumário', type: 'text' },
    { name: 'description', label: 'Introdução da seção', type: 'textarea' },
    { name: 'note', label: 'Nota da seção', type: 'textarea' },
  ];
}
