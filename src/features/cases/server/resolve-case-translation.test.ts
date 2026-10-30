import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { resolveCaseTranslation } from './resolve-case-translation';
import type { PublicRoot } from '@/helpers/payload/public-root';
const caseId = '11111111-1111-4111-8111-111111111111';
function root(detail: unknown): PublicRoot {
  return {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: {
        operationId: 'order',
        targetRevision: 'order',
        value: { kind: 'case-order', caseId, sortOrder: 1, featured: false },
      },
      [`case-content/${caseId}`]: {
        operationId: 'target',
        targetRevision: 'revision',
        value: {
          kind: 'case',
          contentId: caseId,
          caseId,
          locale: 'en',
          slug: detail ? 'translated-canonical' : null,
          slugs: ['translated-canonical'],
          detail,
          media: [],
        } as never,
      },
    },
  };
}
it('resolves a covered withdrawal from the captured root without a Native provider', async () => {
  expect(await resolveCaseTranslation({ caseId, targetLocale: 'en', root: root(null) })).toEqual({
    ok: true,
    value: { kind: 'not-public' },
  });
});
it('does not interpret absent target coverage and unavailable Native metadata as not-public', async () => {
  const captured = root(null);
  delete captured.subjects[`case-content/${caseId}`];
  expect(
    await resolveCaseTranslation({ caseId, targetLocale: 'en', root: captured }),
  ).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});
