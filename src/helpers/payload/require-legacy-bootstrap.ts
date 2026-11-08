import type { PublicationUpdate } from '@/payload-types';
import 'server-only';
import { APIError, type CollectionBeforeOperationHook } from 'payload';
export const requireLegacyBootstrap: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (!['create', 'update', 'delete', 'restoreVersion'].includes(operation)) return args;
  const pending = await req.payload.db.find({
    collection: 'publication-updates',
    where: { state: { equals: 'update-pending' } },
    pagination: false,
    limit: 0,
    req,
  });
  if (
    (pending.docs as PublicationUpdate[]).some(
      (document) =>
        Array.isArray(document.dependencies) && document.dependencies.includes('legacy-bootstrap'),
    )
  )
    throw new APIError(
      'A publicação anterior precisa concluir a migração antes de novas alterações editoriais.',
      503,
      undefined,
      true,
    );
  return args;
};
