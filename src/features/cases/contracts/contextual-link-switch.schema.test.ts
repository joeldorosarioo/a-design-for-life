import { expect, it } from 'vitest';
import { contextualLinkFieldsSchema } from './contextual-link.schema';
it('a troca de destino ignora valores inativos nativos sem torná-los autoridade', () => {
  expect(
    contextualLinkFieldsSchema.parse({
      linkType: 'custom',
      destination: 'page',
      page: 'home',
      url: 'javascript:inactive',
      case: 'inactive',
    }),
  ).toEqual({ linkType: 'custom', destination: 'page', page: 'home' });
  expect(
    contextualLinkFieldsSchema.parse({
      linkType: 'custom',
      destination: 'resume',
      url: 'https://example.invalid/old',
      page: 'about',
    }),
  ).toEqual({ linkType: 'custom', destination: 'resume' });
});
