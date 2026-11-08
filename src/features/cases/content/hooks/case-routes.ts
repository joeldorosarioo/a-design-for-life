import 'server-only';
import {
  APIError,
  Forbidden,
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload';
import { slugSchema } from '../../contracts/slug.schema';
import { SlugConflict } from '../../server/case-result';

// An in-process capability is never constructed from REST data or caller context strings.
// Only the content lifecycle below opens this capability, after the editorial CAS.
const mutations = new WeakMap<PayloadRequest, Owner>();
type Owner = { caseId: string; contentId: string; locale: 'pt' | 'en' };
const idOf = (value: unknown) =>
  typeof value === 'object' && value !== null
    ? String((value as { id: string }).id)
    : String(value);
function owner(req: PayloadRequest): Owner {
  const scope = mutations.get(req);
  if (!req.user || !req.transactionID || !scope) throw new Forbidden(req.t);
  return scope;
}
export const protectRouteOperation: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (['create', 'update', 'delete'].includes(operation)) owner(req);
  return args;
};
export const protectRouteChange: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const scope = owner(req);
  const next = { ...originalDoc, ...data };
  if (
    idOf(next.case) !== scope.caseId ||
    idOf(next.content) !== scope.contentId ||
    next.locale !== scope.locale ||
    !slugSchema.safeParse(next.slug).success ||
    (originalDoc?.id &&
      (originalDoc.slug !== next.slug ||
        idOf(originalDoc.case) !== scope.caseId ||
        idOf(originalDoc.content) !== scope.contentId ||
        originalDoc.locale !== scope.locale ||
        (originalDoc.everPublished && !next.everPublished)))
  )
    throw new Forbidden(req.t);
  return data;
};
export const protectRouteDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const scope = owner(req);
  const route = await req.payload.findByID({
    collection: 'case-routes',
    id,
    req,
    overrideAccess: true,
    depth: 0,
  });
  if (
    route.everPublished ||
    (await pendingRouteSlugs(scope.contentId, req)).has(route.slug) ||
    idOf(route.case) !== scope.caseId ||
    idOf(route.content) !== scope.contentId ||
    route.locale !== scope.locale
  )
    throw new Forbidden(req.t);
};
async function scoped<T>(
  scope: Owner,
  req: PayloadRequest,
  operation: () => Promise<T>,
): Promise<T> {
  if (!req.transactionID || !req.user)
    throw new APIError('Route changes require the editorial transaction.', 400);
  const previous = mutations.get(req);
  mutations.set(req, scope);
  try {
    return await operation();
  } finally {
    if (previous === undefined) mutations.delete(req);
    else mutations.set(req, previous);
  }
}
async function contentRoutes(contentId: string, req: PayloadRequest) {
  return (
    await req.payload.find({
      collection: 'case-routes',
      where: { content: { equals: contentId } },
      pagination: false,
      limit: 0,
      depth: 0,
      req,
      overrideAccess: true,
    })
  ).docs;
}
function uniqueSlug(error: unknown, req: PayloadRequest) {
  return (
    error instanceof ValidationError &&
    error.data?.collection === 'case-routes' &&
    error.data.errors.some(
      (field) =>
        field.tableName === 'case_routes' &&
        field.path === 'locale, slug' &&
        field.message === req.t('error:valueMustBeUnique'),
    )
  );
}
export const synchronizeCaseRoutes: CollectionAfterChangeHook = async ({ doc, req }) => {
  const scope: Owner = { caseId: idOf(doc.case), contentId: String(doc.id), locale: doc.locale };
  await scoped(scope, req, async () => {
    const own = await contentRoutes(scope.contentId, req);
    const selected = doc.slug as string | null | undefined;
    if (selected) {
      const existing = (
        await req.payload.find({
          collection: 'case-routes',
          where: { and: [{ locale: { equals: scope.locale } }, { slug: { equals: selected } }] },
          depth: 0,
          limit: 1,
          req,
          overrideAccess: true,
        })
      ).docs[0];
      if (
        existing &&
        (idOf(existing.case) !== scope.caseId || idOf(existing.content) !== scope.contentId)
      )
        throw new SlugConflict();
      if (!existing) {
        try {
          await req.payload.create({
            collection: 'case-routes',
            data: {
              locale: scope.locale,
              slug: selected,
              case: scope.caseId,
              content: scope.contentId,
              everPublished: false,
              state: 'draft',
            },
            req,
            overrideAccess: true,
            depth: 0,
          });
        } catch (error) {
          if (uniqueSlug(error, req)) throw new SlugConflict();
          throw error;
        }
      }
    }
    for (const route of own) {
      if (route.slug === selected) continue;
      if (!route.everPublished && !(await pendingRouteSlugs(scope.contentId, req)).has(route.slug))
        await req.payload.delete({
          collection: 'case-routes',
          id: route.id,
          req,
          overrideAccess: true,
          depth: 0,
        });
    }
  });
  return doc;
};
export const protectContentRouteDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const routes = await contentRoutes(String(id), req);
  if (
    routes.some((route) => route.everPublished) ||
    (await pendingRouteSlugs(String(id), req)).size > 0
  )
    throw new APIError(
      'Este conteúdo possui endereços que já foram públicos. Retire a publicação para preservar o histórico.',
      409,
      undefined,
      true,
    );
  const doc = await req.payload.findByID({
    collection: 'case-content',
    id,
    draft: true,
    depth: 0,
    req,
    overrideAccess: true,
  });
  await scoped(
    { caseId: idOf(doc.case), contentId: String(id), locale: doc.locale },
    req,
    async () => {
      for (const route of routes)
        await req.payload.delete({
          collection: 'case-routes',
          id: route.id,
          req,
          overrideAccess: true,
          depth: 0,
        });
    },
  );
};

async function pendingRouteSlugs(contentId: string, req: PayloadRequest) {
  const operations = await req.payload.find({
    collection: 'publication-updates',
    where: {
      and: [
        { subjectCollection: { equals: 'case-content' } },
        { subjectId: { equals: contentId } },
        { state: { equals: 'update-pending' } },
      ],
    },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return new Set(
    operations.docs.flatMap((operation) => {
      const target = operation.target as { slug?: unknown };
      return typeof target.slug === 'string' ? [target.slug] : [];
    }),
  );
}
export async function acknowledgeCaseRoutes(
  snapshot: { contentId: string; slug: string | null; slugs: string[] },
  req: PayloadRequest,
) {
  const routes = await contentRoutes(snapshot.contentId, req);
  const draft = await req.payload.findByID({
    collection: 'case-content',
    id: snapshot.contentId,
    draft: true,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const pinned = await pendingRouteSlugs(snapshot.contentId, req);
  for (const route of routes) {
    if (snapshot.slugs.includes(route.slug)) {
      await req.payload.db.updateOne({
        collection: 'case-routes',
        req,
        options: { atomic: true },
        where: { id: { equals: route.id } },
        data: {
          everPublished: true,
          state: route.slug === snapshot.slug ? 'current' : 'historical',
        },
      });
    } else if (!route.everPublished && route.slug !== draft.slug && !pinned.has(route.slug)) {
      await req.payload.db.deleteOne({
        collection: 'case-routes',
        req,
        where: { id: { equals: route.id } },
      });
    }
  }
}
