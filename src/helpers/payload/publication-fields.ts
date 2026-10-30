import { requireLegacyBootstrap } from './require-legacy-bootstrap';
import { publicationEndpoints } from './publication-transport';
import 'server-only';
import type { CollectionConfig, Access, CollectionSlug, PayloadRequest } from 'payload';
import { isDraftOperation } from './editorial-revision';
import {
  enqueuePublicationUpdate,
  type PublicationAdapter,
  type PublicationSubject,
} from './publication-updates';
export function publicationFields(
  collection: CollectionConfig,
  adapter: PublicationAdapter,
): CollectionConfig {
  const privateWrites = new WeakMap<PayloadRequest, boolean>();
  const read = collection.access?.read;
  const guardedRead: Access = async (args) => {
    const allowed = read ? await read(args) : true;
    if (
      args.req.user ||
      allowed === false ||
      (allowed === true && args.req.context.trustedStructuralProvisioning === true)
    )
      return allowed;
    return { and: [...(allowed === true ? [] : [allowed]), { publicConfirmed: { equals: true } }] };
  };
  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        edit: {
          ...collection.admin?.components?.edit,
          beforeDocumentControls: [
            ...(collection.admin?.components?.edit?.beforeDocumentControls ?? []),
            '/helpers/payload/publication-status#PublicationStatus',
          ],
        },
      },
    },
    endpoints: [
      ...(collection.endpoints || []),
      ...publicationEndpoints(collection.slug as CollectionSlug),
    ],
    access: { ...collection.access, read: guardedRead },
    fields: [
      ...collection.fields,
      {
        name: 'latestPublicationIntent',
        type: 'text',
        index: true,
        admin: { hidden: true },
        access: { create: () => false, update: () => false, read: ({ req }) => Boolean(req.user) },
      },
      {
        name: 'publicConfirmed',
        type: 'checkbox',
        defaultValue: false,
        admin: { hidden: true },
        access: { create: () => false, update: () => false, read: ({ req }) => Boolean(req.user) },
      },
    ],
    hooks: {
      ...collection.hooks,
      beforeOperation: [
        requireLegacyBootstrap,
        ({ args, operation, req, overrideAccess }) => {
          // Anonymous reads must filter the current head, never a historical
          // version marker (including versions persisted before this guard).
          if (
            operation === 'read' &&
            !req.user &&
            !overrideAccess &&
            req.context.trustedStructuralProvisioning !== true &&
            'draft' in args
          )
            args.draft = false;
          // Native forms return hidden projection metadata. It is never editorial
          // input and must not reach the strict feature schema or authoritative head.
          if ((operation === 'create' || operation === 'update') && 'data' in args && args.data) {
            delete args.data.latestPublicationIntent;
            delete args.data.publicConfirmed;
          }
          return args;
        },
        ...(collection.hooks?.beforeOperation ?? []),
      ],
      beforeChange: [
        ...(collection.hooks?.beforeChange ?? []),
        async ({ data, originalDoc, req }) => {
          // Native versions precede afterChange; their technical fields can lag the head.
          // Always preserve server-owned intent from the actual locked head, never a version.
          privateWrites.set(
            req,
            (isDraftOperation(req) && data._status !== 'published') ||
              req.context.isRestoringVersion === true ||
              adapter.shouldPublish?.({ ...originalDoc, ...data }, originalDoc) === false,
          );
          const head = originalDoc?.id
            ? ((await req.payload.db.findOne({
                collection: collection.slug as CollectionSlug,
                where: { id: { equals: originalDoc.id } },
                req,
              })) as Record<string, unknown> | null)
            : null;
          data.latestPublicationIntent = head?.latestPublicationIntent ?? null;
          // A new publication is not confirmed yet, including the Native version
          // saved before afterChange enqueues its intent. Private writes retain
          // the canonical head grant; their draft versions remain access-filtered.
          data.publicConfirmed = privateWrites.get(req) ? (head?.publicConfirmed ?? false) : false;
          return data;
        },
      ],
      afterChange: [
        ...(collection.hooks?.afterChange ?? []),
        async ({ doc, data, req }) => {
          const privateWrite = privateWrites.get(req);
          privateWrites.delete(req);
          if (!req.user || privateWrite || req.context.isRestoringVersion) return doc;
          const head = (await req.payload.db.findOne({
            collection: collection.slug as CollectionSlug,
            where: { id: { equals: doc.id } },
            req,
          })) as Record<string, unknown> | null;
          const published =
            head?._status === 'published' && head?.contentRevision === data.contentRevision;
          const shared = adapter.shared === true;
          if (!shared && !published && (isDraftOperation(req) || !head?.latestPublicationIntent))
            return doc;
          const prepared = await adapter.prepare(doc, published || shared, req);
          const receipt = await enqueuePublicationUpdate(
            {
              subject: {
                collection: collection.slug as PublicationSubject['collection'],
                id: String(doc.id),
              },
              targetRevision: String(data.contentRevision ?? doc.editorialRevision),
              dependencies: prepared.dependencies,
              target: prepared.value,
            },
            req,
          );
          doc.latestPublicationIntent = receipt.operationId;
          doc.publicConfirmed = false;
          return doc;
        },
      ],
    },
  };
}
