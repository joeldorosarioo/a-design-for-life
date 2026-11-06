import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { provisionLocalEditor, readLocalEditorCredentials } from './provision-local-editor';

let payload: Payload;
beforeAll(async () => {
  payload = await getPayload({ config });
});
afterAll(async () => {
  await payload?.destroy();
});

it('creates a native account once and preserves its password when provisioning is repeated', async () => {
  const credentials = readLocalEditorCredentials({
    APP_ENV: 'local',
    LOCAL_EDITOR_EMAIL: `provision-${randomUUID()}@example.invalid`,
    LOCAL_EDITOR_PASSWORD: 'Synthetic-local-editor-password-123!',
  });
  expect(await provisionLocalEditor(payload, credentials)).toBe('created');
  const first = await payload.find({
    collection: 'users',
    where: { email: { equals: credentials.email } },
    overrideAccess: true,
  });
  expect(first.totalDocs).toBe(1);
  expect(
    await provisionLocalEditor(payload, {
      ...credentials,
      password: 'Synthetic-ignored-replacement-456!',
    }),
  ).toBe('existing');
  const repeated = await payload.find({
    collection: 'users',
    where: { email: { equals: credentials.email } },
    overrideAccess: true,
  });
  expect(repeated.totalDocs).toBe(1);
  expect(repeated.docs[0].id).toBe(first.docs[0].id);
  expect(repeated.docs[0].updatedAt).toBe(first.docs[0].updatedAt);
  const session = await payload.login({
    collection: 'users',
    data: credentials,
    overrideAccess: false,
  });
  expect(session.user?.id).toBe(first.docs[0].id);
});
