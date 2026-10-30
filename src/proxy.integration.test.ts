import { afterAll, beforeAll, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../testing/fixtures/editorial-payload';
import { authHTTP } from '../testing/fixtures/editorial-auth';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { proxy } from './proxy';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let cookie: string;
let profileId: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-private-proxy-native');
  installPayloadProvider(async () => fixture.payload);
  await clearStructuralFixture(fixture.payload);
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    draft: true,
    data: { locale: 'pt', identity: { name: 'PRIVATE INCOMPLETE PROFILE' }, _status: 'draft' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  profileId = profile.id;
  const login = await authHTTP(
    'login',
    {
      email: fixture.user.email,
      password: 'Synthetic-editorial-test-password-123!',
    },
    undefined,
    'e2-private-proxy-native',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  const actor = await fixture.payload.auth({
    headers: new Headers({
      cookie,
      origin: process.env.SITE_ORIGIN!,
      'sec-fetch-site': 'same-origin',
    }),
  });
  expect(actor.user?.collection).toBe('users');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('returns a private503 before Next for an authorized source whose draft presentation is incomplete', async () => {
  const response = await proxy(
    new NextRequest(
      `${process.env.SITE_ORIGIN}/preview-ui/pt/professional-profiles/${profileId}/home`,
      {
        headers: {
          cookie,
          origin: process.env.SITE_ORIGIN!,
          'sec-fetch-site': 'same-origin',
          rsc: '1',
        },
      },
    ),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('x-middleware-next')).toBeNull();
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.headers.get('cache-control')).toContain('private');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(await response.text()).toBe('');
});
