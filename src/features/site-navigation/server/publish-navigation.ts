import { confirmPublicationWrite } from '@/helpers/payload/confirm-publication-write';
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
export async function publishNavigation(
  input: EditorialCommand,
  req: PayloadRequest,
): Promise<Result<PublicationReceipt>> {
  return editorialResult(async () => {
    const command = validateInput(editorialCommandSchema, input, 'site-navigation', req);
    const draft = await req.payload.findByID({
      collection: 'site-navigation',
      id: command.contentId,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    delete draft.latestPublicationIntent;
    delete draft.publicConfirmed;
    const saved = await req.payload.update({
      collection: 'site-navigation',
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
      ...(await confirmPublicationWrite(saved, req)),
    });
  });
}
