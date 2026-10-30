import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as payloadModule from 'payload';
import type { PayloadRequest } from 'payload';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { mediaResponse, nativeMediaFile, serveMedia } from './media-response';

const origin = 'http://127.0.0.1:3101';
const mediaId = 'd6f3fa80-cb87-4dc4-8ecb-01b084343ee1';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function expectUnavailable(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(await response.text()).toBe('');
}

it.each(['GET', 'HEAD'])(
  'returns a safe uncached 503 when media preparation fails for %s',
  async (method) => {
    installPayloadProvider(async () => {
      throw new Error('Synthetic internal storage path and diagnostic must stay private');
    });
    const response = await serveMedia(
      { mediaId, variant: 'original', preview: false },
      new Request(`${origin}/media/${mediaId}/original`, { method }),
    );
    await expectUnavailable(response);
  },
);

it.each(['GET', 'HEAD'])(
  'returns a safe uncached 503 when preview authentication fails for %s',
  async (method) => {
    const payload = new payloadModule.BasePayload();
    Object.assign(payload, { config: { serverURL: origin } });
    vi.spyOn(payload, 'auth').mockRejectedValueOnce(new Error('Synthetic private auth diagnostic'));
    installPayloadProvider(async () => payload);
    await expectUnavailable(
      await serveMedia(
        { mediaId, variant: 'original', preview: true },
        new Request(`${origin}/preview-media/${mediaId}/original`, { method }),
      ),
    );
  },
);

it('returns a safe uncached 503 when native request preparation fails', async () => {
  const payload = new payloadModule.BasePayload();
  Object.defineProperty(payload, 'config', {
    get() {
      throw new Error('Synthetic private request diagnostic');
    },
  });
  installPayloadProvider(async () => payload);
  await expectUnavailable(
    await serveMedia(
      { mediaId, variant: 'original', preview: false },
      new Request(`${origin}/media/${mediaId}/original`),
    ),
  );
});

it.each(['GET', 'HEAD'])(
  'returns a safe uncached 503 when native filename lookup fails for %s',
  async (method) => {
    // Only the HTTP failure contract is under test. Real DB isolation and authorization
    // are exercised by the colocated integration/E2E suites, never this failure double.
    const req = {
      method,
      user: { collection: 'users' },
      payload: {
        db: {
          findOne: async () => {
            throw new Error('Synthetic private lookup diagnostic');
          },
        },
      },
    } as unknown as PayloadRequest;
    await expectUnavailable(await nativeMediaFile(req, 'synthetic.png'));
  },
);

it('preserves the preview 401 response for an untrusted origin', async () => {
  const payload = new payloadModule.BasePayload();
  Object.assign(payload, { config: { serverURL: origin } });
  installPayloadProvider(async () => payload);
  const response = await serveMedia(
    { mediaId, variant: 'original', preview: true },
    new Request(`${origin}/preview-media/${mediaId}/original`, {
      headers: { origin: 'https://untrusted.invalid' },
    }),
  );
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toBe('');
});

it('preserves the native 403 response without a user', async () => {
  const response = await nativeMediaFile({ user: null } as PayloadRequest, 'synthetic.png');
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('preserves the 404 response for an invalid media identifier without reading storage', async () => {
  const response = await mediaResponse(
    { mediaId: 'invalid-id', variant: 'original', preview: false },
    {} as PayloadRequest,
  );
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
