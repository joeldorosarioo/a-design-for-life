import { expect, it } from 'vitest';
import { caseInputSchema } from './case.schema';

it('aceita a decomposição textual da referência sem exigir comparação completa no rascunho', () => {
  const draft = {
    title: 'Uma jornada',
    titleEmphasis: 'mais simples.',
    sections: [
      {
        presentation: 'comparison',
        eyebrow: 'Comparação ilustrativa',
        heading: 'Uma mudança na ordem de leitura.',
        description: 'O conteúdo necessário permanece.',
        note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
        blocks: [
          {
            blockType: 'text',
            eyebrow: 'Antes',
            heading: 'Cenário inicial',
            note: 'Nota editorial',
          },
        ],
      },
    ],
  };
  const parsed = caseInputSchema.safeParse(draft);
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data).toEqual(draft);
});

it.each(['narrative', 'process', 'comparison', 'learnings'])(
  'aceita preset fechado %s também com campos nulos legados',
  (presentation) => {
    expect(
      caseInputSchema.safeParse({
        titleEmphasis: null,
        sections: [{ presentation, eyebrow: null, description: null, note: null }],
      }).success,
    ).toBe(true);
  },
);
it.each([
  { sections: [{ presentation: 'columns' }] },
  { sections: [{ presentation: 'comparison', columns: 2 }] },
  { sections: [{ className: 'grid' }] },
  { sections: [{ blocks: [{ blockType: 'text', style: 'color:red' }] }] },
  { sections: [{ blocks: [{ blockType: 'comparison', cards: [] }] }] },
  { titleParts: { normal: 'Título duplicado' } },
])('rejeita construtor livre, quarto tipo ou cópia derivada: %j', (draft) => {
  expect(caseInputSchema.safeParse(draft).success).toBe(false);
});
