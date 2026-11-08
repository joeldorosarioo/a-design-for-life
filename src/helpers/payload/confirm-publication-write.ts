import 'server-only';
import { APIError, type PayloadRequest } from 'payload';
import { publicReceiptSchema, type PublicReceipt } from './publication-receipt.schema';
import { retryPublicationUpdate } from './publication-updates';
export async function confirmPublicationWrite(
  document: { latestPublicationIntent?: string | null; editorialRevision?: string | null },
  req: PayloadRequest,
): Promise<PublicReceipt> {
  const pending = publicReceiptSchema.parse({
    operationId: document.latestPublicationIntent,
    targetRevision: document.editorialRevision,
    state: 'update-pending',
  });
  // The caller still owns this native transaction. Its intent cannot be read
  // independently until the caller commits it; never promote uncommitted data.
  if (req.transactionID) return pending;
  const result = await retryPublicationUpdate(pending.operationId, req);
  if (!result.ok)
    throw new APIError(
      'Não foi possível confirmar a gravação. Recarregue o documento.',
      503,
      undefined,
      true,
    );
  return result.value;
}
