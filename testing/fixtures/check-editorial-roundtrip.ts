import assert from 'node:assert/strict';
import { getPayload } from 'payload';
import config from '@payload-config';
if (
  process.env.APP_ENV !== 'test' ||
  new URL(process.env.DATABASE_URI ?? '').port !== '55433' ||
  new URL(process.env.DATABASE_URI ?? '').pathname !== '/adfl_test_base'
)
  throw new Error('Roundtrip verification requires the isolated tmpfs fixture');
const payload = await getPayload({ config, disableOnInit: true });
try {
  for (const collection of ['site-navigation', 'professional-profiles'] as const) {
    const result = await payload.find({ collection, draft: true, depth: 0 });
    assert.deepEqual(result.docs.map((doc) => [doc.locale, doc._status]).sort(), [
      ['en', 'draft'],
      ['pt', 'draft'],
    ]);
    assert.equal((await payload.find({ collection, overrideAccess: false })).totalDocs, 0);
  }
  assert.equal((await payload.find({ collection: 'users' })).totalDocs, 0);
  console.info(
    'Roundtrip fixture verified: exactly four private structural drafts and zero human accounts.',
  );
} finally {
  await payload.destroy();
}
