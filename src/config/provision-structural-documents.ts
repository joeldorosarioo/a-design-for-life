import 'server-only';
import { createLocalReq, ValidationError, type PayloadRequest } from 'payload';
import { ensureNavigationDrafts } from '@/features/site-navigation/server';
import { ensureProfileDrafts } from '@/features/professional-profile/server';

function isStructuralLocaleConflict(error: unknown, req: PayloadRequest): boolean {
  if (!(error instanceof ValidationError)) return false;
  const collection = error.data?.collection;
  const table =
    collection === 'site-navigation'
      ? 'site_navigation'
      : collection === 'professional-profiles'
        ? 'profiles'
        : undefined;
  return Boolean(
    table &&
    error.data?.errors.some(
      (field) =>
        field.path === 'locale' &&
        field.tableName === table &&
        field.message === req.t('error:valueMustBeUnique'),
    ),
  );
}

async function ensureBoth(req: PayloadRequest): Promise<void> {
  await ensureNavigationDrafts(req);
  await ensureProfileDrafts(req);
}

export async function provisionStructuralDocuments(req: PayloadRequest): Promise<void> {
  // An outer transaction belongs to its caller; this composition never commits it.
  if (req.transactionID) return ensureBoth(req);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const unit = await createLocalReq(
      { user: req.user ?? undefined, context: { ...req.context } },
      req.payload,
    );
    const transactionID = await req.payload.db.beginTransaction();
    if (!transactionID) throw new Error('Provisionamento exige transação PostgreSQL');
    unit.transactionID = transactionID;
    try {
      await ensureBoth(unit);
      await req.payload.db.commitTransaction(transactionID);
      delete unit.transactionID;
      return;
    } catch (error) {
      await req.payload.db.rollbackTransaction(transactionID);
      delete unit.transactionID;
      if (!isStructuralLocaleConflict(error, unit) || attempt === 3) throw error;
      // The failed unit is discarded. A fresh request/transaction re-reads the winner.
    }
  }
}
