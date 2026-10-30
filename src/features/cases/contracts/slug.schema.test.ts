import { describe, expect, it } from 'vitest';
import { caseInputSchema } from './case.schema';

describe('explicit case slug policy', () => {
  it.each(['INVALID', 'com espaço', 'ação', 'a/b', 'a_b', 'a'.repeat(81)])(
    'rejects an invalid supplied slug even in a draft: %s',
    (slug) => expect(caseInputSchema.safeParse({ slug }).success).toBe(false),
  );
  it.each([undefined, null, '', 'a', 'a-12', '-a--'])(
    'allows missing draft slug and approved ASCII: %s',
    (slug) => {
      expect(caseInputSchema.safeParse({ slug }).success).toBe(true);
    },
  );
});
