import 'server-only';
import type { PayloadRequest } from 'payload';
import {
  editorialCommandSchema,
  publicationReceiptSchema,
  type PublicationReceipt,
  type EditorialCommand,
  type Result,
} from '@/helpers/payload/editorial-result.schema';
import { editorialResult } from '@/helpers/payload/editorial-result';
import { validateInput } from '@/helpers/payload/validate-input';
export async function publishProfile(
  input: EditorialCommand,
  req: PayloadRequest,
): Promise<Result<PublicationReceipt>> {
  return editorialResult(async () => {
    const command = validateInput(editorialCommandSchema, input, 'professional-profiles', req);
    const draft = await req.payload.findByID({
      collection: 'professional-profiles',
      id: command.contentId,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    const saved = await req.payload.update({
      collection: 'professional-profiles',
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
