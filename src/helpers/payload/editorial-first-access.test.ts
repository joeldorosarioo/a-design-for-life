import { describe, expect, it, vi } from 'vitest';
import type { CollectionConfig, PayloadRequest } from 'payload';
import { usersCollection } from './users.collection';

const origin = 'https://first-access.example.invalid';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'first@example.invalid' };
const credentials = { email: user.email, password: 'Synthetic-first-access-password-123!' };
const policy = () => ({
  enabled: true,
  appEnv: 'staging',
  publicSiteEnabled: false,
  databaseUri: 'postgresql://stage_role:synthetic@127.0.0.1:5432/stage_owned',
  mediaBucket: 'stage-owned',
  provisionStructuralDocuments: vi.fn(async (_req: PayloadRequest) => {
    void _req;
  }),
});
function request() {
  const execute = vi.fn<(query: unknown) => Promise<{ rows: Array<{ acquired: boolean }> }>>(
    async () => ({ rows: [{ acquired: true }] }),
  );
  const findOne = vi.fn(async (): Promise<{ id: string } | null> => null);
  const req = {
    method: 'POST',
    url: `${origin}/api/users/first-register`,
    headers: new Headers({ origin }),
    routeParams: { collection: 'users' },
    transactionID: 'native-first-access-tx',
    context: {},
    payload: {
      db: {
        sessions: { 'native-first-access-tx': { db: { execute } } },
        findOne,
        beginTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
      },
    },
    t: () => 'Forbidden',
  } as unknown as PayloadRequest;
  return { req, execute, findOne };
}
async function reserve(collection: CollectionConfig, req: PayloadRequest) {
  for (const hook of collection.hooks?.beforeOperation ?? [])
    await hook({
      operation: 'create',
      req,
      args: { req },
      collection,
      context: req.context,
      overrideAccess: true,
    } as unknown as Parameters<typeof hook>[0]);
}
async function authorize(collection: CollectionConfig, req: PayloadRequest) {
  for (const hook of collection.hooks?.beforeChange ?? [])
    await hook({
      operation: 'create',
      req,
      data: credentials,
      collection,
      context: req.context,
    } as unknown as Parameters<typeof hook>[0]);
}
async function provision(collection: CollectionConfig, req: PayloadRequest) {
  for (const hook of collection.hooks?.afterChange ?? [])
    await hook({
      operation: 'create',
      req,
      doc: user,
      previousDoc: {},
      data: credentials,
      collection,
      context: req.context,
    } as unknown as Parameters<typeof hook>[0]);
}

