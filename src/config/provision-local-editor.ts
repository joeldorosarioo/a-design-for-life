import 'server-only';
import type { Payload } from 'payload';
import { z } from 'zod';

const credentialsSchema = z.object({
  APP_ENV: z.literal('local'),
  LOCAL_EDITOR_EMAIL: z.email().trim().toLowerCase(),
  LOCAL_EDITOR_PASSWORD: z.string().min(1),
});

export function readLocalEditorCredentials(input: Partial<NodeJS.ProcessEnv>) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      'Local editor provisioning requires APP_ENV=local and private LOCAL_EDITOR_EMAIL/LOCAL_EDITOR_PASSWORD.',
    );
  return { email: parsed.data.LOCAL_EDITOR_EMAIL, password: parsed.data.LOCAL_EDITOR_PASSWORD };
}

export async function provisionLocalEditor(
  payload: Payload,
  credentials: ReturnType<typeof readLocalEditorCredentials>,
): Promise<'created' | 'existing'> {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: credentials.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing.totalDocs > 0) return 'existing';
  await payload.create({
    collection: 'users',
    data: credentials,
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  return 'created';
}
