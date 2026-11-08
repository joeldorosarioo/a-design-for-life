import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPayload, handleEndpoints, type Payload } from 'payload';
import config from '@payload-config';

let payload: Payload;
beforeAll(async () => {
  payload = await getPayload({ config });
});
afterAll(async () => {
  await payload?.destroy();
});

describe('bootstrap editorial mínimo', () => {
  // first-register internally calls create with overrideAccess=true. An access-only guard would leak account creation.
  it('recusa criação anônima mesmo no caminho privilegiado usado pelo bootstrap nativo', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'unauthorized@example.invalid', password: 'Synthetic-test-password-123!' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/(forbidden|proib|não permit|not allowed)/i);
  });
});

it('refuses private native user reads and public signup even with body/query provisioning flags', async () => {
  await expect(payload.find({ collection: 'users', overrideAccess: false })).rejects.toThrow();
  const email = `anonymous-${crypto.randomUUID()}@example.invalid`;
  const signup = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users?overrideAccess=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN! },
      body: JSON.stringify({
        email,
        password: 'Synthetic-anonymous-password-123!',
        context: { trustedAccountProvisioning: true },
        overrideAccess: true,
      }),
    }),
  });
  expect(signup.status).toBe(403);
  expect(
    (
      await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
    ).totalDocs,
  ).toBe(0);
  const privateRead = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users?overrideAccess=true`),
  });
  expect(privateRead.status).toBe(403);
});

it('refuses anonymous native account updates on the server', async () => {
  const account = await payload.create({
    collection: 'users',
    data: {
      email: `account-${crypto.randomUUID()}@example.invalid`,
      password: 'Synthetic-editorial-password-123!',
    },
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
  const response = await handleEndpoints({
    config,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users/${account.id}?overrideAccess=true`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN! },
      body: JSON.stringify({ password: 'Synthetic-unauthorized-replacement-123!' }),
    }),
  });
  expect(response.status).toBe(403);
  const login = await payload.login({
    collection: 'users',
    data: { email: account.email, password: 'Synthetic-editorial-password-123!' },
    overrideAccess: false,
  });
  expect(login.user?.id).toBe(account.id);
});
