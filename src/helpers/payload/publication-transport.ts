import type { PublicationUpdate } from '@/payload-types';
import 'server-only';
import { createLocalReq, type CollectionSlug, type Endpoint, type PayloadRequest } from 'payload';
import { retryPublicationUpdate } from './publication-updates';
import { runtimePayload } from './runtime';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
async function currentOperation(collection: CollectionSlug, id: string, req: PayloadRequest) {
  if (!req.user || req.user.collection !== 'users') return null;
  await req.payload.findByID({ collection, id, overrideAccess: false, req, depth: 0 });
  const head = (await req.payload.db.findOne({
    collection,
    where: { id: { equals: id } },
    req,
  })) as { latestPublicationIntent?: string } | null;
  if (!head?.latestPublicationIntent) return null;
  return (await req.payload.db.findOne({
    collection: 'publication-updates',
    where: { operationId: { equals: head.latestPublicationIntent } },
    req,
  })) as PublicationUpdate | null;
}
export function publicationEndpoints(collection: CollectionSlug): Endpoint[] {
  return [
    {
      path: '/:id/publication-status',
      method: 'get',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
        const operation = await currentOperation(collection, String(req.routeParams?.id), req);
        return Response.json(
          {
            receipt: operation
              ? {
                  operationId: operation.operationId,
                  targetRevision: operation.targetRevision,
                  state: operation.state,
                }
              : null,
          },
          { headers },
        );
      },
    },
    {
      path: '/:id/publication-retry',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
        const current = await currentOperation(collection, String(req.routeParams?.id), req);
        const body: unknown = await req.json?.();
        const operationId =
          body && typeof body === 'object' && 'operationId' in body ? body.operationId : null;
        if (!current || typeof operationId !== 'string')
          return Response.json({ error: 'Publication unavailable' }, { status: 400, headers });
        const selected = await req.payload.db.findOne({
          collection: 'publication-updates',
          where: {
            and: [
              { operationId: { equals: operationId } },
              { subjectId: { equals: String(req.routeParams?.id) } },
              { subjectCollection: { equals: collection } },
            ],
          },
          req,
        });
        if (!selected)
          return Response.json({ error: 'Publication unavailable' }, { status: 404, headers });
        const result = await retryPublicationUpdate(operationId, req);
        return Response.json(result, { status: result.ok ? 200 : 503, headers });
      },
    },
  ];
}
export async function confirmNativePublication(
  response: Response,
  request: Request,
): Promise<Response> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
    return response;
  const json = await response.clone().json();
  const document = json.doc;
  if (!document?.latestPublicationIntent || !document.editorialRevision) return response;
  const payload = await runtimePayload();
  const user = (await payload.auth({ headers: request.headers })).user;
  if (!user) return response;
  const req = await createLocalReq({ user, req: { headers: request.headers } }, payload);
  const operation = (await payload.db.findOne({
    collection: 'publication-updates',
    where: { operationId: { equals: document.latestPublicationIntent } },
    req,
  })) as PublicationUpdate | null;
  if (!operation)
    return Response.json(
      {
        errors: [
          {
            message:
              'Não foi possível confirmar a gravação. Recarregue o documento antes de tentar novamente.',
          },
        ],
      },
      { status: 503, headers },
    );
  if (operation.targetRevision !== document.editorialRevision) return response;
  const result = await retryPublicationUpdate(operation.operationId, req);
  const receipt = result.ok
    ? result.value
    : {
        operationId: operation.operationId,
        targetRevision: operation.targetRevision,
        state: 'update-pending',
      };
  const nextHeaders = new Headers(response.headers);
  nextHeaders.delete('Content-Length');
  nextHeaders.set('Cache-Control', 'private, no-store');
  return Response.json(
    {
      ...json,
      publicationReceipt: receipt,
      doc: { ...document, publicationReceipt: receipt },
      message:
        receipt.state === 'public'
          ? 'Conteúdo salvo e atualização pública confirmada.'
          : receipt.state === 'superseded'
            ? 'Esta tentativa foi substituída por uma publicação mais recente.'
            : 'Conteúdo salvo. Atualização pública pendente; tente novamente.',
    },
    { status: response.status, headers: nextHeaders },
  );
}
