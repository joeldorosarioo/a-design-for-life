import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  getPayload,
  handleEndpoints,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type Migration,
  type Payload,
  type SanitizedConfig,
} from 'payload';
import config from '@payload-config';
import { migrations } from '../../migrations';
import { provisionStructuralDocuments } from '../../config/provision-structural-documents';
import { usersCollection } from './users.collection';
import type { EditorialFirstAccessOptions } from './editorial-first-access';
import { protectNativeFirstUserResponse } from './first-user-response';
import { closeStagingPayload } from '../../../ops/staging/initialize';
import { inspectOwnedTestDatabase } from '../../../testing/setup/owned-test-database';
import { isolatedTestDatabaseUri } from '../../../testing/setup/test-environment';

type NativeClient = InstanceType<NonNullable<Payload['db']['pg']>['Client']>;
let administrator: NativeClient;
let makeClient: NonNullable<Payload['db']['pg']>['Client'];
let acquired: ReturnType<typeof inspectOwnedTestDatabase>;
const databases = new Set<string>();
const payloads = new Set<Payload>();
const password = 'Synthetic-browser-first-access-password-123!';
const siteOrigin = 'https://native-first-access.example.invalid';

type Target = {
  payload: Payload;
  key: string;
  databaseUri: string;
  database: string;
  firstAccess: EditorialFirstAccessOptions;
};
function assertOwned() {
  const current = inspectOwnedTestDatabase();
  if (current.containerId !== acquired.containerId || current.networkId !== acquired.networkId)
    throw new Error('Native first-access proof lost its acquired PostgreSQL.');
}
function assertDatabase(database: string) {
  assertOwned();
  if (!/^adfl_test_first_access_[a-f0-9]{32}$/.test(database) || !databases.has(database))
    throw new Error(
      'Native first-access proof refuses a database outside its own creation receipt.',
    );
}
async function target(
  hooks: {
    beforeOperation?: CollectionBeforeOperationHook;
    beforeChange?: CollectionBeforeChangeHook;
  } = {},
): Promise<Target> {
  assertOwned();
  const database = `adfl_test_first_access_${randomUUID().replaceAll('-', '')}`;
  await administrator.query(`CREATE DATABASE "${database}"`);
  databases.add(database);
  assertDatabase(database);
  const connection = new URL(isolatedTestDatabaseUri);
  connection.pathname = `/${database}`;
  const nativeConfig = await config;
  const nativeUsers = nativeConfig.collections.find((collection) => collection.slug === 'users');
  if (!nativeUsers?.auth) throw new Error('Native users auth configuration unavailable.');
  const firstAccess: EditorialFirstAccessOptions = {
    enabled: true,
    appEnv: 'staging',
    publicSiteEnabled: false,
    databaseUri: connection.href,
    mediaBucket: 'synthetic-local-first-access',
    provisionStructuralDocuments,
  };
  const users = usersCollection(siteOrigin, firstAccess);
  const prepared: SanitizedConfig = {
    ...nativeConfig,
    serverURL: siteOrigin,
    csrf: [siteOrigin],
    cors: [siteOrigin],
    logger: { options: { level: 'silent' } } as typeof nativeConfig.logger,
    typescript: { ...nativeConfig.typescript, autoGenerate: false },
    collections: nativeConfig.collections.map((collection) =>
      collection.slug === 'users'
        ? {
            ...collection,
            auth: { ...nativeUsers.auth, cookies: { ...nativeUsers.auth.cookies, secure: true } },
            hooks: {
              ...collection.hooks,
              afterChange: users.hooks?.afterChange ?? [],
              afterError: users.hooks?.afterError ?? [],
              beforeOperation: [
                ...(hooks.beforeOperation ? [hooks.beforeOperation] : []),
                ...(users.hooks?.beforeOperation ?? []),
              ],
              beforeChange: [
                ...(users.hooks?.beforeChange ?? []),
                ...(hooks.beforeChange ? [hooks.beforeChange] : []),
              ],
            },
          }
        : collection,
    ),
  };
  const key = `native-first-access-${randomUUID()}`;
  const payload = await getPayload({
    config: prepared,
    key,
    disableDBConnect: true,
    disableOnInit: true,
  });
  payloads.add(payload);
  payload.db.poolOptions = { connectionString: connection.href };
  await payload.db.connect!();
  await payload.db.migrate({ migrations: migrations as Migration[] });
  return { payload, key, databaseUri: connection.href, database, firstAccess };
}
async function api(
  selected: Target,
  suffix: string,
  data?: Record<string, unknown>,
  cookie?: string,
  origin = siteOrigin,
) {
  assertDatabase(selected.database);
  const response = await handleEndpoints({
    config: selected.payload.config,
    payloadInstanceCacheKey: selected.key,
    request: new Request(`${siteOrigin}/api/users${suffix ? `/${suffix}` : ''}`, {
      method: data ? 'POST' : 'GET',
      headers: {
        origin,
        ...(data ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
  });
  return protectNativeFirstUserResponse(
    response,
    suffix.split('?')[0] === 'first-register' ? ['users', 'first-register'] : undefined,
  );
}
async function counts(selected: Target) {
  assertDatabase(selected.database);
  const collections = ['users', 'professional-profiles', 'site-navigation'] as const;
  return Object.fromEntries(
    await Promise.all(
      collections.map(async (collection) => [
        collection,
        (
          await selected.payload.find({
            collection,
            limit: 0,
            draft: true,
            depth: 0,
            overrideAccess: true,
          })
        ).totalDocs,
      ]),
    ),
  );
}
function latch() {
  let open!: () => void;
  return {
    wait: new Promise<void>((resolve) => {
      open = resolve;
    }),
    open: () => open(),
  };
}
async function waitFor(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Native concurrency proof did not reach its expected boundary.')),
          10_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

beforeAll(async () => {
  acquired = inspectOwnedTestDatabase();
  const nativeConfig = await config;
  const base = await getPayload({
    config: {
      ...nativeConfig,
      logger: { options: { level: 'silent' } } as typeof nativeConfig.logger,
      typescript: { ...nativeConfig.typescript, autoGenerate: false },
    },
    key: `native-first-access-administrator-${randomUUID()}`,
    disableDBConnect: true,
    disableOnInit: true,
  });
  makeClient = base.db.pg!.Client;
  await base.destroy();
  administrator = new makeClient({ connectionString: isolatedTestDatabaseUri });
  await administrator.connect();
});
afterAll(async () => {
  if (acquired) assertOwned();
  for (const payload of payloads) await closeStagingPayload(payload);
  if (administrator) {
    for (const database of databases) {
      assertDatabase(database);
      await administrator.query(`DROP DATABASE "${database}"`);
    }
    await administrator.end();
  }
});

it('uses Native first registration, commits one editor/four drafts and a cookie session, then closes public account creation', async () => {
  const selected = await target();
  const sendEmail = vi.spyOn(selected.payload, 'sendEmail');
  const email = `first-${randomUUID()}@example.invalid`;
  selected.firstAccess.enabled = false;
  const forgedFirstAccess = await api(
    selected,
    'first-register?overrideAccess=true&context[trustedAccountProvisioning]=true',
    {
      email,
      password,
      context: { trustedAccountProvisioning: true, editorialFirstAccess: true },
      overrideAccess: true,
    },
  );
  expect(forgedFirstAccess.status).toBe(403);
  expect(await counts(selected)).toEqual({
    users: 0,
    'professional-profiles': 0,
    'site-navigation': 0,
  });
  selected.firstAccess.enabled = true;
  expect(
    (
      await api(selected, '', {
        email,
        password,
        context: { trustedAccountProvisioning: true },
        overrideAccess: true,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(
        selected,
        'first-register',
        { email, password },
        undefined,
        'https://foreign.example.invalid',
      )
    ).status,
  ).toBe(403);
  expect(await counts(selected)).toEqual({
    users: 0,
    'professional-profiles': 0,
    'site-navigation': 0,
  });
  const registered = await api(selected, 'first-register', { email, password });
  expect(registered.status).toBe(200);
  expect(registered.headers.get('cache-control')).toContain('no-store');
  const cookie = registered.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Lax');
  const body = await registered.json();
  expect(body.user.email).toBe(email);
  expect(Object.hasOwn(body, 'token')).toBe(false);
  expect(await counts(selected)).toEqual({
    users: 1,
    'professional-profiles': 2,
    'site-navigation': 2,
  });
  for (const collection of ['professional-profiles', 'site-navigation'] as const) {
    const drafts = await selected.payload.find({
      collection,
      depth: 0,
      draft: true,
      limit: 3,
      overrideAccess: true,
    });
    expect(drafts.docs.map((document) => document.locale).sort()).toEqual(['en', 'pt']);
    expect(drafts.docs.every((document) => document._status === 'draft')).toBe(true);
  }
  // Payload3.92.1 first-register uses LocalAPI login, which removes its token
  // before that endpoint builds the cookie. Native login establishes the
  // browser session while keeping tokens out of response JSON.
  const login = await api(selected, 'login', { email, password });
  expect(login.status).toBe(200);
  expect(Object.hasOwn(await login.json(), 'token')).toBe(false);
  const loginCookie = login.headers.get('set-cookie')!;
  expect(loginCookie.split(';')[0].split('=')[1]?.length > 0).toBe(true);
  expect(loginCookie).toContain('HttpOnly');
  expect(loginCookie).toContain('Secure');
  const me = await api(selected, 'me', undefined, loginCookie.split(';')[0]);
  expect(me.status).toBe(200);
  expect((await me.json()).user.id).toBe(body.user.id);
  expect(
    (
      await api(selected, 'first-register', {
        email: `other-${randomUUID()}@example.invalid`,
        password,
      })
    ).status,
  ).toBe(403);
  expect(
    (await api(selected, '', { email: `normal-${randomUUID()}@example.invalid`, password })).status,
  ).toBe(403);
  expect(await counts(selected)).toEqual({
    users: 1,
    'professional-profiles': 2,
    'site-navigation': 2,
  });
  expect(sendEmail).not.toHaveBeenCalled();
  expect(Object.keys(selected.payload.db.sessions ?? {})).toHaveLength(0);
}, 60_000);

it('serializes two Native first-register requests that both observed no account with a real PostgreSQL transaction lock', async () => {
  const both = latch();
  const held = latch();
  const release = latch();
  let arrivals = 0;
  let sawContenderWhileWinnerHeld = false;
  const selected = await target({
    beforeOperation: async ({ operation, req }) => {
      if (operation === 'create' && new URL(req.url!).pathname === '/api/users/first-register') {
        if (++arrivals === 2) both.open();
        await waitFor(both.wait);
      }
    },
    beforeChange: async ({ operation }) => {
      if (operation === 'create') {
        held.open();
        await waitFor(release.wait);
      }
    },
  });
  const attempt = async () => {
    const response = await api(selected, 'first-register', {
      email: `race-${randomUUID()}@example.invalid`,
      password,
    });
    if (response.status === 403) {
      await waitFor(held.wait);
      sawContenderWhileWinnerHeld = true;
      release.open();
    }
    return response;
  };
  const results = await Promise.all([attempt(), attempt()]);
  expect(arrivals).toBe(2);
  expect(sawContenderWhileWinnerHeld).toBe(true);
  expect(results.map((result) => result.status).sort()).toEqual([200, 403]);
  expect(await counts(selected)).toEqual({
    users: 1,
    'professional-profiles': 2,
    'site-navigation': 2,
  });
  expect(Object.keys(selected.payload.db.sessions ?? {})).toHaveLength(0);
}, 60_000);

it('rolls back the Native editor and all four structural drafts when a real PostgreSQL constraint rejects the last draft', async () => {
  const selected = await target();
  assertDatabase(selected.database);
  const connection = new makeClient({ connectionString: selected.databaseUri });
  await connection.connect();
  try {
    await connection.query(
      "ALTER TABLE public.profiles ADD CONSTRAINT first_access_reject_last_draft CHECK(locale <> 'en')",
    );
  } finally {
    await connection.end();
  }
  const response = await api(selected, 'first-register', {
    email: `rollback-${randomUUID()}@example.invalid`,
    password,
  });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await counts(selected)).toEqual({
    users: 0,
    'professional-profiles': 0,
    'site-navigation': 0,
  });
  expect(Object.keys(selected.payload.db.sessions ?? {})).toHaveLength(0);
}, 60_000);
