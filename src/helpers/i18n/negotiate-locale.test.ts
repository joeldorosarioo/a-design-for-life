import { describe, expect, it } from 'vitest';

import { negotiateLocale } from './negotiate-locale';

describe('negotiateLocale', () => {
  it.each([
    [null, 'en'],
    ['', 'en'],
    ['   ', 'en'],
    ['fr-FR,de;q=0.9', 'en'],
    ['*', 'en'],
    ['pt', 'pt'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['en-US', 'en'],
    ['PT-br', 'pt'],
    ['fr-FR,pt-BR;q=0.8,en;q=0.6', 'pt'],
    ['en;q=0.5,pt-BR;q=0.9', 'pt'],
    ['pt;q=0.4,en-US;q=0.9', 'en'],
    ['en;q=0.5,pt-BR', 'pt'],
    ['pt;q=0,en;q=0.2', 'en'],
    ['en;q=0,pt;q=0.2', 'pt'],
    ['pt;q=0', 'en'],
    ['pt;q=0.001,en;q=0', 'pt'],
    ['pt;q=1.000,en;q=0.999', 'pt'],
    ['pt;q=0.8,en;q=0.8', 'pt'],
    ['en;q=0.8,pt;q=0.8', 'en'],
    ['  pt-BR ; q=0.9 , en-US ; q=0.1  ', 'pt'],
    ['pt;q=invalid,en;q=0.5', 'en'],
    ['pt;q=1.1,en;q=0.5', 'en'],
    ['pt;q=-0.5,en;q=0.5', 'en'],
    ['pt;q=0.1234,en;q=0.1', 'en'],
    ['pt;q=0.9;q=0.1,en;q=0.5', 'en'],
    ['pt;unexpected=1,en;q=0.5', 'en'],
    ['pt_BR,en;q=0.5', 'en'],
    ['pt-!,en;q=0.5', 'en'],
    ['pt;q=0.1,pt-BR;q=0.9,en;q=0.5', 'pt'],
    [',invalid;q=broken,,pt-BR;q=0.9', 'pt'],
  ] as const)('resolves %j to %s', (acceptLanguage, expected) => {
    expect(negotiateLocale(acceptLanguage)).toBe(expected);
  });
});
