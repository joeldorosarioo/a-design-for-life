import 'server-only';
import { ValidationError, type CollectionBeforeChangeHook } from 'payload';

function identity(value: unknown): unknown {
  return value && typeof value === 'object' && 'id' in value ? value.id : value;
}

export function immutableFields(messages: Record<string, string>): CollectionBeforeChangeHook {
  return ({ data, originalDoc, operation, collection, req }) => {
    if (operation !== 'update') return data;
    for (const [field, message] of Object.entries(messages)) {
      if (
        Object.hasOwn(data, field) &&
        data[field] !== undefined &&
        identity(data[field]) !== identity(originalDoc[field])
      ) {
        throw new ValidationError({
          collection: collection.slug,
          errors: [{ path: field, message }],
          req,
        });
      }
    }
    return data;
  };
}
