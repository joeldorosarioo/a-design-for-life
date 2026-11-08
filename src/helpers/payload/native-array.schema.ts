import { z } from 'zod';
// Payload's native Form serializes an empty array/blocks field as the row count 0.
// Accept only that empty representation, never a positive count or arbitrary scalar.
export function nativeArray<T extends z.ZodType>(row: T) {
  return z.preprocess((value) => (value === 0 ? [] : value), z.array(row));
}
