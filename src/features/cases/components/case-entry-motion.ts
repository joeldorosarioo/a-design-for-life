import type { CaseCardDTO } from '../contracts/case-dto.schema';

export const caseOpenTransitionType = 'case-open';
export const caseOpenTransitionTypes = [caseOpenTransitionType];

export function caseCoverTransitionName({
  caseId,
  locale,
  cover,
}: Pick<CaseCardDTO, 'caseId' | 'locale' | 'cover'>) {
  return cover ? `case-cover-${locale}-${caseId}-${cover.mediaId}` : undefined;
}
