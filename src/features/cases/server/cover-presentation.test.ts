import { expect, it } from 'vitest';
import type { CaseContent } from '@/payload-types';
import { caseInputSchema } from '../contracts/case.schema';
import { caseDetailDTOSchema, caseCardDTOSchema } from '../contracts/case-dto.schema';
import { mapCasePresentation, mapCaseCardPresentation } from './map-case-detail';

const document: CaseContent = {
  id: '00000000-0000-4000-8000-000000000001',
  case: '00000000-0000-4000-8000-000000000002',
  locale: 'en',
  title: 'Synthetic detail',
  createdAt: '',
  updatedAt: '',
};
const path = '/en/cases/synthetic';

it.each(['contained-cherry', 'contained-soft'] as const)(
  'accepts and projects the closed %s cover presentation without changing cards',
  (coverPresentation) => {
    expect(caseInputSchema.safeParse({ coverPresentation }).success).toBe(true);
    const source = { ...document, coverPresentation };
    const detail = mapCasePresentation(source, path);
    expect(detail).toMatchObject({ coverPresentation });
    expect(mapCaseCardPresentation(source, path)).not.toHaveProperty('coverPresentation');
    expect(caseCardDTOSchema.parse(detail)).not.toHaveProperty('coverPresentation');
  },
);

it.each([undefined, null])('keeps the legacy cover when its presentation is %s', (value) => {
  const detail = mapCasePresentation({ ...document, coverPresentation: value }, path);
  expect(detail).toMatchObject({ coverPresentation: 'contained-cherry' });
  const legacy = { ...detail, coverPresentation: value };
  expect(caseDetailDTOSchema.parse(legacy)).toMatchObject({
    coverPresentation: 'contained-cherry',
  });
});

it.each(['cover', '#ffc9d4', '', { background: 'pink' }])(
  'rejects an unsupported cover presentation in input and confirmed data: %j',
  (coverPresentation) => {
    expect(caseInputSchema.safeParse({ coverPresentation }).success).toBe(false);
    expect(
      caseDetailDTOSchema.safeParse({
        ...mapCasePresentation(document, path),
        coverPresentation,
      }).success,
    ).toBe(false);
  },
);
