import { randomUUID } from 'node:crypto';
import { createLocalReq, getPayload, type Payload } from 'payload';
import config from '@payload-config';

export async function createEditorialPayloadFixture(key: string) {
  const payload = await getPayload({ config, key });
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `editor-${randomUUID()}@example.invalid`,
      password: 'Synthetic-editorial-test-password-123!',
    },
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  return {
    payload,
    user,
    request: () => createLocalReq({ user: { ...user, collection: 'users' } }, payload),
  };
}

export async function clearStructuralFixture(payload: Payload) {
  if (
    process.env.APP_ENV !== 'test' ||
    !new URL(process.env.DATABASE_URI ?? '').pathname.startsWith('/adfl_test_')
  ) {
    throw new Error('A limpeza de fixture exige banco isolado de teste');
  }
  // Test-only fixture cleanup deliberately bypasses document invariants, never application routes.
  await payload.db.deleteVersions({ collection: 'site-navigation', where: {} });
  await payload.db.deleteVersions({ collection: 'professional-profiles', where: {} });
  await payload.db.deleteMany({ collection: 'site-navigation', where: {} });
  await payload.db.deleteMany({ collection: 'professional-profiles', where: {} });
}
