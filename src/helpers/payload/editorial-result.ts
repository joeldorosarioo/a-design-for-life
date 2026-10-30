import 'server-only';
import { APIError, ValidationError } from 'payload';
import { EditorialConflict } from './editorial-revision';
import type { Result } from './editorial-result.schema';
export async function editorialResult<T>(operation: () => Promise<T>): Promise<Result<T>> {
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
