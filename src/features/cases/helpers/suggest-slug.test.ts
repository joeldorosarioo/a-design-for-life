import { expect, it } from 'vitest';
import { suggestSlug } from './suggest-slug';

it('suggests without accents, silently deciding no conflicts', () => {
  expect(suggestSlug('Aplicativo de Finanças')).toBe('aplicativo-de-financas');
  expect(suggestSlug('  UX & Pesquisa — 2026!  ')).toBe('ux-pesquisa-2026');
  expect(suggestSlug('A'.repeat(100))).toBe('a'.repeat(80));
  expect(suggestSlug('!!!')).toBe('');
  expect(suggestSlug('Aplicativo de Finanças')).toBe(suggestSlug('Aplicativo de Finanças'));
});
