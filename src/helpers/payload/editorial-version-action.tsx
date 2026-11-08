import 'server-only';
import type { PayloadRequest } from 'payload';
import { EditorialRestoreAction } from './editorial-actions';
import {
  editorialHead,
  isEditorialCollection,
  EDITORIAL_RENDER_REVISION,
} from './editorial-revision';
export async function EditorialVersionAction({
  collectionSlug,
  docID,
  req,
  params,
  searchParams,
}: {
  collectionSlug: string;
  docID: string;
  req: PayloadRequest;
  params: { segments: string[] };
  searchParams: Record<string, string | string[]>;
}) {
  if (!req.user || !isEditorialCollection(req, collectionSlug)) return null;
  const revision = searchParams?.[EDITORIAL_RENDER_REVISION];
  if (typeof revision !== 'string') return null;
  const head = await editorialHead(collectionSlug, String(docID), req);
  const editable =
    head.leaseOwner === String(req.user.id) &&
    Boolean(head.leaseExpiresAt && new Date(head.leaseExpiresAt) > new Date());
  return (
    <EditorialRestoreAction
      key={`${collectionSlug}:${docID}:${params.segments.at(-1)}:${revision}`}
      collection={collectionSlug}
      id={String(docID)}
      version={params.segments.at(-1)!}
      revision={revision}
      token={editable ? head.leaseToken! : ''}
      editable={editable}
    />
  );
}