describe('Native editorial first access', () => {
  it('permits the opted-in Native first registration and provisions drafts with its actor inside the same transaction', async () => {
    const { req, execute, findOne } = request();
    const options = policy();
    options.provisionStructuralDocuments.mockImplementation(async (unit) => {
      expect(unit).toBe(req);
      expect(unit.transactionID).toBe('native-first-access-tx');
      expect(unit.user).toMatchObject({ id: user.id, collection: 'users' });
      expect(unit.context.trustedStructuralProvisioning).toBe(true);
    });
    const collection = usersCollection(origin, options);
    await reserve(collection, req);
    await expect(authorize(collection, req)).resolves.toBeUndefined();
    await provision(collection, req);
    expect(execute).toHaveBeenCalledOnce();
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', req }));
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(findOne.mock.invocationCallOrder[0]);
    expect(options.provisionStructuralDocuments).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
    expect(req.context.trustedStructuralProvisioning).toBeUndefined();
    expect(req.payload.db.beginTransaction).not.toHaveBeenCalled();
    expect(req.payload.db.commitTransaction).not.toHaveBeenCalled();
    expect(req.payload.db.rollbackTransaction).not.toHaveBeenCalled();
  });
  it('keeps first registration disabled by default', async () => {
    const { req, execute, findOne } = request();
    await expect(reserve(usersCollection(origin), req)).rejects.toMatchObject({ status: 403 });
    expect(execute).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });
  it.each([
    { enabled: false },
    { appEnv: 'production' },
    { appEnv: 'local' },
    { publicSiteEnabled: true },
    { appEnv: 'test' },
  ])('refuses an unsafe first-access policy %j before taking a lock', async (invalid) => {
    const { req, execute } = request();
    await expect(
      reserve(usersCollection(origin, { ...policy(), ...invalid }), req),
    ).rejects.toMatchObject({ status: 403 });
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses an HTTP staging origin even with an explicit opt-in', async () => {
    const { req, execute } = request();
    const insecureOrigin = 'http://first-access.example.invalid';
    Object.assign(req, { url: insecureOrigin + '/api/users/first-register' });
    req.headers.set('origin', insecureOrigin);
    await expect(reserve(usersCollection(insecureOrigin, policy()), req)).rejects.toMatchObject({
      status: 403,
    });
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([undefined, 'null', 'https://other.example.invalid', origin + '/'])(
    'requires the exact configured Origin, received %s',
    async (submitted) => {
      const { req, execute } = request();
      if (submitted === undefined) req.headers.delete('origin');
      else req.headers.set('origin', submitted);
      await expect(reserve(usersCollection(origin, policy()), req)).rejects.toMatchObject({
        status: 403,
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    { method: 'GET' },
    { url: origin + '/api/users' },
    { url: origin + '/api/users/first-register/another' },
    { routeParams: { collection: 'cases' } },
  ])('keeps ordinary and non-Native anonymous account creation forbidden: %j', async (invalid) => {
    const { req, execute } = request();
    Object.assign(req, invalid);
    const collection = usersCollection(origin, policy());
    await reserve(collection, req);
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
    expect(execute).not.toHaveBeenCalled();
  });
  it('does not trust account provisioning flags in the submitted data/query or a public-looking context marker', async () => {
    const { req } = request();
    Object.assign(req, {
      url: origin + '/api/users?overrideAccess=true',
      data: { ...credentials, context: { trustedAccountProvisioning: true } },
      query: { trustedAccountProvisioning: true },
    });
    req.context.editorialFirstAccess = true;
    req.context.trustedStructuralProvisioning = true;
    const collection = usersCollection(origin, policy());
    await reserve(collection, req);
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
  });
  it('permits only the exact owned test namespace when APP_ENV is test', async () => {
    const { req } = request();
    const testOrigin = 'http://127.0.0.1:3101';
    Object.assign(req, { url: testOrigin + '/api/users/first-register' });
    req.headers.set('origin', testOrigin);
    const options = {
      ...policy(),
      appEnv: 'test',
      databaseUri:
        'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
      mediaBucket: 'adfl-test-runner',
    };
    const collection = usersCollection(testOrigin, options);
    await reserve(collection, req);
    await expect(authorize(collection, req)).resolves.toBeUndefined();
  });
  it.each([
    { databaseUri: 'postgres://adfl_test:synthetic@127.0.0.1:5432/adfl_test_runner' },
    { databaseUri: 'postgres://adfl_test:synthetic@127.0.0.1:55434/adfl_local' },
    { databaseUri: 'postgres://other_role:synthetic@127.0.0.1:55434/adfl_test_runner' },
    { mediaBucket: 'another-bucket' },
  ])('rejects an unowned test namespace: %j', async (invalid) => {
    const { req, execute } = request();
    const testOrigin = 'http://127.0.0.1:3101';
    Object.assign(req, { url: testOrigin + '/api/users/first-register' });
    req.headers.set('origin', testOrigin);
    const options = {
      ...policy(),
      appEnv: 'test',
      databaseUri:
        'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55434/adfl_test_runner',
      mediaBucket: 'adfl-test-runner',
      ...invalid,
    };
    await expect(reserve(usersCollection(testOrigin, options), req)).rejects.toMatchObject({
      status: 403,
    });
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses an absent Native transaction before consulting the user table', async () => {
    const { req, execute, findOne } = request();
    delete req.transactionID;
    await expect(reserve(usersCollection(origin, policy()), req)).rejects.toMatchObject({
      status: 403,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });
  it('refuses the concurrent loser when the transaction advisory lock is held', async () => {
    const { req, execute, findOne } = request();
    execute.mockResolvedValueOnce({ rows: [{ acquired: false }] });
    const collection = usersCollection(origin, policy());
    await expect(reserve(collection, req)).rejects.toMatchObject({ status: 403 });
    expect(findOne).not.toHaveBeenCalled();
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
  });
  it('rechecks that no account exists under the transaction lock', async () => {
    const { req, execute, findOne } = request();
    findOne.mockResolvedValueOnce({ id: user.id });
    const options = policy();
    const collection = usersCollection(origin, options);
    await expect(reserve(collection, req)).rejects.toMatchObject({ status: 403 });
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(findOne.mock.invocationCallOrder[0]);
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
    expect(options.provisionStructuralDocuments).not.toHaveBeenCalled();
  });
  it('binds its private reservation to the exact request and transaction', async () => {
    const { req } = request();
    const collection = usersCollection(origin, policy());
    await reserve(collection, req);
    await expect(authorize(collection, { ...req } as PayloadRequest)).rejects.toMatchObject({
      status: 403,
    });
    req.transactionID = 'another-transaction';
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
  });
  it('restores the Native request and propagates a draft failure for the Native transaction to roll back', async () => {
    const { req } = request();
    const context = req.context;
    const options = policy();
    options.provisionStructuralDocuments.mockRejectedValueOnce(
      new Error('Synthetic structural failure'),
    );
    const collection = usersCollection(origin, options);
    await reserve(collection, req);
    await authorize(collection, req);
    await expect(provision(collection, req)).rejects.toThrow('Synthetic structural failure');
    expect(req.user).toBeUndefined();
    expect(req.context).toBe(context);
    expect(req.context.trustedStructuralProvisioning).toBeUndefined();
    expect(req.payload.db.commitTransaction).not.toHaveBeenCalled();
    expect(req.payload.db.rollbackTransaction).not.toHaveBeenCalled();
    await expect(authorize(collection, req)).rejects.toMatchObject({ status: 403 });
  });
  it('preserves existing authenticated and explicitly trusted server provisioning without invoking first access', async () => {
    for (const trusted of ['actor', 'server-context']) {
      const { req, execute } = request();
      if (trusted === 'actor')
        req.user = { ...user, collection: 'users' } as PayloadRequest['user'];
      else req.context.trustedAccountProvisioning = true;
      const options = { ...policy(), enabled: false };
      const collection = usersCollection(origin, options);
      await reserve(collection, req);
      await expect(authorize(collection, req)).resolves.toBeUndefined();
      await provision(collection, req);
      expect(execute).not.toHaveBeenCalled();
      expect(options.provisionStructuralDocuments).not.toHaveBeenCalled();
    }
  });
});
