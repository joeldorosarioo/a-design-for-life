import 'server-only';
import { APIError } from 'payload';
import { editorialResult } from '@/helpers/payload/editorial-result';
import type { EditorialFailure } from '@/helpers/payload/editorial-result.schema';
import type { CaseEditorialConflict } from '../contracts/editorial-conflict.schema';
export class SlugConflict extends APIError {
  readonly code = 'slug-conflict';
  constructor() {
    super(
      'Este endereço já pertence a outro case neste idioma. Escolha outro slug.',
      409,
      undefined,
      true,
    );
  }
}
export type CaseResult<T> =
  { ok: true; value: T } | { ok: false; error: EditorialFailure | CaseEditorialConflict };
export async function caseResult<T>(operation: () => Promise<T>): Promise<CaseResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof SlugConflict)
      return { ok: false, error: { code: 'slug-conflict', field: 'slug', message: error.message } };
    return editorialResult(() => Promise.reject(error));
  }
}
