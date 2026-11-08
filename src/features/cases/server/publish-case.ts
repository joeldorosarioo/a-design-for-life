import 'server-only';
import type { PayloadRequest } from 'payload';
import {
  editorialCommandSchema,
  publicationReceiptSchema,
  type PublicationReceipt,
  type EditorialCommand,
} from '@/helpers/payload/editorial-result.schema';
import { caseResult, type CaseResult } from './case-result';
import { validateInput } from '@/helpers/payload/validate-input';
export async function publishCase(
  input: EditorialCommand,
  req: PayloadRequest,
): Promise<CaseResult<PublicationReceipt>> {
  return caseResult(async () => {
    const command = validateInput(editorialCommandSchema, input, 'case-content', req);
    const draft = await req.payload.findByID({
      collection: 'case-content',
      id: command.contentId,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    const saved = await req.payload.update({
      collection: 'case-content',
      id: command.contentId,
      draft: false,
      data: {
        ...draft,
        _status: 'published',
        editorialRevision: command.expectedRevision,
        leaseToken: req.headers.get('x-editorial-lease'),
      },
      overrideAccess: false,
      overrideLock: false,
      req,
    });
    return publicationReceiptSchema.parse({
      contentId: saved.id,
      locale: saved.locale,
      revision: saved.editorialRevision,
      status: 'published',
    });
  });
}
