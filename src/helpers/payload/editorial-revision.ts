import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  APIError,
  Forbidden,
  type Where,
  type CollectionConfig,
  type CollectionSlug,
  type PayloadRequest,
  type AfterErrorHook,
  restoreVersionOperation,
} from 'payload';
export const EDITORIAL_LEASE_SECONDS = 300;
export const EDITORIAL_RENDER_REVISION = '__editorialRevisionAtOpen';
export class EditorialConflict extends APIError {
  constructor(
    public readonly code: 'stale-revision' | 'locked' | 'unsupported-bulk',
    message: string,
  ) {
    super(message, 409, undefined, true);
  }
}
export const editorialError: AfterErrorHook = ({ error }) => {
  if (error instanceof EditorialConflict)
    return {
      status: 409,
      response: {
        errors: [{ code: error.code, message: error.message, path: 'editorialRevision' }],
      },
    };
};
export function isEditorialCollection(req: PayloadRequest, slug: string): slug is CollectionSlug {
  return (
    req.payload.collections[slug as CollectionSlug]?.config.custom?.editorialProtection === true
  );
}
async function transaction<T>(req: PayloadRequest, operation: () => Promise<T>): Promise<T> {
  const owns = !req.transactionID;
  if (owns) {
    const started = await req.payload.db.beginTransaction();
    if (!started) throw new APIError('Editorial transactions are required.', 503);
    req.transactionID = started;
  }
  try {
    const result = await operation();
    if (owns && req.transactionID) await req.payload.db.commitTransaction(req.transactionID);
    return result;
  } catch (error) {
    if (owns && req.transactionID) await req.payload.db.rollbackTransaction(req.transactionID);
    throw error;
  } finally {
    if (owns) delete req.transactionID;
  }
}
export async function editorialHead(collection: CollectionSlug, id: string, req: PayloadRequest) {
  if (!req.user) throw new Forbidden(req.t);
  if (!isEditorialCollection(req, collection)) throw new APIError('Unsupported document.', 400);
  const head = await req.payload.db.findOne({ collection, where: { id: { equals: id } }, req });
  if (!head) throw new APIError('Document unavailable.', 404);
  return head as {
    id: string;
    editorialRevision: string;
    leaseOwner?: string | null;
    leaseToken?: string | null;
    leaseExpiresAt?: string | null;
    _status?: string;
  };
}
function nativeLockWhere(collection: CollectionSlug, id: string): Where {
  return {
    and: [{ 'document.relationTo': { equals: collection } }, { 'document.value': { equals: id } }],
  };
}
async function syncNativeLock(collection: CollectionSlug, id: string, req: PayloadRequest) {
  if (!req.user) return;
  const head = await editorialHead(collection, id, req);
  if (
    head.leaseOwner !== String(req.user!.id) ||
    !head.leaseExpiresAt ||
    new Date(head.leaseExpiresAt) <= new Date()
  )
    return;
  await req.payload.db.deleteMany({
    collection: 'payload-locked-documents',
    where: nativeLockWhere(collection, id),
    req,
  });
  await req.payload.db.create({
    collection: 'payload-locked-documents',
    req,
    data: {
      document: { relationTo: collection, value: id },
      user: { relationTo: req.user!.collection, value: req.user!.id },
    },
  });
}
export async function acquireEditorialLease(
  collection: CollectionSlug,
  id: string,
  req: PayloadRequest,
  rotate = false,
) {
  return transaction(req, async () => {
    const head = await editorialHead(collection, id, req);
    const now = new Date();
    if (
      head.leaseOwner === String(req.user!.id) &&
      head.leaseExpiresAt &&
      new Date(head.leaseExpiresAt) > now
    ) {
      const currentToken = rotate ? randomUUID() : head.leaseToken!;
      const renewed = await req.payload.db.updateOne({
        collection,
        req,
        options: { atomic: true },
        where: {
          and: [
            { id: { equals: id } },
            { leaseOwner: { equals: String(req.user!.id) } },
            { leaseToken: { equals: head.leaseToken } },
            { leaseExpiresAt: { greater_than: now.toISOString() } },
          ],
        },
        data: {
          leaseToken: currentToken,
          leaseExpiresAt: new Date(now.getTime() + EDITORIAL_LEASE_SECONDS * 1000).toISOString(),
        },
      });
      if (!renewed) return { editable: false, token: undefined, revision: head.editorialRevision };
      await syncNativeLock(collection, id, req);
      return { editable: true, token: currentToken, revision: head.editorialRevision };
    }
    const token = randomUUID();
    const claimed = await req.payload.db.updateOne({
      collection,
      req,
      options: { atomic: true },
      where: {
        and: [
          { id: { equals: id } },
          {
            or: [
              { leaseExpiresAt: { exists: false } },
              { leaseExpiresAt: { less_than_equal: now.toISOString() } },
            ],
          },
        ],
      },
      data: {
        leaseOwner: String(req.user!.id),
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + EDITORIAL_LEASE_SECONDS * 1000).toISOString(),
      },
    });
    if (!claimed) return { editable: false, token: undefined, revision: head.editorialRevision };
    await syncNativeLock(collection, id, req);
    return { editable: true, token, revision: head.editorialRevision };
  });
}
export async function renewEditorialLease(
  collection: CollectionSlug,
  id: string,
  token: string,
  req: PayloadRequest,
) {
  return transaction(req, async () => {
    await editorialHead(collection, id, req);
    const now = new Date();
    const claimed = await req.payload.db.updateOne({
      collection,
      req,
      options: { atomic: true },
      where: {
        and: [
          { id: { equals: id } },
          { leaseOwner: { equals: String(req.user!.id) } },
          { leaseToken: { equals: token } },
          { leaseExpiresAt: { greater_than: now.toISOString() } },
        ],
      },
      data: {
        leaseExpiresAt: new Date(now.getTime() + EDITORIAL_LEASE_SECONDS * 1000).toISOString(),
      },
    });
    if (!claimed)
      throw new EditorialConflict('locked', 'Editing lease expired or belongs to another editor.');
    await syncNativeLock(collection, id, req);
  });
}
export async function releaseEditorialLease(
  collection: CollectionSlug,
  id: string,
  token: string,
  req: PayloadRequest,
) {
  return transaction(req, async () => {
    try {
      await editorialHead(collection, id, req);
    } catch (error) {
      if (error instanceof APIError && error.status === 404) return false;
      throw error;
    }
    const claimed = await req.payload.db.updateOne({
      collection,
      req,
      options: { atomic: true },
      where: {
        and: [
          { id: { equals: id } },
          { leaseOwner: { equals: String(req.user!.id) } },
          { leaseToken: { equals: token } },
        ],
      },
      data: { leaseOwner: null, leaseToken: null, leaseExpiresAt: null },
    });
    if (claimed)
      await req.payload.db.deleteMany({
        collection: 'payload-locked-documents',
        where: nativeLockWhere(collection, id),
        req,
      });
    return Boolean(claimed);
  });
}
async function claimRevision(
  collection: CollectionSlug,
  id: string,
  expected: unknown,
  token: unknown,
  req: PayloadRequest,
) {
  if (!req.transactionID)
    throw new APIError('Editorial writes require an active transaction.', 400);
  const head = await editorialHead(collection, id, req);
  if (typeof expected !== 'string' || head.editorialRevision !== expected)
    throw new EditorialConflict(
      'stale-revision',
      'This document changed. Refresh before saving your changes.',
    );
  if (
    typeof token !== 'string' ||
    head.leaseToken !== token ||
    head.leaseOwner !== String(req.user!.id) ||
    !head.leaseExpiresAt ||
    new Date(head.leaseExpiresAt) <= new Date()
  )
    throw new EditorialConflict('locked', 'Editing lease expired or belongs to another editor.');
  const revision = randomUUID();
  const claimed = await req.payload.db.updateOne({
    collection,
    req,
    options: { atomic: true },
    where: {
      and: [
        { id: { equals: id } },
        { editorialRevision: { equals: expected } },
        { leaseOwner: { equals: String(req.user!.id) } },
        { leaseToken: { equals: token } },
        { leaseExpiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
    data: { editorialRevision: revision },
  });
  if (!claimed)
    throw new EditorialConflict(
      'stale-revision',
      'This document changed. Refresh before saving your changes.',
    );
  return { revision, head };
}
const restoreScope = Symbol('safe-editorial-restore');
const writeScope = Symbol('observed-editorial-write');
const draftScope = Symbol('native-draft-operation');
export function isDraftOperation(req: PayloadRequest) {
  return req.context[draftScope as unknown as string] === true;
}
export async function restoreEditorialDraft(
  collection: CollectionSlug,
  input: { contentId: string; versionId: string; expectedRevision: string },
  req: PayloadRequest,
) {
  if (!req.user) throw new Forbidden(req.t);
  if (!input.expectedRevision)
    throw new APIError('An observed revision is required to restore a draft.', 400);
  return transaction(req, async () => {
    const version = await req.payload.findVersionByID({
      collection,
      id: input.versionId,
      overrideAccess: false,
      depth: 0,
      req,
    });
    const parent =
      typeof version.parent === 'object'
        ? (version.parent as { id?: string } | null)?.id
        : version.parent;
    if (parent !== input.contentId)
      throw new APIError('Version does not belong to this document.', 400);
    const previous = req.context[restoreScope as unknown as string];
    const previousRestoring = req.context.isRestoringVersion;
    req.context[restoreScope as unknown as string] = input.expectedRevision;
    try {
      const doc = await restoreVersionOperation({
        collection: req.payload.collections[collection],
        id: input.versionId,
        draft: true,
        overrideAccess: false,
        req,
        depth: 0,
      });
      return { revision: doc.editorialRevision as string };
    } finally {
      if (previousRestoring === undefined) delete req.context.isRestoringVersion;
      else req.context.isRestoringVersion = previousRestoring;
      if (previous === undefined) delete req.context[restoreScope as unknown as string];
      else req.context[restoreScope as unknown as string] = previous;
    }
  });
}
export function protectEditorialCollection(config: CollectionConfig): CollectionConfig {
  const slug = config.slug as CollectionSlug;
  const hooks = config.hooks ?? {};
  const access = config.access ?? {};
  const existingUpdate = access.update;
  return {
    ...config,
    forceSelect: { ...config.forceSelect, contentRevision: true },
    custom: { ...config.custom, editorialProtection: true },
    lockDocuments: { duration: EDITORIAL_LEASE_SECONDS },
    admin: {
      ...config.admin,
      components: {
        ...config.admin?.components,
        edit: {
          ...config.admin?.components?.edit,
          editMenuItems: [
            ...(config.admin?.components?.edit?.editMenuItems ?? []),
            '/helpers/payload/editorial-actions#EditorialDeleteAction',
          ],
        },
        views: {
          ...config.admin?.components?.views,
          edit: {
            version: {
              actions: ['/helpers/payload/editorial-version-action#EditorialVersionAction'],
            },
          },
        },
      },
    },
    disableBulkDelete: true,
    disableBulkEdit: true,
    access: {
      ...access,
      update: async (args) => {
        if (!args.req.user) return false;
        if (args.id) {
          const head = await editorialHead(slug, String(args.id), args.req);
          if (
            head.leaseExpiresAt &&
            new Date(head.leaseExpiresAt) > new Date() &&
            head.leaseOwner !== String(args.req.user.id)
          )
            return false;
        }
        return existingUpdate ? existingUpdate(args) : true;
      },
    },
    fields: [
      ...config.fields,
      {
        name: 'editorialRevision',
        type: 'text',
        admin: {
          components: { Field: '/helpers/payload/editorial-fields#EditorialRevisionField' },
        },
      },
      { name: 'contentRevision', type: 'text', admin: { hidden: true } },
      {
        name: 'leaseToken',
        type: 'text',
        admin: { components: { Field: '/helpers/payload/editorial-fields#EditorialLeaseField' } },
      },
      { name: 'leaseOwner', type: 'text', admin: { hidden: true }, access: { read: () => false } },
      {
        name: 'leaseExpiresAt',
        type: 'date',
        admin: { hidden: true },
        access: { read: () => false },
      },
    ],
    endpoints: [
      ...(config.endpoints || []),
      {
        path: '/:id/editorial-lease',
        method: 'post',
        handler: async (req) => {
          const id = String(req.routeParams?.id);
          const data = await req.json!();
          if (data.action === 'release')
            return Response.json({
              released: await releaseEditorialLease(slug, id, data.token, req),
            });
          if (data.action === 'renew') {
            await renewEditorialLease(slug, id, data.token, req);
            return Response.json({ ok: true });
          }
          return Response.json(await acquireEditorialLease(slug, id, req));
        },
      },
      {
        path: '/versions/:id',
        method: 'post',
        handler: async (req) => {
          const versionId = String(req.routeParams?.id);
          const version = await req.payload.findVersionByID({
            collection: slug,
            id: versionId,
            req,
            overrideAccess: false,
            depth: 0,
          });
          const contentId = String(
            typeof version.parent === 'object'
              ? (version.parent as { id?: string } | null)?.id
              : version.parent,
          );
          const result = await restoreEditorialDraft(
            slug,
            {
              contentId,
              versionId,
              expectedRevision: req.headers.get('x-editorial-revision') ?? '',
            },
            req,
          );
          return Response.json({ ...result, message: 'Version restored as a draft.' });
        },
      },
    ],
    hooks: {
      ...hooks,
      beforeOperation: [
        ...(hooks.beforeOperation ?? []),
        async ({ args, operation, req }) => {
          if ((operation === 'update' || operation === 'delete') && !('id' in args && args.id))
            throw new EditorialConflict('unsupported-bulk', 'Edit one document at a time.');
          if (
            (operation === 'update' || operation === 'delete') &&
            'id' in args &&
            args.id &&
            req.user
          ) {
            const head = await editorialHead(slug, String(args.id), req);
            if (
              head.leaseExpiresAt &&
              new Date(head.leaseExpiresAt) > new Date() &&
              head.leaseOwner !== String(req.user.id)
            )
              throw new EditorialConflict(
                'locked',
                'This document is being edited by another person. Open it read-only or refresh after the lease is released.',
              );
          }
          if (['create', 'update', 'restoreVersion'].includes(operation))
            req.context[draftScope as unknown as string] = 'draft' in args && args.draft === true;
          if (operation === 'update' && 'data' in args) {
            req.context[writeScope as unknown as string] = {
              expected: args.data?.editorialRevision,
              token: args.data?.leaseToken,
            };
          }
          if (operation === 'restoreVersion' && (!('draft' in args) || args.draft !== true))
            throw new APIError('Version recovery must create a draft.', 400);
          return args;
        },
      ],
      beforeChange: [
        async ({ data, originalDoc, operation, req }) => {
          if (!req.transactionID)
            throw new APIError('Editorial writes require an active transaction.', 400);
          if (operation === 'create') {
            if (
              !req.user &&
              !(
                config.custom?.editorialBootstrap === true &&
                req.context.trustedStructuralProvisioning === true
              )
            )
              throw new Forbidden(req.t);
            data.editorialRevision = randomUUID();
            data.contentRevision = data.editorialRevision;
            data.leaseToken = req.user ? randomUUID() : null;
            data.leaseOwner = req.user ? String(req.user.id) : null;
            data.leaseExpiresAt = req.user
              ? new Date(Date.now() + EDITORIAL_LEASE_SECONDS * 1000).toISOString()
              : null;
          } else {
            const restoring = req.context[restoreScope as unknown as string];
            if (req.context.isRestoringVersion && !restoring)
              throw new APIError('Use protected draft recovery.', 400);
            const observed = req.context[writeScope as unknown as string] as
              { expected?: unknown; token?: unknown } | undefined;
            const expected =
              restoring ?? observed?.expected ?? req.headers.get('x-editorial-revision');
            const token = req.headers.get('x-editorial-lease') ?? observed?.token;
            const { revision, head } = await claimRevision(
              slug,
              String(originalDoc.id),
              expected,
              token,
              req,
            );
            data.editorialRevision = revision;
            data.contentRevision = revision;
            data.leaseToken = head.leaseToken;
            data.leaseOwner = head.leaseOwner;
            data.leaseExpiresAt = head.leaseExpiresAt;
            if (restoring) data._status = 'draft';
          }
          return data;
        },
        ...(hooks.beforeChange ?? []),
      ],
      beforeDelete: [
        ...(hooks.beforeDelete ?? []),
        async ({ id, req }) => {
          await claimRevision(
            slug,
            String(id),
            req.headers.get('x-editorial-revision'),
            req.headers.get('x-editorial-lease'),
            req,
          );
        },
      ],
      afterChange: [
        ...(hooks.afterChange ?? []),
        async ({ doc, req }) => {
          await syncNativeLock(slug, String(doc.id), req);
          return doc;
        },
      ],
      afterRead: [
        ...(hooks.afterRead ?? []),
        async ({ doc, req }) => {
          const selectedRevision = doc.contentRevision;
          delete doc.contentRevision;
          if (!doc.id) {
            delete doc.editorialRevision;
            delete doc.leaseToken;
            delete doc.leaseOwner;
            delete doc.leaseExpiresAt;
            return doc;
          }
          if (!req.user) {
            delete doc.editorialRevision;
            delete doc.leaseToken;
            delete doc.leaseOwner;
            delete doc.leaseExpiresAt;
            return doc;
          }
          const head = (await req.payload.db.findOne({
            collection: slug,
            where: { id: { equals: doc.id } },
            req,
          })) as Awaited<ReturnType<typeof editorialHead>> | null;
          if (!head) {
            delete doc.leaseToken;
            delete doc.leaseOwner;
            delete doc.leaseExpiresAt;
            return doc;
          }
          doc.editorialRevision = selectedRevision;
          doc.leaseToken = head.leaseOwner === String(req.user.id) ? head.leaseToken : null;
          delete doc.leaseOwner;
          delete doc.leaseExpiresAt;
          return doc;
        },
      ],
    },
  };
}
