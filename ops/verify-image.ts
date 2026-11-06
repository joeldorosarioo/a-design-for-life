import { z } from 'zod';
import type { Result } from '../src/helpers/payload/editorial-result.schema';

const immutableDigest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const promotion = z.strictObject({
  stagingDigest: immutableDigest,
  productionCandidateDigest: immutableDigest,
});
export function verifyImagePromotion(input: unknown): Result<void> {
  const parsed = promotion.safeParse(input);
  if (!parsed.success || parsed.data.stagingDigest !== parsed.data.productionCandidateDigest) {
    return {
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'The production candidate must be the same immutable image validated in staging.',
      },
    };
  }
  return { ok: true, value: undefined };
}
