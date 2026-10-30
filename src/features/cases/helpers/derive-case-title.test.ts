import { expect, it } from 'vitest';
import { deriveCaseTitle } from './derive-case-title';

it('compõe o título público completo com o sufixo editorial', () => {
  expect(deriveCaseTitle('Uma jornada', 'mais simples.')).toBe('Uma jornada mais simples.');
  expect(deriveCaseTitle('  Uma jornada  ', '  mais simples.  ')).toBe('Uma jornada mais simples.');
});
it.each([undefined, null, '', '   '])(
  'preserva exatamente o título legado sem sufixo efetivo (%s)',
  (suffix) => {
    expect(deriveCaseTitle('  Título legado completo  ', suffix)).toBe(
      '  Título legado completo  ',
    );
  },
);
it('compõe rascunhos incompletos sem converter ausência em texto', () => {
  expect(deriveCaseTitle(undefined, 'ênfase final')).toBe('ênfase final');
  expect(deriveCaseTitle(null, null)).toBeNull();
  expect(deriveCaseTitle()).toBeNull();
});
