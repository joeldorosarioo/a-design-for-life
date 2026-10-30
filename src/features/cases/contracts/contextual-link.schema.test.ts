import { describe, expect, it } from 'vitest';
import { contextualLinkFieldsSchema } from './contextual-link.schema';
const base = { linkType: 'custom', newTab: false };
describe('destinos contextuais fechados', () => {
  it.each([
    { destination: 'page', page: 'home' },
    { destination: 'page', page: 'cases' },
    { destination: 'page', page: 'about' },
    { destination: 'case', case: '89d336f1-73db-4757-a70b-e509a35794ce' },
    { destination: 'resume' },
    { destination: 'contact' },
    { destination: 'external', url: 'https://example.invalid/resource' },
    { destination: 'external', url: 'mailto:synthetic@example.invalid' },
  ])('aceita alternativa declarada %j', (fields) => {
    expect(contextualLinkFieldsSchema.safeParse({ ...base, ...fields }).success).toBe(true);
  });
  it.each([
    { destination: 'page', page: 'arbitrary' },
    { destination: 'case', case: 'translated-title' },
    { destination: 'external', url: '/pt/about' },
    { destination: 'external', url: 'javascript:alert(1)' },
    { destination: 'external', url: 'data:text/html,script' },
    { destination: 'external', url: 'https://user:password@example.invalid' },
  ])('rejeita destino inválido %j', (fields) => {
    expect(contextualLinkFieldsSchema.safeParse({ ...base, ...fields }).success).toBe(false);
  });
});
