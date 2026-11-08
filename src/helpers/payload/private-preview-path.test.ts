import { expect, it } from 'vitest';
import {
  buildPrivatePreviewPath,
  parsePrivatePreviewPath,
  type PrivatePreviewScope,
} from './private-preview-path';
const id = '11111111-1111-4111-8111-111111111111';
it.each([
  { locale: 'pt', collection: 'case-content', id, page: 'case' },
  { locale: 'en', collection: 'professional-profiles', id, page: 'home' },
  { locale: 'pt', collection: 'site-navigation', id, page: 'about' },
  { locale: 'en', collection: 'site-navigation', id, page: 'cases' },
] as const)('builds and validates only a closed private scope: %j', (scope) => {
  const path = `/preview-ui/${scope.locale}/${scope.collection}/${id}/${scope.page}`;
  expect(buildPrivatePreviewPath(scope)).toBe(path);
  expect(parsePrivatePreviewPath(path)).toEqual(scope);
});
it.each([
  { locale: 'fr', collection: 'case-content', id, page: 'case' },
  { locale: 'pt', collection: 'users', id, page: 'home' },
  { locale: 'pt', collection: 'case-content', id: '../secret', page: 'case' },
  {
    locale: 'pt',
    collection: 'case-content',
    id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    page: 'case',
  },
  { locale: 'pt', collection: 'case-content', id, page: 'home' },
  { locale: 'pt', collection: 'professional-profiles', id, page: 'case' },
  { locale: 'pt', collection: 'professional-profiles', id, page: 'home', slug: 'private' },
])('rejects an invalid private path scope: %j', (scope) =>
  expect(() => buildPrivatePreviewPath(scope as PrivatePreviewScope)).toThrow(),
);
it.each([
  'https://outside.invalid/preview-ui/pt/case-content/' + id + '/case',
  '//outside.invalid/x',
  '/preview-ui/pt/case-content/' + id + '/case?draft=1',
  '/preview-ui/pt/case-content/' + id + '/case#x',
  '/preview-ui/pt/case-content/%2e%2e/case',
])('rejects a noncanonical private path: %s', (path) =>
  expect(() => parsePrivatePreviewPath(path)).toThrow(),
);
