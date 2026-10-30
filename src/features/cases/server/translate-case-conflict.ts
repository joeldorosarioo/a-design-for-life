import 'server-only';

import { ValidationError, type AfterErrorHook, type PayloadRequest } from 'payload';

import type { CaseEditorialConflict } from '../contracts/editorial-conflict.schema';

export function translateCaseConflict(
  error: unknown,
  req: PayloadRequest,
): CaseEditorialConflict | undefined {
  if (!(error instanceof ValidationError) || error.data?.collection !== 'case-content') return;

  if (
    !error.data.errors.some(
      (field) =>
        field.tableName === 'case_content' &&
        field.path === 'case_id, locale' &&
        field.message === req.t('error:valueMustBeUnique'),
    )
  )
    return;

  return {
    code: 'translation-conflict',
    field: 'locale',
    message: 'Já existe um documento para este case neste idioma.',
  };
}

export const caseEditorialError: AfterErrorHook = ({ error, req }) => {
  const conflict = translateCaseConflict(error, req);

  if (conflict)
    return { status: 409, response: { errors: [{ ...conflict, path: conflict.field }] } };
};
