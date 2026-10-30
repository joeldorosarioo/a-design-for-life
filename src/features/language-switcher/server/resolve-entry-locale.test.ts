import { describe, expect, it } from 'vitest';

import { resolveEntryLocale } from './resolve-entry-locale';

describe('resolveEntryLocale', () => {
  it.each([
    [{ savedLocale: 'pt', acceptLanguage: 'en-US,en;q=0.9' }, 'pt'],
    [{ savedLocale: 'en', acceptLanguage: 'pt-BR,pt;q=0.9' }, 'en'],
    [{ savedLocale: null, acceptLanguage: 'en;q=0.5,pt-BR;q=0.9' }, 'pt'],
    [{ savedLocale: 'valor-invalido', acceptLanguage: 'fr-FR' }, 'en'],
    [{ savedLocale: 'pt-BR', acceptLanguage: 'en-US' }, 'en'],
    [{ savedLocale: 'PT', acceptLanguage: 'en-US' }, 'en'],
    [{ savedLocale: ' pt ', acceptLanguage: 'en-US' }, 'en'],
    [{ savedLocale: '', acceptLanguage: 'pt-BR' }, 'pt'],
    [{ savedLocale: null, acceptLanguage: null }, 'en'],
    [{ savedLocale: 'pt', acceptLanguage: null }, 'pt'],
  ] as const)('resolves %j to %s', (input, expected) => {
    expect(resolveEntryLocale(input)).toBe(expected);
  });
});
