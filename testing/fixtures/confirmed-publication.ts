import type { PayloadRequest } from 'payload';
import { retryPublicationUpdate } from '../../src/helpers/payload/publication-updates';

/** Explicit test setup after a Local API operation has committed its own transaction. */
export async function confirmTestPublication(
  saved: { latestPublicationIntent?: string | null; editorialRevision?: string | null },
  req: PayloadRequest,
) {
  if (await req.transactionID)
    throw new Error('Confirm test publication only after its transaction commits.');
  if (!saved.latestPublicationIntent || !saved.editorialRevision)
    throw new Error('Expected a committed native publication intent.');
  const result = await retryPublicationUpdate(saved.latestPublicationIntent, req);
  if (
    !result.ok ||
    result.value.state !== 'public' ||
    result.value.targetRevision !== saved.editorialRevision
  )
    throw new Error('Expected the committed test publication to become public.');
  return result.value;
}
