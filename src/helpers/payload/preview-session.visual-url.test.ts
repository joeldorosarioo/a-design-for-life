import { expect, it } from 'vitest';
import { nativePreviewURL } from './preview-session';
const id = '11111111-1111-4111-8111-111111111111';
it.each([
  ['case-content', 'case'],
  ['professional-profiles', 'home'],
  ['site-navigation', 'home'],
] as const)(
  'opens a closed visual default for Native %s without embedding draft copy',
  (collection, page) => {
    const result = nativePreviewURL(collection, {
      id,
      locale: 'pt',
      title: 'PRIVATE TITLE',
      slug: 'private-slug',
    });
    expect(result).not.toBeNull();
    const url = new URL(result!, 'http://127.0.0.1:3100');
    expect(url.pathname).toBe('/preview');
    expect(Object.fromEntries(url.searchParams)).toEqual({ collection, id, locale: 'pt', page });
    expect(result).not.toContain('PRIVATE');
    expect(result).not.toContain('private-slug');
  },
);
it('does not invent a Native preview scope for an unsaved or invalid document', () => {
  expect(nativePreviewURL('case-content', { locale: 'pt' })).toBeNull();
  expect(nativePreviewURL('professional-profiles', { id, locale: 'fr' })).toBeNull();
});
