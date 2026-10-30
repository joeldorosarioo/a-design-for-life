import 'server-only';
import {
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload';
import type { z } from 'zod';
export function validateInput<T>(
  schema: z.ZodType<T>,
  data: unknown,
  collection: string,
  req: PayloadRequest,
): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ValidationError({
      collection,
      req,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '_form',
        message: issue.message,
      })),
    });
  return result.data;
}
export function requiredIdentity(schema: z.ZodType): CollectionBeforeChangeHook {
  return ({ data, originalDoc, collection, req }) => {
    validateInput(schema, { ...originalDoc, ...data }, collection.slug, req);
    return data;
  };
}

export function validatedWrite(
  schema: z.ZodType<Record<string, unknown>>,
): CollectionBeforeOperationHook {
  return ({ args, operation, collection, req }) => {
    if ((operation === 'create' || operation === 'update') && 'data' in args)
      args.data = validateInput(schema, args.data, collection.slug, req);
    return args;
  };
}
