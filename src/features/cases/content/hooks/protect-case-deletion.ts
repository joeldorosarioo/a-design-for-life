import 'server-only';
import { APIError, type CollectionBeforeDeleteHook } from 'payload';
export const protectCaseDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const content = await req.payload.find({
    collection: 'case-content',
    where: { case: { equals: id } },
    draft: true,
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  });
  const versions = await req.payload.findVersions({
    collection: 'case-content',
    where: { 'version.case': { equals: id } },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  });
  const routes = await req.payload.find({
    collection: 'case-routes',
    where: { case: { equals: id } },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  });
  if (content.totalDocs || versions.totalDocs || routes.totalDocs)
    throw new APIError(
      'A identidade do case possui traduções, histórico ou rotas e não pode ser excluída.',
      409,
    );
  // A concurrent reference may still appear after these reads. Native RESTRICT FKs
  // are the atomic guarantee; this hook only supplies an editorial error early.
};
