import { expect, it } from 'vitest';
import { readingPositionMessage } from './reading-position-message';

it.each([
  ['pt', 'Este trecho não tem equivalente neste idioma. A leitura foi reposicionada.'],
  ['en', 'This passage has no equivalent in this language. The reading position was adjusted.'],
] as const)(
  'uses approved technical %s copy when a legacy message field is absent',
  (locale, expected) => {
    for (const value of [undefined, null, '', '  '])
      expect(readingPositionMessage(locale, value)).toBe(expected);
  },
);

it('prefers the published editorial text without deriving it from a different locale', () => {
  expect(readingPositionMessage('en', 'Reviewed synthetic target-language notice')).toBe(
    'Reviewed synthetic target-language notice',
  );
});
