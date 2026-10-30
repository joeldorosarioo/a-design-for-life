import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleNextImage } from './next-image-proxy';
import { installPayloadProvider } from '@/helpers/payload/runtime';

const id = '11111111-1111-4111-8111-111111111111';
const source = `/media/${id}/original`;
const query = `url=${encodeURIComponent(source)}&w=64&q=75`;
const secret = 'Synthetic-next-image-server-secret-123456789';
const authHeader = 'x-portfolio-image-authorization';
let directory: string;
let internalOrigin: string;
let server: Server;
let received: IncomingMessage[];
let respond: (request: IncomingMessage, response: ServerResponse) => void;
const bytes = Buffer.from('Synthetic HTTP representation; this is not a Next optimizer proof');

async function root(kind: 'image' | 'pdf' | 'revoked' = 'image') {
  const object = { key: 'a'.repeat(64), sha256: 'a'.repeat(64), byteLength: 100 };
  await writeFile(
    path.join(directory, 'current.json'),
    JSON.stringify({
      generation: randomUUID(),
      subjects: {
        'case-content/synthetic': {
          operationId: 'synthetic-operation',
          targetRevision: '1',
          value: {
            media:
              kind === 'revoked'
                ? []
                : [
                    {
                      id,
                      manifest: {
                        revision: randomUUID(),
                        kind,
                        original: {
                          variant: 'original',
                          object,
                          type: kind === 'pdf' ? 'application/pdf' : 'image/png',
                          width: 80,
                          height: 60,
                        },
                        variants: [],
                      },
                    },
                  ],
          },
        },
      },
    }),
  );
}
function context() {
  return { publicationDirectory: directory, internalOrigin, secret };
}
function request(search = query, init?: RequestInit) {
  return new Request(`https://untrusted-host.invalid/_next/image?${search}`, init);
}
async function denied(response: Response | null, status: number) {
  expect(response).not.toBeNull();
  expect(response!.status).toBe(status);
  expect(response!.headers.get('cache-control')).toBe('private, no-store');
  expect(await response!.text()).toBe('');
}

