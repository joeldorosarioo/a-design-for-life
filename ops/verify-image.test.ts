import { expect, it } from 'vitest';
import { verifyImagePromotion } from './verify-image';
const digest = 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// A candidate differing from the validated immutable image must never be promoted.
it('rejects a candidate image different from the staged digest', () => {
  expect(
    verifyImagePromotion({
      stagingDigest: digest,
      productionCandidateDigest: 'sha256:' + 'f'.repeat(64),
    }),
  ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
});
it.each([
  {},
  null,
  { stagingDigest: 'latest', productionCandidateDigest: 'latest' },
  { stagingDigest: 'sha256:aaa', productionCandidateDigest: 'sha256:aaa' },
  { stagingDigest: digest, productionCandidateDigest: digest, bypass: true },
  { stagingDigest: digest, productionCandidateDigest: 1 },
])('rejects an unverified mutable or malformed promotion identity: %j', (input) => {
  expect(verifyImagePromotion(input)).toMatchObject({
    ok: false,
    error: { code: 'invalid-input' },
  });
});
it('permits only the same valid immutable image identity', () => {
  expect(
    verifyImagePromotion({ stagingDigest: digest, productionCandidateDigest: digest }),
  ).toMatchObject({ ok: true });
});
