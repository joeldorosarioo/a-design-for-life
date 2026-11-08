import 'server-only';
import type { PayloadRequest } from 'payload';
import {
  restoreCommandSchema,
  type Result,
  type RestoreCommand,
} from '@/helpers/payload/editorial-result.schema';
import { restoreEditorialDraft } from '@/helpers/payload/editorial-revision';
import { editorialResult } from '@/helpers/payload/editorial-result';
import { validateInput } from '@/helpers/payload/validate-input';
export async function restoreCaseDraft(
  input: RestoreCommand,
  req: PayloadRequest,
): Promise<Result<{ revision: string }>> {
  return editorialResult(() =>
    restoreEditorialDraft(
      'case-content',
      validateInput(restoreCommandSchema, input, 'case-content', req),
      req,
    ),
  );
}
