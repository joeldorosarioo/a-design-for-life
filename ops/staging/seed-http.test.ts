import { describe, expect, it, vi } from 'vitest';
import {
  NativeSeedClient,
  StagingSeedError,
  contentHash,
  createDemoPdf,
  desiredDocument,
  newSeedState,
  seedStagingContent,
  sha256,
  stagingSeedSettings,
  validateApprovedPlan,
} from './seed-http.mjs';

const editorId = '11111111-1111-4111-8111-111111111111';
const ids = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
];
const origin = 'https://seed-owned.example.invalid';
const runtime = () => ({
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  STAGING_DATABASE_ONLY: 'false',
  SITE_ORIGIN: origin,
  DATABASE_URI: 'postgresql://seed_role:unlogged-test-password@127.0.0.1:5432/seed_stage',
  MEDIA_STORAGE_DRIVER: 'r2',
  MEDIA_BUCKET: 'seed-owned-bucket',
  R2_BUCKET: 'seed-owned-bucket',
  R2_MEDIA_PREFIX: 'portfolio/staging-owned',
  PUBLIC_SITE_ENABLED: 'false',
  PUBLICATION_RETRIES_ENABLED: 'false',
  PUBLICATION_RETRY_WORKER_ENABLED: 'false',
  PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
  PAYLOAD_SECRET: 'not-an-operator-output-secret',
  R2_SECRET_ACCESS_KEY: 'not-an-operator-output-key',
});
const editor = () => ({
  LOCAL_EDITOR_EMAIL: 'editor@example.invalid',
  LOCAL_EDITOR_PASSWORD: 'unlogged-editor-password',
});
const receipt = () => ({
  version: 1,
  environment: 'staging',
  status: 'initialized',
  database: 'seed_stage',
  origin,
  editorId,
  migrations: 16,
  freshProvisioning: true,
  structural: ['professional-profiles', 'site-navigation'].flatMap((collection, index) =>
    ['pt', 'en'].map((locale, second) => ({
      collection,
      locale,
      id: ids[index * 2 + second],
      updatedAt: '2026-11-05T00:00:00.000Z',
    })),
  ),
});
const settings = () => stagingSeedSettings(runtime(), editor(), receipt(), 'seed_stage');
const unusedClient = () => ({
  login: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
  list: vi.fn(),
  document: vi.fn(),
  confirm: vi.fn(),
  update: vi.fn(),
  mediaBytes: vi.fn(),
});
const response = (body: unknown, headers = {}, status = 200) => ({
  status,
  headers,
  bytes: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
});

