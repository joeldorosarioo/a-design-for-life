import { execFile } from 'node:child_process';
import { createServer, type RequestListener, type Server } from 'node:http';
import { promisify } from 'node:util';
import path from 'node:path';
import { expect, it } from 'vitest';

const run = promisify(execFile);

async function withServer(
  handle: RequestListener,
  exercise: (port: number, server: Server) => Promise<void>,
) {
  const server = createServer(handle);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected owned loopback port.');
    await exercise(address.port, server);
  } finally {
    const done = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server.closeAllConnections();
    await done;
  }
}

async function probe(port: number, overrides: Record<string, string> = {}) {
  const env = {
    ...process.env,
    NODE_OPTIONS: '',
    NODE_USE_ENV_PROXY: '0',
    PORT: String(port),
    ...overrides,
  };
  try {
    const output = await run(process.execPath, [path.resolve('ops/image/health-probe.mjs')], {
      env,
      timeout: 8_000,
    });
    return { ...output, status: 0 };
  } catch (error) {
    const failed = error as { code?: number | string; stdout?: string; stderr?: string };
    return { status: failed.code, stdout: failed.stdout, stderr: failed.stderr };
  }
}

it('uses the container loopback listener even when Node enables an ambient HTTP proxy', async () => {
  const requests: string[] = [];
  let proxyConnections = 0;
  await withServer(
    (request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"status":"ready"}');
    },
    async (port) => {
      await withServer(
        (_request, response) => response.end('unexpected proxy'),
        async (proxyPort, proxyServer) => {
          proxyServer.on('connection', () => {
            proxyConnections++;
          });
          proxyServer.on('connect', (_request, socket) =>
            socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'),
          );
          const origin = `http://127.0.0.1:${proxyPort}`;
          const result = await probe(port, {
            NODE_USE_ENV_PROXY: '1',
            HTTP_PROXY: origin,
            http_proxy: origin,
            NO_PROXY: '',
            no_proxy: '',
          });
          expect({ requests, proxyConnections }).toEqual({
            requests: ['GET /health'],
            proxyConnections: 0,
          });
          expect(result).toEqual({ status: 0, stdout: '', stderr: '' });
        },
      );
    },
  );
});

it.each([
  [503, 'application/json', '{"status":"ready"}'],
  [200, 'application/json', '{"status":"ready","dependency":"extra"}'],
  [200, 'text/html', '{"status":"ready"}'],
  [200, 'application/json', `{"status":"ready"${' '.repeat(520)}}`],
] as const)('rejects invalid readiness responses silently (%#)', async (status, type, body) => {
  await withServer(
    (_request, response) => {
      response.writeHead(status, { 'Content-Type': type });
      response.end(body);
    },
    async (port) => {
      expect(await probe(port)).toEqual({ status: 1, stdout: '', stderr: '' });
    },
  );
});

it('rejects database-only readiness in production without contacting the web listener', async () => {
  let requests = 0;
  await withServer(
    (_request, response) => {
      requests++;
      response.end('unexpected');
    },
    async (port) => {
      const result = await probe(port, {
        APP_ENV: 'production',
        PUBLIC_SITE_ENABLED: 'false',
        STAGING_DATABASE_ONLY: 'true',
      });
      expect(result).toEqual({ status: 1, stdout: '', stderr: '' });
      expect(requests).toBe(0);
    },
  );
});