beforeEach(async () => {
  installPayloadProvider(async () => {
    throw new Error('Synthetic unavailable Native metadata origin');
  });
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-next-image-'));
  received = [];
  respond = (_, response) => {
    response.writeHead(200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=14400',
      'X-Nextjs-Cache': 'HIT',
      'Content-Length': String(bytes.byteLength),
      'Set-Cookie': 'private=must-not-leak',
      'X-Synthetic-Private': secret,
      ETag: '"synthetic-output"',
    });
    response.end(bytes);
  };
  server = createServer((req, res) => {
    received.push(req);
    respond(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTP address');
  internalOrigin = `http://127.0.0.1:${address.port}`;
  await root();
});
afterEach(async () => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(directory, { recursive: true, force: true });
});

it('wraps a public representation with no-store and forwards only signed Accept to the trusted origin', async () => {
  const response = await handleNextImage(
    request(query, {
      headers: {
        accept: 'image/webp',
        cookie: 'private-session',
        authorization: 'Bearer private',
        range: 'bytes=0-1',
        'if-none-match': '"old"',
        'if-modified-since': 'Wed, 21 Oct 2015 07:28:00 GMT',
        'x-forwarded-host': 'attacker.invalid',
      },
    }),
    context(),
  );
  expect(response!.status).toBe(200);
  expect(Buffer.from(await response!.arrayBuffer())).toEqual(bytes);
  expect(response!.headers.get('cache-control')).toBe('private, no-store');
  expect(response!.headers.get('x-nextjs-cache')).toBe('HIT');
  expect(response!.headers.get('content-type')).toBe('image/webp');
  for (const header of [
    'set-cookie',
    authHeader,
    'x-synthetic-private',
    'content-length',
    'content-encoding',
  ])
    expect(response!.headers.has(header)).toBe(false);
  expect(received).toHaveLength(1);
  expect(received[0].url).toBe(`/_next/image?${query}`);
  expect(received[0].method).toBe('GET');
  expect(received[0].headers.accept).toBe('image/webp');
  expect(received[0].headers.host).toBe(new URL(internalOrigin).host);
  expect(received[0].headers[authHeader]).toMatch(/^\d{10}\.[a-f0-9]{64}$/);
  for (const header of [
    'cookie',
    'authorization',
    'range',
    'if-none-match',
    'if-modified-since',
    'x-forwarded-host',
  ])
    expect(received[0].headers[header]).toBeUndefined();
});

it('rechecks the root for an authenticated inner request and stays unavailable without Native classification', async () => {
  const response = await handleNextImage(
    request(query, { headers: { accept: 'image/webp' } }),
    context(),
  );
  await response!.arrayBuffer();
  const headers = { accept: 'image/webp', [authHeader]: String(received[0].headers[authHeader]) };
  expect(await handleNextImage(request(query, { headers }), context())).toBeNull();
  await root('revoked');
  await denied(await handleNextImage(request(query, { headers }), context()), 503);
  await denied(await handleNextImage(request(), context()), 503);
  expect(received).toHaveLength(1);
});

it.each([
  'url=%2Fpreview-media%2F11111111-1111-4111-8111-111111111111%2Foriginal&w=64&q=75',
  'url=%2Fmedia%2F11111111-1111-4111-8111-111111111111%2Fw640&w=64&q=75',
  'url=https%3A%2F%2Fexternal.invalid%2Fa.png&w=64&q=75',
  `url=${encodeURIComponent(source + '?preview=1')}&w=64&q=75`,
  `url=${encodeURIComponent(source + '#fragment')}&w=64&q=75`,
  `url=${encodeURIComponent(source.replace('/media/', '/media/%2f'))}&w=64&q=75`,
  `url=${encodeURIComponent(source.replace(id, 'not-a-uuid'))}&w=64&q=75`,
  `${query}&url=${encodeURIComponent(source)}`,
  `${query}&w=96`,
  `${query}&q=75`,
  `${query}&unknown=1`,
  query.replace('w=64', 'w=65'),
  query.replace('w=64', 'w=064'),
  query.replace('q=75', 'q=80'),
  query.replace('q=75', 'q=075'),
])('rejects an unapproved or ambiguous optimizer query without fetching: %s', async (search) => {
  await denied(await handleNextImage(request(search), context()), 400);
  expect(received).toHaveLength(0);
});

it('does not authorize a PDF original as an optimized image', async () => {
  await root('pdf');
  await denied(await handleNextImage(request(), context()), 404);
  expect(received).toHaveLength(0);
});

it.each(['missing', 'corrupt', 'wrong-media-schema'])(
  'fails closed when the confirmed root is %s',
  async (kind) => {
    if (kind === 'missing') await rm(path.join(directory, 'current.json'));
    else
      await writeFile(
        path.join(directory, 'current.json'),
        kind === 'corrupt'
          ? '{broken'
          : JSON.stringify({
              generation: randomUUID(),
              subjects: { a: { operationId: 'a', targetRevision: '1', value: { media: [{}] } } },
            }),
      );
    await denied(await handleNextImage(request(), context()), 503);
    expect(received).toHaveLength(0);
  },
);

it('does not send bytes for HEAD and uses an authenticated GET internally', async () => {
  const response = await handleNextImage(request(query, { method: 'HEAD' }), context());
  expect(response!.status).toBe(200);
  expect(await response!.text()).toBe('');
  expect(received[0].method).toBe('GET');
});

it.each([
  'http://external.invalid',
  'https://127.0.0.1',
  'http://127.0.0.1/other',
  'http://user:pass@127.0.0.1',
  'http://127.0.0.1?x=1',
])('fails closed for an untrusted internal origin %s', async (origin) => {
  await denied(await handleNextImage(request(), { ...context(), internalOrigin: origin }), 503);
  expect(received).toHaveLength(0);
});

it('rejects a forged or modified inner signature without fetching', async () => {
  await denied(
    await handleNextImage(request(query, { headers: { [authHeader]: 'attacker' } }), context()),
    404,
  );
  const response = await handleNextImage(
    request(query, { headers: { accept: 'image/webp' } }),
    context(),
  );
  await response!.arrayBuffer();
  const headers = { accept: 'image/avif', [authHeader]: String(received[0].headers[authHeader]) };
  await denied(await handleNextImage(request(query, { headers }), context()), 404);
  headers.accept = 'image/webp';
  await denied(
    await handleNextImage(request(query.replace('w=64', 'w=96'), { headers }), context()),
    404,
  );
  await denied(await handleNextImage(request(query, { method: 'HEAD', headers }), context()), 404);
  expect(received).toHaveLength(1);
});

it('rejects expired and excessively future inner signatures', async () => {
  const expires = Math.floor(Date.now() / 1000) - 1;
  for (const timestamp of [expires, expires + 3600]) {
    const signature = createHmac('sha256', secret)
      .update(`portfolio-next-image-v1\n${timestamp}\nGET\n${query}\nimage/webp`)
      .digest('hex');
    await denied(
      await handleNextImage(
        request(query, {
          headers: { accept: 'image/webp', [authHeader]: `${timestamp}.${signature}` },
        }),
        context(),
      ),
      404,
    );
  }
  expect(received).toHaveLength(0);
});

it.each([302, 304, 500, 200])(
  'sanitizes a failed or invalid upstream %s response',
  async (status) => {
    respond = (_, response) => {
      response.writeHead(status, {
        Location: 'http://external.invalid/',
        'Content-Type': 'text/plain',
      });
      response.end('private server diagnostic');
    };
    await denied(await handleNextImage(request(), context()), 503);
  },
);

it('returns an empty uncached upstream 404 without leaking its diagnostic body', async () => {
  respond = (_, response) => {
    response.writeHead(404);
    response.end('private diagnostic');
  };
  await denied(await handleNextImage(request(), context()), 404);
});

it('turns timeout while consuming the body into a safe no-store 503', async () => {
  respond = (_, response) => {
    response.writeHead(200, { 'Content-Type': 'image/webp' });
    response.flushHeaders();
  };
  await denied(await handleNextImage(request(), { ...context(), timeoutMs: 25 }), 503);
});

it('returns no-store 503 for an aborted outer request', async () => {
  const controller = new AbortController();
  controller.abort();
  await denied(
    await handleNextImage(request(query, { signal: controller.signal }), context()),
    503,
  );
});

it('rejects unsupported methods before touching the optimizer', async () => {
  await denied(await handleNextImage(request(query, { method: 'POST' }), context()), 405);
  expect(received).toHaveLength(0);
});

it('does not classify an absent image as404 without a healthy Native metadata origin', async () => {
  await denied(
    await handleNextImage(
      request(query.replace(id, '22222222-2222-4222-8222-222222222222')),
      context(),
    ),
    503,
  );
  expect(received).toHaveLength(0);
});

it('keeps allowlists aligned with a separately configured optimizer', async () => {
  await denied(
    await handleNextImage(request(), { ...context(), widths: [342], qualities: [80] }),
    400,
  );
  const response = await handleNextImage(request(query.replace('w=64&q=75', 'w=342&q=80')), {
    ...context(),
    widths: [342],
    qualities: [80],
  });
  expect(response!.status).toBe(200);
  await response!.arrayBuffer();
  expect(received[0].url).toBe(`/_next/image?url=${encodeURIComponent(source)}&w=342&q=80`);
});

it('does not use an empty or short server secret', async () => {
  await denied(await handleNextImage(request(), { ...context(), secret: 'short' }), 503);
  expect(received).toHaveLength(0);
});

it('keeps missing media unavailable when the Native classification origin cannot run', async () => {
  installPayloadProvider(async () => {
    throw new Error('Synthetic private Native diagnostic');
  });
  await root('revoked');
  await denied(await handleNextImage(request(), context()), 503);
  expect(received).toHaveLength(0);
});