describe('staging seed preflight', () => {
  it('binds the exact origin, database, editor and media namespace without exporting runtime secrets', () => {
    const value = settings();
    expect(value).toMatchObject({ origin, database: 'seed_stage', editorId });
    expect(value.baselines.size).toBe(4);
    expect(JSON.stringify(value)).not.toContain(runtime().PAYLOAD_SECRET);
    expect(JSON.stringify(value)).not.toContain(runtime().R2_SECRET_ACCESS_KEY);
    expect(JSON.stringify(newSeedState(value))).not.toContain(editor().LOCAL_EDITOR_PASSWORD);
  });
  it.each(['local', 'production', 'test'])('refuses APP_ENV=%s', (app) => {
    expect(() =>
      stagingSeedSettings({ ...runtime(), APP_ENV: app }, editor(), receipt(), 'seed_stage'),
    ).toThrow(StagingSeedError);
  });
  it.each([
    'PUBLIC_SITE_ENABLED',
    'PUBLICATION_RETRIES_ENABLED',
    'PUBLICATION_RETRY_WORKER_ENABLED',
    'PUBLICATION_HTTP_VERIFICATION_ENABLED',
  ])('refuses active %s', (field) => {
    expect(() =>
      stagingSeedSettings({ ...runtime(), [field]: 'true' }, editor(), receipt(), 'seed_stage'),
    ).toThrow('private-initial-runtime-required');
  });
  it('refuses the PG-only phase and unconfirmed/foreign databases', () => {
    expect(() =>
      stagingSeedSettings(
        { ...runtime(), STAGING_DATABASE_ONLY: 'true' },
        editor(),
        receipt(),
        'seed_stage',
      ),
    ).toThrow('application-mode-required');
    expect(() => stagingSeedSettings(runtime(), editor(), receipt(), 'another_database')).toThrow(
      'database-confirmation-required',
    );
    expect(() =>
      stagingSeedSettings(
        {
          ...runtime(),
          DATABASE_URI: 'postgresql://seed:password@production.example.invalid/seed_stage',
        },
        editor(),
        receipt(),
        'seed_stage',
      ),
    ).toThrow('embedded-database-required');
  });
  it('refuses plain HTTP, panel origins and changed initialization receipts', () => {
    expect(() =>
      stagingSeedSettings(
        { ...runtime(), SITE_ORIGIN: 'http://seed.example.invalid' },
        editor(),
        receipt(),
        'seed_stage',
      ),
    ).toThrow('private-https-origin-required');
    expect(() =>
      stagingSeedSettings(
        { ...runtime(), SITE_ORIGIN: 'https://panel.joeldorosarioo.dev' },
        editor(),
        receipt(),
        'seed_stage',
      ),
    ).toThrow('application-origin-required');
    expect(() =>
      stagingSeedSettings(
        runtime(),
        editor(),
        { ...receipt(), origin: 'https://foreign.example.invalid' },
        'seed_stage',
      ),
    ).toThrow('initialization-receipt-required');
  });
  it('requires an explicit complete staging editor pair when either override is selected', () => {
    expect(() =>
      stagingSeedSettings(
        runtime(),
        { ...editor(), STAGING_EDITOR_EMAIL: 'other@example.invalid' },
        receipt(),
        'seed_stage',
      ),
    ).toThrow('editor-credentials-required');
    expect(
      stagingSeedSettings(
        runtime(),
        {
          ...editor(),
          STAGING_EDITOR_EMAIL: 'other@example.invalid',
          STAGING_EDITOR_PASSWORD: 'other-password',
        },
        receipt(),
        'seed_stage',
      ).email,
    ).toBe('other@example.invalid');
  });
  it('does not adopt preexisting content without a fresh initialization receipt', () => {
    expect(() => newSeedState({ ...settings(), freshProvisioning: false })).toThrow(
      'fresh-initialization-required',
    );
  });
  it('refuses unreviewed plans before their contents can be used', () => {
    expect(() =>
      validateApprovedPlan(Buffer.from('changed'), { media: [], documents: [] }),
    ).toThrow('unreviewed-plan');
  });
});

