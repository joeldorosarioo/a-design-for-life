import { createServer, request as httpRequest, type Server } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createStagingRelay } from './staging-relay.mjs';

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected loopback TCP listener.');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

it('delivers the upstream representation without exposing the staging credential to the browser', async () => {
  const observed: { method?: string; path?: string; authorization?: string; cookie?: string }[] =
    [];
  const upstream = createServer((request, response) => {
    observed.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
    });
    response
      .writeHead(200, {
        'content-type': 'text/html',
        'content-length': '9',
        'set-cookie': 'upstream_session=private; HttpOnly',
      })
      .end('<p>OK</p>');
  });
  const origin = await listen(upstream);
  const relay = createStagingRelay({ origin, authorization: 'Basic synthetic-credential' });
  const local = await listen(relay);
  try {
    const result = await fetch(local + '/pt?test=1', {
      headers: {
        cookie: 'browser_session=private',
        authorization: 'Basic untrusted-browser-value',
      },
    });
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('<p>OK</p>');
    expect(observed).toEqual([
      {
        method: 'GET',
        path: '/pt?test=1',
        authorization: 'Basic synthetic-credential',
        cookie: undefined,
      },
    ]);
    expect(result.headers.get('authorization')).toBeNull();
    expect(result.headers.get('set-cookie')).toBeNull();
  } finally {
    await close(relay);
    await close(upstream);
  }
});

it.each(['POST', 'PUT', 'DELETE'])(
  'refuses %s before making any upstream request',
  async (method) => {
    let requests = 0;
    const upstream = createServer((_request, response) => {
      requests++;
      response.end('unexpected');
    });
    const relay = createStagingRelay({
      origin: await listen(upstream),
      authorization: 'Basic synthetic',
    });
    try {
      const result = await fetch((await listen(relay)) + '/api/users', { method });
      expect(result.status).toBe(405);
      expect(requests).toBe(0);
    } finally {
      await close(relay);
      await close(upstream);
    }
  },
);

it('refuses an upstream redirect without sending the browser to another origin', async () => {
  const upstream = createServer((_request, response) =>
    response.writeHead(302, { location: 'https://outside.invalid/' }).end(),
  );
  const relay = createStagingRelay({
    origin: await listen(upstream),
    authorization: 'Basic synthetic',
  });
  try {
    const result = await fetch((await listen(relay)) + '/pt', { redirect: 'manual' });
    expect(result.status).toBe(502);
    expect(result.headers.get('location')).toBeNull();
  } finally {
    await close(relay);
    await close(upstream);
  }
});

it('refuses an absolute request target before forwarding its credential to another origin', async () => {
  let requests = 0;
  const upstream = createServer((_request, response) => {
    requests++;
    response.end('unexpected');
  });
  const origin = await listen(upstream);
  const relay = createStagingRelay({ origin, authorization: 'Basic synthetic' });
  const local = await listen(relay);
  try {
    const result = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(local, { path: origin + '/private' }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.on('error', reject);
      request.end();
    });
    expect(result).toBe(403);
    expect(requests).toBe(0);
  } finally {
    await close(relay);
    await close(upstream);
  }
});

it('rejects a GET body before forwarding any bytes or credential upstream', async () => {
  let requests = 0;
  const upstream = createServer((_request, response) => {
    requests++;
    response.end('unexpected');
  });
  const origin = await listen(upstream);
  const relay = createStagingRelay({ origin, authorization: 'Basic synthetic' });
  const local = await listen(relay);
  try {
    const body = 'GET /unexpected HTTP/1.1\r\nHost: localhost\r\n\r\n';
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        local,
        { method: 'GET', headers: { 'content-length': Buffer.byteLength(body) } },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      );
      request.on('error', reject);
      request.end(body);
    });
    expect(status).toBe(400);
    expect(requests).toBe(0);
  } finally {
    await close(relay);
    await close(upstream);
  }
});
