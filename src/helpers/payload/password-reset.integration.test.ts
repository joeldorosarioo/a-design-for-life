import { randomUUID } from 'node:crypto';
import { createLocalReq } from 'payload';
import { editorialEmailAdapter } from './editorial-email';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import {
  authHTTP,
  authPassword,
  capturedMessages,
  capturedResetToken,
  disposeCapturedMessages,
  withUnavailableCapturedDelivery,
  ageCapturedMessages,
} from '../../../testing/fixtures/editorial-auth';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const ownedEmails: string[] = [];
async function user() {
  const email = `reset-${randomUUID()}@example.invalid`;
  ownedEmails.push(email);
  return fixture.payload.create({
    collection: 'users',
    data: { email, password: authPassword },
    context: { trustedAccountProvisioning: true },
    overrideAccess: true,
  });
}
async function tokenFor(email: string) {
  expect((await authHTTP('forgot-password', { email, disableEmail: true })).status).toBe(200);
  const messages = await capturedMessages(email);
  expect(messages.length).toBe(1);
  return capturedResetToken(messages[0].html);
}
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.7-auth');
});
afterAll(async () => {
  await disposeCapturedMessages(ownedEmails);
  await fixture?.payload.destroy();
});

it('allows an authenticated editor to provision another equal native editor without public signup', async () => {
  const email = `second-${randomUUID()}@example.invalid`;
  ownedEmails.push(email);
  const second = await fixture.payload.create({
    collection: 'users',
    data: { email, password: authPassword },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const loggedIn = await authHTTP('login', { email: second.email, password: authPassword });
  expect(loggedIn.status).toBe(200);
  expect((await loggedIn.json()).user.id).toBe(second.id);
  const secondRequest = await createLocalReq(
    { user: { ...second, collection: 'users' } },
    fixture.payload,
  );
  for (const req of [await fixture.request(), secondRequest]) {
    const document = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Equal editor permissions fixture' },
      req,
      overrideAccess: false,
    });
    expect(
      (
        await fixture.payload.findByID({
          collection: 'cases',
          id: document.id,
          req,
          overrideAccess: false,
        })
      ).id,
    ).toBe(document.id);
  }
});

it('does not distinguish locked native accounts from unknown accounts in outward login errors', async () => {
  const lockedUser = await user();
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: lockedUser.id,
    data: { lockUntil: new Date(Date.now() + 60_000).toISOString(), loginAttempts: 5 },
  });
  const locked = await authHTTP('login', { email: lockedUser.email, password: 'incorrect' });
  const unknown = await authHTTP('login', {
    email: `unknown-${randomUUID()}@example.invalid`,
    password: 'incorrect',
  });
  expect(locked.status).toBe(401);
  expect(unknown.status).toBe(401);
  expect(await locked.json()).toEqual(await unknown.json());
});

it('captures native delivery, revokes the prior session, resets and authenticates with the new password', async () => {
  const account = await user();
  const oldLogin = await authHTTP('login', { email: account.email, password: authPassword });
  const oldCookie = oldLogin.headers.get('set-cookie')!.split(';')[0];
  const token = await tokenFor(account.email);
  const reset = await authHTTP('reset-password', { token, password: `${authPassword}new` });
  expect(reset.status).toBe(200);
  expect(Object.hasOwn(await reset.json(), 'token')).toBe(false);
  expect((reset.headers.get('set-cookie') ?? '').includes('HttpOnly')).toBe(true);
  const oldSession = await fixture.payload.auth({
    headers: new Headers({ cookie: oldCookie, origin: process.env.SITE_ORIGIN! }),
  });
  expect(oldSession.user === null).toBe(true);
  expect(
    (await authHTTP('login', { email: account.email, password: `${authPassword}new` })).status,
  ).toBe(200);
  expect((await authHTTP('login', { email: account.email, password: authPassword })).status).toBe(
    401,
  );
  expect(
    (await authHTTP('reset-password', { token, password: `${authPassword}reuse` })).status,
  ).toBe(403);
});

it('uses generic forgot responses for an unknown email and a native cooldown without returning a token', async () => {
  const account = await user();
  const first = await authHTTP('forgot-password', { email: account.email });
  const cooldown = await authHTTP('forgot-password', { email: account.email });
  const unknown = await authHTTP('forgot-password', {
    email: `missing-${randomUUID()}@example.invalid`,
    disableEmail: false,
    overrideAccess: true,
  });
  expect([first.status, cooldown.status, unknown.status]).toEqual([200, 200, 200]);
  const firstBody = await first.json();
  expect(Object.hasOwn(firstBody, 'token')).toBe(false);
  expect(await cooldown.json()).toEqual(firstBody);
  expect(await unknown.json()).toEqual(firstBody);
  expect((await capturedMessages(account.email)).length).toBe(1);
});

it('rejects invalid and deterministically expired native tokens with the same outward result', async () => {
  const account = await user();
  const token = await tokenFor(account.email);
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: account.id,
    data: { resetPasswordExpiration: new Date(Date.now() - 60_000).toISOString() },
  });
  const expired = await authHTTP('reset-password', { token, password: `${authPassword}expired` });
  const invalid = await authHTTP('reset-password', {
    token: 'invalid-synthetic-test-token',
    password: `${authPassword}invalid`,
  });
  expect([expired.status, invalid.status]).toEqual([403, 403]);
  expect(await expired.json()).toEqual(await invalid.json());
  expect((await authHTTP('login', { email: account.email, password: authPassword })).status).toBe(
    200,
  );
});

