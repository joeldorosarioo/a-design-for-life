import { createServer, type RequestListener } from 'node:http';
import { expect, it } from 'vitest';
import { assertServedPublication, type PublicObservation } from './publication-http-verification';
import { publicGenerationHeader } from './public-generation-header';

const generation = '58cb2140-47e5-4fc5-9a33-98ab8bfba3b1';
const document = { title: 'Revisão pública confirmada' };
const observation: PublicObservation = {
  path: '/api/case-content/published/pt',
  status: 200,
  matches(bytes, headers) {
    return (
      headers.get('content-type') === 'application/json' &&
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).title === document.title
    );
  },
};

async function withServer(
  listener: RequestListener,
  verify: (origin: string, server: ReturnType<typeof createServer>) => Promise<void>,
) {
  const server = createServer(listener);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback address.');
    await verify(`http://127.0.0.1:${address.port}`, server);
  } finally {
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server.closeAllConnections();
    await closed;
  }
}

it('confirms the expected generation and complete public JSON through an anonymous GET', async () => {
  const requests: unknown[] = [];
  await withServer(
    (request, response) => {
      requests.push({
        method: request.method,
        path: request.url,
        cookie: request.headers.cookie,
        authorization: request.headers.authorization,
      });
      response.writeHead(200, {
        [publicGenerationHeader]: generation,
        'Content-Type': 'application/json',
      });
      response.write('{"title":"Revisão');
      response.end(' pública confirmada"}');
    },
    async (origin) => {
      await expect(
        assertServedPublication({ origin, generation, observations: [observation] }),
      ).resolves.toBeUndefined();
    },
  );
  expect(requests).toEqual([
    { method: 'GET', path: observation.path, cookie: undefined, authorization: undefined },
  ]);
});

it.each([
  { status: 503, marker: generation, body: JSON.stringify(document) },
  { status: 200, marker: 'wrong-generation', body: JSON.stringify(document) },
  { status: 200, marker: generation, body: '{"title":"Previous content"}' },
  { status: 200, marker: generation, body: '{"title":' },
])(
  'refuses a completed response that differs from the public observation %#',
  async ({ status, marker, body }) => {
    let requests = 0;
    await withServer(
      (_request, response) => {
        requests++;
        response.writeHead(status, {
          [publicGenerationHeader]: marker,
          'Content-Type': 'application/json',
        });
        response.end(body);
      },
      async (origin) => {
        await expect(
          assertServedPublication({ origin, generation, observations: [observation] }),
        ).rejects.toThrow('Public HTTP verification failed.');
      },
    );
    expect(requests).toBe(1);
  },
);

it('checks the exact expected redirect and never follows it', async () => {
  const requests: (string | undefined)[] = [];
  await withServer(
    (request, response) => {
      requests.push(request.url);
      response.writeHead(308, {
        [publicGenerationHeader]: generation,
        Location: '/pt/cases/current',
      });
      response.end();
    },
    async (origin) => {
      const redirect: PublicObservation = {
        path: '/pt/cases/former',
        status: 308,
        matches: (_body, headers) => headers.get('location') === '/pt/cases/current',
      };
      await assertServedPublication({ origin, generation, observations: [redirect] });
      await expect(
        assertServedPublication({
          origin,
          generation,
          observations: [{ ...redirect, matches: () => false }],
        }),
      ).rejects.toThrow('Public HTTP verification failed.');
    },
  );
  expect(requests).toEqual(['/pt/cases/former', '/pt/cases/former']);
});

it.each([
  '//foreign.test/pt',
  '/pt/../private',
  '/pt%2fprivate',
  '/pt?preview=1',
  '/pt\\private',
  '/pt#foo',
])('rejects unsafe paths before issuing any request for the plan (%s)', async (path) => {
  let requests = 0;
  await withServer(
    (_request, response) => {
      requests++;
      response.end();
    },
    async (origin) => {
      await expect(
        assertServedPublication({
          origin,
          generation,
          observations: [observation, { ...observation, path }],
        }),
      ).rejects.toThrow('Unsafe public HTTP verification plan.');
    },
  );
  expect(requests).toBe(0);
});

it.each([
  'https://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.1:3000',
  'http://127.0.0.1:3000/path',
  'http://user@127.0.0.1:3000',
])('refuses unsafe or ambiguous verification origins (%s)', async (origin) => {
  await expect(
    assertServedPublication({ origin, generation, observations: [observation] }),
  ).rejects.toThrow('Unsafe public HTTP verification plan.');
});

