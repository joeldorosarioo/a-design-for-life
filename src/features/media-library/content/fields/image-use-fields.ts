import 'server-only';
import type { GroupField } from 'payload';

export function imageUseField(name: string, label: string): GroupField {
  return {
    name,
    label,
    type: 'group',
    fields: [
      { name: 'media', label: 'Arquivo', type: 'upload', relationTo: 'media' },
      { name: 'decorative', label: 'Imagem decorativa', type: 'checkbox', defaultValue: false },
      { name: 'alt', label: 'Texto alternativo neste idioma', type: 'text' },
      { name: 'caption', label: 'Legenda', type: 'textarea' },
    ],
  };
}
