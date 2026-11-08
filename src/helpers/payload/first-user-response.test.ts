import { expect, it } from 'vitest';
import { protectNativeFirstUserResponse } from './first-user-response';
import { isEditorialAuthTransport } from './auth-transport';

it('treats Native first-register as an authentication transport', () => {
  expect(isEditorialAuthTransport(['users', 'first-register'])).toBe(true);
});
it('removes the Native first-register JSON token after cookie generation and preserves both cookies', async () => {
  const headers = new Headers({ 'content-type': 'application/json', 'content-length': '999' });
  headers.append('set-cookie', 'payload-token=synthetic-session; HttpOnly; Secure; SameSite=Lax');
  headers.append('set-cookie', 'other=synthetic; HttpOnly');
  const original = new Response(
    JSON.stringify({
      message: 'created',
      token: 'synthetic-native-jwt',
      user: { id: 'actor-id', email: 'editor@example.invalid' },
    }),
    { status: 201, headers },
  );
  const protectedResponse = await protectNativeFirstUserResponse(original, [
    'users',
    'first-register',
  ]);
  expect(protectedResponse.status).toBe(201);
  expect(protectedResponse.headers.getSetCookie()).toEqual(headers.getSetCookie());
  expect(protectedResponse.headers.get('content-length')).toBeNull();
  expect(protectedResponse.headers.get('cache-control')).toBe('no-store, max-age=0');
  expect(await protectedResponse.json()).toEqual({
    message: 'created',
    user: { id: 'actor-id', email: 'editor@example.invalid' },
  });
});
it('passes unrelated Native operations through without consuming their bodies', async () => {
  const original = Response.json({ token: 'synthetic-other-operation', user: { id: 'actor' } });
  expect(await protectNativeFirstUserResponse(original, ['users', 'login'])).toBe(original);
  expect(original.bodyUsed).toBe(false);
});
it('preserves Native first-register refusal while marking it private', async () => {
  const original = Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 });
  const result = await protectNativeFirstUserResponse(original, ['users', 'first-register']);
  expect(result.status).toBe(403);
  expect(result.headers.get('cache-control')).toBe('no-store, max-age=0');
  expect(await result.json()).toEqual({ errors: [{ message: 'Forbidden' }] });
});
it('fails closed on an unexpected successful Native body without exposing its content', async () => {
  const result = await protectNativeFirstUserResponse(
    new Response('synthetic-unexpected-secret', { status: 200 }),
    ['users', 'first-register'],
  );
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('synthetic-unexpected-secret');
});
