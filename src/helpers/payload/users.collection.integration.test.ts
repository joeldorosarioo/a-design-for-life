import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
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
