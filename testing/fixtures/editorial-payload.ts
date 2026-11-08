import type { Media } from '../../src/payload-types';
import { mediaUsageSchema } from '../../src/features/media-library/contracts/media-usage.schema';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runtimePublication } from '../../src/helpers/payload/publication-runtime';
import { withPublicRootWriter } from '../../src/helpers/payload/public-root';
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
  const directory = path.resolve(runtimePublication().directory);
  const within = (base: string) => {
    const relative = path.relative(base, directory);
    return (
      relative.length > 0 &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  };
  if (!within(path.resolve('.work/publication')) && !within(path.resolve(tmpdir())))
    throw new Error('Structural fixture cleanup requires an isolated test root.');
  // Test-only cleanup deliberately bypasses document invariants. Pair the SQL
  // removal with its confirmed subjects under the actual writer; preserve cases
  // and all unrelated subjects. This is not an application deletion operation.
  await withPublicRootWriter(directory, async (root, commit) => {
    await payload.db.deleteVersions({ collection: 'site-navigation', where: {} });
    await payload.db.deleteVersions({ collection: 'professional-profiles', where: {} });
    await payload.db.deleteMany({ collection: 'site-navigation', where: {} });
    await payload.db.deleteMany({ collection: 'professional-profiles', where: {} });
    // Retire only the deleted structural owners' test usages as well. Leaving a
    // confirmed SQL usage without its owner/root would correctly mean503 now.
    const media = await payload.db.find({ collection: 'media', pagination: false, limit: 0 });
    for (const item of (media.docs as Media[]).sort((a, b) => a.id.localeCompare(b.id))) {
      const usages = mediaUsageSchema.array().parse(item.usages ?? []);
      const removed = (usage: (typeof usages)[number]) =>
        usage.collection === 'professional-profiles' || usage.collection === 'site-navigation';
      if (!usages.some((usage) => removed(usage) && usage.state !== 'retained')) continue;
      await payload.db.updateOne({
        collection: 'media',
        where: { id: { equals: item.id } },
        options: { atomic: true },
        data: {
          usages: usages.map((usage) => (removed(usage) ? { ...usage, state: 'retained' } : usage)),
          guardRevision: randomUUID(),
        },
      });
    }
    if (!root) return;
    const subjects = Object.fromEntries(
      Object.entries(root.subjects).filter(
        ([key]) => !key.startsWith('site-navigation/') && !key.startsWith('professional-profiles/'),
      ),
    );
    if (Object.keys(subjects).length !== Object.keys(root.subjects).length)
      await commit({ generation: randomUUID(), subjects });
  });
}