it('consumes one native recovery token at most once under concurrent requests', async () => {
  const account = await user();
  const token = await tokenFor(account.email);
  const passwords = [`${authPassword}race1`, `${authPassword}race2`];
  const responses = await Promise.all(
    passwords.map((password) => authHTTP('reset-password', { token, password })),
  );
  const winner = responses.findIndex((response) => response.status === 200);
  expect(responses.filter((response) => response.status === 200).length).toBe(1);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 403]);
  expect(
    (await authHTTP('login', { email: account.email, password: passwords[winner] })).status,
  ).toBe(200);
  expect(
    (await authHTTP('login', { email: account.email, password: passwords[1 - winner] })).status,
  ).toBe(401);
  expect((await authHTTP('login', { email: account.email, password: authPassword })).status).toBe(
    401,
  );
  expect(
    (await authHTTP('reset-password', { token, password: `${authPassword}reused` })).status,
  ).toBe(403);
});

it('does not turn a real local email delivery failure into a public account oracle', async () => {
  const account = await user();
  await withUnavailableCapturedDelivery(async () => {
    const failedDelivery = await authHTTP('forgot-password', { email: account.email });
    const unknown = await authHTTP('forgot-password', {
      email: `missing-${randomUUID()}@example.invalid`,
    });
    expect([failedDelivery.status, unknown.status]).toEqual([200, 200]);
    expect(await failedDelivery.json()).toEqual(await unknown.json());
  });
  expect((await capturedMessages(account.email)).length).toBe(0);
  // Native rollback releases its cooldown, so a repaired transport can deliver immediately.
  expect((await authHTTP('forgot-password', { email: account.email })).status).toBe(200);
  expect((await capturedMessages(account.email)).length).toBe(1);
});

it('enforces the configured native five-attempt login lock without revealing account existence', async () => {
  const account = await user();
  for (let attempt = 0; attempt < 5; attempt++)
    expect((await authHTTP('login', { email: account.email, password: 'incorrect' })).status).toBe(
      401,
    );
  const locked = await authHTTP('login', { email: account.email, password: authPassword });
  const unknown = await authHTTP('login', {
    email: `unknown-${randomUUID()}@example.invalid`,
    password: authPassword,
  });
  expect([locked.status, unknown.status]).toEqual([401, 401]);
  expect(await locked.json()).toEqual(await unknown.json());
  const internal = await fixture.payload.findByID({
    collection: 'users',
    id: account.id,
    showHiddenFields: true,
    overrideAccess: true,
  });
  expect((internal.loginAttempts ?? 0) >= 5).toBe(true);
  expect(new Date(internal.lockUntil ?? '').getTime() > Date.now()).toBe(true);
});

it('releases its native transaction reservation when native password validation fails', async () => {
  const account = await user();
  const token = await tokenFor(account.email);
  const invalid = await authHTTP('reset-password', { token, password: '' });
  expect(invalid.ok).toBe(false);
  expect(
    (await authHTTP('reset-password', { token, password: `${authPassword}after-rollback` })).status,
  ).toBe(200);
});

it('keeps the cross-process local mailbox bounded during concurrent captured deliveries', async () => {
  const email = `capture-${randomUUID()}@example.invalid`;
  ownedEmails.push(email);
  const adapter = editorialEmailAdapter(
    'test',
    process.env.DATABASE_URI!,
  )({ payload: fixture.payload });
  await Promise.all(
    Array.from({ length: 40 }, () =>
      adapter.sendEmail({
        to: email,
        subject: 'Synthetic capture limit',
        html: 'Synthetic local capture body without a reset token',
      }),
    ),
  );
  const messages = await capturedMessages(email);
  expect(messages.length).toBeLessThanOrEqual(32);
  expect(messages.length).toBeGreaterThan(0);
});

it('expires retained capture messages and rejects oversized or production delivery without exposing their content', async () => {
  const email = `capture-expiry-${randomUUID()}@example.invalid`;
  ownedEmails.push(email);
  const adapter = editorialEmailAdapter(
    'test',
    process.env.DATABASE_URI!,
  )({ payload: fixture.payload });
  await adapter.sendEmail({ to: email, html: 'Synthetic expired capture' });
  await ageCapturedMessages(email);
  await adapter.sendEmail({ to: email, html: 'Synthetic fresh capture' });
  expect((await capturedMessages(email)).length).toBe(1);
  await expect(adapter.sendEmail({ to: email, html: 'x'.repeat(65 * 1024) })).rejects.toThrow(
    'Editorial email delivery is unavailable.',
  );
  const production = editorialEmailAdapter(
    'production',
    process.env.DATABASE_URI!,
  )({ payload: fixture.payload });
  await expect(
    production.sendEmail({ to: email, html: 'Synthetic disabled production delivery' }),
  ).rejects.toThrow('Editorial email delivery is unavailable.');
});