describe('Native staging HTTP authentication and writes', () => {
  it('checks CORS on the target before sending any credential and authenticates the initialized editor', async () => {
    const calls: Array<{ method: string; pathname: string; options: Record<string, unknown> }> = [];
    const send = vi.fn(async (method, pathname, options) => {
      calls.push({ method, pathname, options });
      if (method === 'OPTIONS')
        return response(undefined, { 'access-control-allow-origin': origin }, 204);
      if (pathname === '/api/users/login')
        return response(
          { user: { id: editorId } },
          { 'set-cookie': ['payload-token=synthetic-session; HttpOnly; Secure; SameSite=Lax'] },
        );
      return response({ user: { id: editorId } });
    });
    const client = new NativeSeedClient(settings(), send);
    await client.login();
    expect(calls.map((call) => [call.method, call.pathname])).toEqual([
      ['OPTIONS', '/api/users/login'],
      ['POST', '/api/users/login'],
      ['GET', '/api/users/me'],
    ]);
    expect(calls[0].options.body).toBeUndefined();
    expect(calls[1].options.headers).toMatchObject({ origin });
    expect(calls[2].options.headers).toMatchObject({ cookie: 'payload-token=synthetic-session' });
    await client.logout();
    expect(calls.map((call) => call.pathname)).toEqual([
      '/api/users/login',
      '/api/users/login',
      '/api/users/me',
      '/api/users/logout',
    ]);
    expect(calls.some((call) => /forgot|reset|invite|email/i.test(call.pathname))).toBe(false);
  });
  it('does not transmit credentials when the forwarded service advertises a different origin', async () => {
    const send = vi.fn(async (method: string) => {
      expect(method).toBe('OPTIONS');
      return response(
        undefined,
        { 'access-control-allow-origin': 'https://foreign.example.invalid' },
        204,
      );
    });
    await expect(new NativeSeedClient(settings(), send).login()).rejects.toThrow(
      'cors-target-mismatch',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('OPTIONS');
  });
  it('refuses a successful login for a different initialized user', async () => {
    const send = vi.fn(async (method) =>
      method === 'OPTIONS'
        ? response(undefined, { 'access-control-allow-origin': origin }, 204)
        : response(
            { user: { id: ids[0] } },
            { 'set-cookie': ['payload-token=synthetic-session; Secure'] },
          ),
    );
    await expect(new NativeSeedClient(settings(), send).login()).rejects.toThrow(
      'editor-identity-mismatch',
    );
    expect(send.mock.calls.at(-1)?.slice(0, 2)).toEqual(['POST', '/api/users/logout']);
  });
  it('uses lease and revision headers and releases the lease after a failed patch', async () => {
    const client = new NativeSeedClient(settings());
    const calls: Array<{ method: string; pathname: string; options: unknown }> = [];
    vi.spyOn(client, 'request').mockImplementation(async (method, pathname, options) => {
      calls.push({ method, pathname, options });
      if (method === 'POST' && options?.data?.action === 'acquire')
        return { editable: true, revision: 'owned-revision', token: 'owned-lease' };
      if (method === 'GET') return { _status: 'draft', updatedAt: '2026-11-05T00:00:00.000Z' };
      if (method === 'PATCH') throw new StagingSeedError('native-request', 503);
      return {};
    });
    await expect(
      client.update(
        'professional-profiles',
        ids[0],
        { _status: 'published' },
        '2026-11-05T00:00:00.000Z',
      ),
    ).rejects.toThrow('native-request');
    expect(calls[2]).toMatchObject({
      method: 'PATCH',
      options: {
        headers: { 'x-editorial-revision': 'owned-revision', 'x-editorial-lease': 'owned-lease' },
      },
    });
    expect(calls[3]).toMatchObject({
      method: 'POST',
      options: { data: { action: 'release', token: 'owned-lease' } },
    });
  });
  it('refuses a draft changed before lease acquisition and releases the lease without patching', async () => {
    const client = new NativeSeedClient(settings());
    const api = vi
      .spyOn(client, 'request')
      .mockResolvedValueOnce({ editable: true, revision: 'latest-revision', token: 'owned-lease' })
      .mockResolvedValueOnce({ _status: 'draft', updatedAt: '2026-11-05T01:00:00.000Z' })
      .mockResolvedValueOnce({});
    await expect(
      client.update(
        'professional-profiles',
        ids[0],
        { _status: 'published' },
        '2026-11-05T00:00:00.000Z',
      ),
    ).rejects.toThrow('structural-draft-modified');
    expect(api.mock.calls.some((call) => call[0] === 'PATCH')).toBe(false);
    expect(api.mock.calls.at(-1)).toMatchObject([
      'POST',
      expect.stringContaining('/editorial-lease'),
      { data: { action: 'release', token: 'owned-lease' } },
    ]);
  });
  it('retries only the currently reported publication operation', async () => {
    const client = new NativeSeedClient(settings());
    const api = vi
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        receipt: { operationId: 'owned-operation', state: 'update-pending' },
      })
      .mockResolvedValueOnce({ ok: true, value: { state: 'public' } });
    await client.confirm('cases', ids[0]);
    expect(api.mock.calls[1]).toMatchObject([
      'POST',
      `/api/cases/${ids[0]}/publication-retry`,
      { data: { operationId: 'owned-operation' } },
    ]);
  });
});

