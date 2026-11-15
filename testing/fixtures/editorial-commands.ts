import { APIError, Forbidden, ValidationError, type PayloadRequest } from 'payload';
import { z } from 'zod';
import type { PublicationRetry } from '../../src/payload-types';
import { slugSchema } from '../../src/features/cases/contracts/slug.schema';
import type { CaseEditorialConflict } from '../../src/features/cases/contracts/editorial-conflict.schema';
import { SlugConflict } from '../../src/features/cases/server/case-result';
import {
  EditorialConflict,
  restoreEditorialDraft,
} from '../../src/helpers/payload/editorial-revision';
import type { EditorialFailure, Result } from '../../src/helpers/payload/editorial-result.schema';
import {
  publicReceiptSchema,
  type PublicReceipt,
} from '../../src/helpers/payload/publication-receipt.schema';
import { retryPublicationUpdate } from '../../src/helpers/payload/publication-updates';
import type { PersistedPublicationRetry } from '../../src/helpers/payload/publication-retries';
import { validateInput } from '../../src/helpers/payload/validate-input';

const editorialCommandSchema = z.object({ contentId: z.uuid(), expectedRevision: z.uuid() });
const restoreCommandSchema = editorialCommandSchema.extend({ versionId: z.uuid() });
const publicationReceiptSchema = publicReceiptSchema.extend({
  contentId: z.uuid(),
  locale: z.enum(['pt', 'en']),
  revision: z.uuid(),
});
const reserveCaseRouteSchema = z.object({
  caseId: z.uuid(),
  contentId: z.uuid(),
  locale: z.enum(['pt', 'en']),
  slug: slugSchema,
});
type EditorialCommand = z.infer<typeof editorialCommandSchema>;
type RestoreCommand = z.infer<typeof restoreCommandSchema>;
type PublicationReceipt = z.infer<typeof publicationReceiptSchema>;
type CaseResult<T> =
  { ok: true; value: T } | { ok: false; error: EditorialFailure | CaseEditorialConflict };

/** Test drivers use Native operations; leases, validation and publication remain authoritative. */
async function editorialResult<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof EditorialConflict && error.code !== 'unsupported-bulk')
      return { ok: false, error: { code: error.code, message: error.message } };
    if (error instanceof ValidationError)
      return {
        ok: false,
        error: {
          code: 'invalid-input',
          message: error.message,
          fields: error.data.errors.map(({ path, message }) => ({ path, message })),
        },
      };
    if (error instanceof APIError)
      return {
        ok: false,
        error: {
          code:
            error.status === 403 || error.status === 401
              ? 'forbidden'
              : error.status === 400
                ? 'invalid-input'
                : 'unavailable',
          message: error.message,
        },
      };
    throw error;
  }
}
async function caseResult<T>(operation: () => Promise<T>): Promise<CaseResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof SlugConflict)
      return { ok: false, error: { code: 'slug-conflict', field: 'slug', message: error.message } };
    return editorialResult(() => Promise.reject(error));
  }
}
export async function confirmPublicationWrite(
  document: { latestPublicationIntent?: string | null; editorialRevision?: string | null },
  req: PayloadRequest,
): Promise<PublicReceipt> {
  const pending = publicReceiptSchema.parse({
    operationId: document.latestPublicationIntent,
    targetRevision: document.editorialRevision,
    state: 'update-pending',
  });
  // An externally owned Native transaction cannot be independently confirmed before COMMIT.
  if (req.transactionID) return pending;
  const result = await retryPublicationUpdate(pending.operationId, req, { mode: 'immediate' });
  if (!result.ok)
    throw new APIError(
      'Não foi possível confirmar a gravação. Recarregue o documento.',
      503,
      undefined,
      true,
    );
  return result.value;
}
async function publish(
  collection: 'case-content' | 'professional-profiles' | 'site-navigation',
  input: EditorialCommand,
  req: PayloadRequest,
): Promise<PublicationReceipt> {
  const command = validateInput(editorialCommandSchema, input, collection, req);
  const draft = await req.payload.findByID({
    collection,
    id: command.contentId,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req,
  });
  const saved = await req.payload.update({
    collection,
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
}
export async function publishCase(input: EditorialCommand, req: PayloadRequest) {
  return caseResult(() => publish('case-content', input, req));
}
export async function publishProfile(input: EditorialCommand, req: PayloadRequest) {
  return editorialResult(() => publish('professional-profiles', input, req));
}
export async function publishNavigation(input: EditorialCommand, req: PayloadRequest) {
  return editorialResult(() => publish('site-navigation', input, req));
}
export async function restoreCaseDraft(input: RestoreCommand, req: PayloadRequest) {
  return caseResult(() =>
    restoreEditorialDraft(
      'case-content',
      validateInput(restoreCommandSchema, input, 'case-content', req),
      req,
    ),
  );
}
export async function restoreProfileDraft(input: RestoreCommand, req: PayloadRequest) {
  return editorialResult(() =>
    restoreEditorialDraft(
      'professional-profiles',
      validateInput(restoreCommandSchema, input, 'professional-profiles', req),
      req,
    ),
  );
}
export async function reserveCaseRoute(
  input: z.infer<typeof reserveCaseRouteSchema>,
  req: PayloadRequest,
) {
  return caseResult(async () => {
    const command = validateInput(reserveCaseRouteSchema, input, 'case-content', req);
    const doc = await req.payload.findByID({
      collection: 'case-content',
      id: command.contentId,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    if (doc.case !== command.caseId || doc.locale !== command.locale)
      throw new APIError('A reserva deve pertencer ao documento e idioma selecionados.', 400);
    // Reading identity must not replace the caller's observed revision or lease.
    await req.payload.update({
      collection: 'case-content',
      id: command.contentId,
      data: {
        slug: command.slug,
        _status: 'draft',
        editorialRevision: req.headers.get('x-editorial-revision'),
        leaseToken: req.headers.get('x-editorial-lease'),
      },
      draft: true,
      overrideAccess: false,
      overrideLock: false,
      req,
      depth: 0,
    });
    return { slug: command.slug };
  });
}
export async function readPublicationRetry(
  operationId: string,
  req: PayloadRequest,
): Promise<PersistedPublicationRetry | null> {
  if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
  const row = await req.payload.db.findOne<PublicationRetry>({
    collection: 'publication-retries',
    where: { operationId: { equals: publicReceiptSchema.shape.operationId.parse(operationId) } },
    req,
  });
  return row
    ? {
        id: row.id,
        operationId: row.operationId,
        retryUserId: row.retryUserId ?? null,
        startedAttemptsVersion: row.startedAttemptsVersion,
        automaticAttempts: row.automaticAttempts,
        nextAttemptAt: row.nextAttemptAt ?? null,
      }
    : null;
}