it('bounds the complete body and rejects a transport interruption after matching headers', async () => {
  const plan = { generation, observations: [{ ...observation, matches: () => true }] };
  await withServer(
    (_request, response) => {
      response.writeHead(200, { [publicGenerationHeader]: generation });
      response.write(Buffer.alloc(40));
      response.end(Buffer.alloc(40));
    },
    async (origin) => {
      await expect(assertServedPublication({ ...plan, origin, maxBodyBytes: 64 })).rejects.toThrow(
        'Public HTTP verification failed.',
      );
    },
  );
  await withServer(
    (_request, response) => {
      response.writeHead(200, { [publicGenerationHeader]: generation, 'Content-Length': 90 });
      response.write('short', () => response.destroy());
    },
    async (origin) => {
      await expect(assertServedPublication({ ...plan, origin })).rejects.toThrow(
        'Public HTTP verification failed.',
      );
    },
  );
});

it('applies one deadline even if the headers arrive and the body never finishes', async () => {
  let started = false;
  await withServer(
    (_request, response) => {
      response.writeHead(200, { [publicGenerationHeader]: generation });
      response.write('incomplete', () => {
        started = true;
      });
    },
    async (origin) => {
      await expect(
        assertServedPublication({
          origin,
          generation,
          observations: [observation],
          timeoutMs: 400,
        }),
      ).rejects.toThrow('Public HTTP verification failed.');
    },
  );
  expect(started).toBe(true);
});

it('requires a nonempty, bounded set of observations before requesting the origin', async () => {
  let requests = 0;
  await withServer(
    (_request, response) => {
      requests++;
      response.end();
    },
    async (origin) => {
      for (const observations of [[], Array.from({ length: 65 }, () => observation)]) {
        await expect(assertServedPublication({ origin, generation, observations })).rejects.toThrow(
          'Unsafe public HTTP verification plan.',
        );
      }
    },
  );
  expect(requests).toBe(0);
});

it('keeps HTTP verification on the selected loopback socket when Node enables an ambient proxy', async () => {
  const { promisify } = await import('node:util');
  const { execFile } = await import('node:child_process');
  let served = 0;
  let proxied = 0;
  let child: unknown;
  await withServer(
    (_request, response) => {
      served++;
      response.writeHead(200, { [publicGenerationHeader]: generation });
      response.end('direct');
    },
    async (origin) => {
      await withServer(
        (_request, response) => response.end('unexpected proxy'),
        async (proxyOrigin, proxyServer) => {
          proxyServer.on('connection', () => {
            proxied++;
          });
          proxyServer.on('connect', (_request, socket) =>
            socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'),
          );
          const source = `
        import { assertServedPublication } from './src/helpers/payload/publication-http-verification.ts';
        await assertServedPublication({
          origin: process.argv[1], generation: process.argv[2], observations: [{
            path: '/pt', status: 200, matches: (body) => new TextDecoder().decode(body) === 'direct',
          }],
        });
      `;
          child = await promisify(execFile)(
            process.execPath,
            [
              '--conditions=react-server',
              '--import',
              'tsx',
              '--input-type=module',
              '--eval',
              source,
              origin,
              generation,
            ],
            {
              timeout: 10_000,
              env: {
                ...process.env,
                NODE_USE_ENV_PROXY: '1',
                HTTP_PROXY: proxyOrigin,
                http_proxy: proxyOrigin,
                NO_PROXY: '',
                no_proxy: '',
              },
            },
          ).catch((error: { code: unknown }) => error);
        },
      );
    },
  );
  expect({ served, proxied }).toEqual({ served: 1, proxied: 0 });
  expect(child).not.toHaveProperty('code');
}, 12_000);

it('validates and dispatches the same plan even if a matcher changes the caller-owned next observation', async () => {
  const requested: (string | undefined)[] = [];
  const next = { ...observation, path: '/pt/cases/expected' };
  const first = {
    ...observation,
    matches: () => {
      next.path = '/pt/cases/unexpected';
      return true;
    },
  };
  await withServer(
    (request, response) => {
      requested.push(request.url);
      response.writeHead(200, {
        [publicGenerationHeader]: generation,
        'Content-Type': 'application/json',
      });
      response.end(JSON.stringify(document));
    },
    async (origin) => {
      await assertServedPublication({ origin, generation, observations: [first, next] });
    },
  );
  expect(requested).toEqual([observation.path, '/pt/cases/expected']);
});

it('counts time spent validating the final completed projection against the same deadline', async () => {
  let matched = false;
  await withServer(
    (_request, response) => {
      response.writeHead(200, { [publicGenerationHeader]: generation });
      response.end('complete');
    },
    async (origin) => {
      const late = {
        ...observation,
        matches() {
          matched = true;
          const end = performance.now() + 450;
          while (performance.now() < end) {
            /* A synchronous consumer can delay timer dispatch. */
          }
          return true;
        },
      };
      await expect(
        assertServedPublication({ origin, generation, observations: [late], timeoutMs: 400 }),
      ).rejects.toThrow('Public HTTP verification failed.');
    },
  );
  expect(matched).toBe(true);
});