function completeScenario() {
  const selected = settings();
  const state = newSeedState(selected);
  const namedId = (number: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(number).padStart(12, '0')}`;
  const roles = [
    'portrait',
    'project01-cover',
    'project02-cover',
    'editorial-desk',
    'editorial-architecture',
    'resume-pt',
    'resume-en',
  ];
  const sourceAssets = roles.map((role, index) => {
    const bytes = Buffer.from(`owned-${role}`);
    return { role, bytes, sha256: sha256(bytes), name: `${index}.png`, type: 'image/png' };
  });
  for (const [index, asset] of sourceAssets.entries())
    state.media[asset.role] = {
      id: namedId(index + 1),
      label: `owned-${asset.role}`,
      sha256: asset.sha256,
    };
  for (const [index, key] of ['case01', 'case02'].entries())
    state.cases[key] = {
      id: namedId(index + 10),
      title: `owned-${key}`,
      updatedAt: '2026-11-05T00:00:00.000Z',
    };
  const documents: Array<{ key: string; collection: string; data: Record<string, unknown> }> = [
    'case01',
    'case02',
  ].map((key, index) => ({
    key,
    collection: 'cases',
    data: { sortOrder: index, featured: index === 0 },
  }));
  for (const locale of ['pt', 'en']) {
    documents.push({
      key: `profile:${locale}`,
      collection: 'professional-profiles',
      data: { locale, identity: {}, home: {}, homeAbout: {}, about: {}, contacts: {}, seo: {} },
    });
    documents.push({
      key: `navigation:${locale}`,
      collection: 'site-navigation',
      data: {
        locale,
        header: { brandLabel: 'Brand' },
        footer: { description: 'Description' },
        controls: { menu: 'Menu' },
        messages: { unavailable: 'Unavailable' },
      },
    });
    for (const key of ['case01', 'case02'])
      documents.push({
        key: `${key}:${locale}`,
        collection: 'case-content',
        data: {
          locale,
          case: { $case: key },
          title: 'Original',
          sections: [
            { blockType: 'paragraph', readingKey: 'intro', text: 'An original sentence.' },
          ],
          seo: {},
        },
      });
  }
  const plan = { documents };
  const nativeDocuments = new Map<string, Record<string, unknown>>();
  for (const [index, spec] of documents.filter((value) => value.collection !== 'cases').entries()) {
    const desired = desiredDocument(spec, plan, state);
    const documentId =
      spec.collection === 'case-content'
        ? namedId(index + 30)
        : selected.baselines.get(`${spec.collection}:${spec.data.locale}`).id;
    const document = { id: documentId, updatedAt: '2026-11-05T00:00:00.000Z', ...desired };
    nativeDocuments.set(spec.key, document);
    state.documents[spec.key] = {
      collection: spec.collection,
      locale: String(spec.data.locale),
      caseId: desired.case,
      hash: contentHash(desired),
      phase: 'complete',
      updatedAt: '2026-11-05T00:00:00.000Z',
      id: documentId,
    };
  }
  const client = {
    login: vi.fn(),
    logout: vi.fn(),
    confirm: vi.fn(),
    update: vi.fn(),
    list: vi.fn(async (collection, where: Record<string, unknown> = {}) => {
      let found: Array<Record<string, unknown>>;
      if (collection === 'media')
        found = Object.values(state.media).map((value) => ({ id: value.id, label: value.label }));
      else if (collection === 'cases')
        found = ['case01', 'case02'].map((key) => ({
          id: state.cases[key].id,
          ...documents.find((value) => value.key === key)!.data,
          internalTitle: state.cases[key].title,
          updatedAt: '2026-11-05T00:00:00.000Z',
        }));
      else found = [...nativeDocuments.values()].filter((value) => value.case);
      return found.filter((value) =>
        Object.entries(where).every(([key, wanted]) => value[key] === wanted),
      );
    }),
    mediaBytes: vi.fn(
      async (documentId) =>
        sourceAssets[Object.values(state.media).findIndex((value) => value.id === documentId)]
          .bytes,
    ),
    document: vi.fn(async (collection, documentId) => {
      if (collection === 'cases') {
        const key = ['case01', 'case02'].find((value) => state.cases[value].id === documentId)!;
        return {
          id: documentId,
          ...documents.find((value) => value.key === key)!.data,
          internalTitle: state.cases[key].title,
          updatedAt: '2026-11-05T00:00:00.000Z',
        };
      }
      return [...nativeDocuments.values()].find((value) => value.id === documentId);
    }),
    request: vi.fn(async (method, pathname) => {
      if (method !== 'GET') throw new StagingSeedError('unexpected-write');
      return {
        status: 200,
        headers: {},
        bytes: Buffer.from(
          `<html><meta name="robots" content="noindex"><link rel="canonical" href="${origin}${pathname}"></html>`,
        ),
      };
    }),
  };
  return {
    settings: selected,
    state,
    assets: sourceAssets,
    plan,
    nativeDocuments,
    client,
    save: vi.fn(),
  };
}

describe('seed ownership and generated demonstration content', () => {
  const assets = () =>
    Array.from({ length: 7 }, (_, index) => {
      const bytes = Buffer.from(`owned-${index}`);
      return {
        role: `role-${index}`,
        bytes,
        sha256: sha256(bytes),
        name: `${index}.png`,
        type: 'image/png',
      };
    });
  it('rejects a checkpoint for a different environment before authentication', async () => {
    const client = unusedClient();
    await expect(
      seedStagingContent({
        settings: settings(),
        plan: {},
        assets: assets(),
        state: { ...newSeedState(settings()), scope: 'different' },
        save: vi.fn(),
        client,
      }),
    ).rejects.toThrow('checkpoint-scope-mismatch');
    expect(client.login).not.toHaveBeenCalled();
  });
  it('checks source bytes before authentication or uploads', async () => {
    const client = unusedClient();
    const source = assets();
    source[0].bytes = Buffer.from('changed');
    await expect(
      seedStagingContent({
        settings: settings(),
        plan: {},
        assets: source,
        state: newSeedState(settings()),
        save: vi.fn(),
        client,
      }),
    ).rejects.toThrow('source-asset-integrity');
    expect(client.login).not.toHaveBeenCalled();
  });
  it('refuses an existing unrelated media library and logs out without a mutation', async () => {
    const client = {
      ...unusedClient(),
      list: vi.fn(async (collection) =>
        collection === 'media' ? [{ id: ids[0], label: 'Other project work' }] : [],
      ),
      request: vi.fn(),
    };
    await expect(
      seedStagingContent({
        settings: settings(),
        plan: {},
        assets: assets(),
        state: newSeedState(settings()),
        save: vi.fn(),
        client,
      }),
    ).rejects.toThrow('unowned-media-present');
    expect(client.request).not.toHaveBeenCalled();
    expect(client.logout).toHaveBeenCalledOnce();
  });
  it('requests depth zero when creating a Native case translation so ownership compares IDs', async () => {
    const scenario = completeScenario();
    const document = scenario.nativeDocuments.get('case01:pt')!;
    scenario.nativeDocuments.delete('case01:pt');
    delete scenario.state.documents['case01:pt'];
    const request = vi.fn(async (method: string, pathname: string) => {
      if (method === 'POST') {
        expect(pathname).toBe('/api/case-content?depth=0');
        scenario.nativeDocuments.set('case01:pt', document);
        return { doc: document };
      }
      return scenario.client.request(method, pathname);
    });
    await expect(
      seedStagingContent({ ...scenario, client: { ...scenario.client, request } }),
    ).resolves.toMatchObject({ documents: 8 });
    expect(request).toHaveBeenCalledWith('POST', '/api/case-content?depth=0', expect.any(Object));
  });
  it('checkpoints the Native case timestamp only after publication confirmation and a fresh read', async () => {
    const scenario = completeScenario();
    const read = scenario.client.document.getMockImplementation()!;
    scenario.client.document.mockImplementation(async (collection, documentId) => {
      const document = await read(collection, documentId);
      return collection === 'cases'
        ? { ...document, updatedAt: '2026-11-05T00:00:02.000Z' }
        : document;
    });
    await seedStagingContent(scenario);
    expect(scenario.state.cases.case01.updatedAt).toBe('2026-11-05T00:00:02.000Z');
    expect(scenario.client.confirm.mock.invocationCallOrder[0]).toBeLessThan(
      scenario.client.document.mock.invocationCallOrder[0],
    );
  });
  it('replays completed owned content without a write, reset, invitation or e-mail request', async () => {
    const scenario = completeScenario();
    const result = await seedStagingContent(scenario);
    expect(result).toMatchObject({ media: 7, caseIdentities: 2, documents: 8, publicRoutes: 10 });
    expect(scenario.client.update).not.toHaveBeenCalled();
    expect(
      scenario.client.request.mock.calls.every(
        (call) => call[0] === 'GET' && !/forgot|reset|invite|email/i.test(call[1]),
      ),
    ).toBe(true);
    expect(scenario.client.logout).toHaveBeenCalledOnce();
  });
  it('refuses to confirm a later editor change outside its content projection', async () => {
    const scenario = completeScenario();
    Object.assign(scenario.nativeDocuments.get('profile:pt')!, {
      updatedAt: '2026-11-05T01:00:00.000Z',
      optionalEditorialField: 'An editorial addition',
    });
    await expect(seedStagingContent(scenario)).rejects.toThrow('owned-document-modified');
    expect(scenario.client.update).not.toHaveBeenCalled();
    expect(scenario.client.logout).toHaveBeenCalledOnce();
  });
  it('refuses to overwrite a structural draft changed after controlled initialization', async () => {
    const scenario = completeScenario();
    delete scenario.state.documents['profile:pt'];
    Object.assign(scenario.nativeDocuments.get('profile:pt')!, {
      _status: 'draft',
      updatedAt: '2026-11-05T01:00:00.000Z',
      identity: { name: 'An editorial change' },
    });
    await expect(seedStagingContent(scenario)).rejects.toThrow('structural-draft-modified');
    expect(scenario.client.update).not.toHaveBeenCalled();
    expect(scenario.client.logout).toHaveBeenCalledOnce();
  });
  it('generates explicit demo PDFs instead of a fabricated professional history', () => {
    const pdf = createDemoPdf('pt').toString();
    expect(pdf).toContain('%PDF-1.4');
    expect(pdf).toContain('Curriculo demonstrativo. Conteudo temporario.');
    expect(pdf).toContain('xref');
    expect(createDemoPdf('en').toString()).toContain('Sample resume. Temporary content.');
  });
  it('builds locale-specific metadata and leaves the input fixture untouched', () => {
    const spec = {
      key: 'case01:pt',
      collection: 'case-content',
      data: {
        locale: 'pt',
        case: { $case: 'case01' },
        title: 'An original title',
        slug: 'old',
        sections: [
          { blockType: 'paragraph', readingKey: 'intro', text: 'An original section body.' },
        ],
      },
    };
    const state = { cases: { case01: { id: ids[0] } }, media: {} };
    const desired = desiredDocument(spec, { documents: [] }, state);
    expect(desired).toMatchObject({
      locale: 'pt',
      case: ids[0],
      slug: 'lorem-ipsum-01',
      title: 'Lorem ipsum',
      _status: 'published',
      seo: { title: 'Case demonstrativo 01 | Lorem ipsum | PT' },
    });
    expect(JSON.stringify(desired)).not.toContain('An original');
    expect(spec.data.title).toBe('An original title');
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });
});
