import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export function createStagingRelay({ origin, authorization }) {
  const upstreamOrigin = new URL(origin);
  return createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    if (
      request.headers['transfer-encoding'] ||
      ![undefined, '0'].includes(request.headers['content-length'])
    ) {
      response.writeHead(400, { connection: 'close' }).end();
      return;
    }
    if (
      !request.url?.startsWith('/') ||
      request.url.startsWith('//') ||
      request.url.includes('\\')
    ) {
      response.writeHead(403).end();
      return;
    }
    const target = new URL(request.url, upstreamOrigin);
    if (target.origin !== upstreamOrigin.origin) {
      response.writeHead(403).end();
      return;
    }
    const headers = { authorization };
    for (const name of ['accept', 'accept-encoding', 'accept-language', 'user-agent']) {
      if (typeof request.headers[name] === 'string') headers[name] = request.headers[name];
    }
    const forward = upstreamOrigin.protocol === 'https:' ? httpsRequest : httpRequest;
    const upstream = forward(target, { method: request.method, headers }, (incoming) => {
      if (incoming.statusCode >= 300 && incoming.statusCode < 400) {
        incoming.resume();
        response.writeHead(502).end();
        return;
      }
      const outgoing = { ...incoming.headers };
      delete outgoing['set-cookie'];
      delete outgoing.authorization;
      response.writeHead(incoming.statusCode, outgoing);
      incoming.pipe(response);
    });
    upstream.setTimeout(30_000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    upstream.end();
  });
}
