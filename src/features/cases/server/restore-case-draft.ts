import 'server-only';
import type { PayloadRequest } from 'payload';
import {
  restoreCommandSchema,
  type RestoreCommand,
} from '@/helpers/payload/editorial-result.schema';
import { restoreEditorialDraft } from '@/helpers/payload/editorial-revision';
import { caseResult, type CaseResult } from './case-result';
import { validateInput } from '@/helpers/payload/validate-input';
export async function restoreCaseDraft(
  input: RestoreCommand,
  req: PayloadRequest,
): Promise<CaseResult<{ revision: string }>> {
  return caseResult(() =>
    restoreEditorialDraft(
      'case-content',
      validateInput(restoreCommandSchema, input, 'case-content', req),
      req,
    ),
  );
}
