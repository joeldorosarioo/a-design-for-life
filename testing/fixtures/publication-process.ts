import config from '../../src/payload.config';
import { getPayload, createLocalReq } from 'payload';
import { createServer } from 'node:http';
import { caseRouteResponse } from '../../src/features/cases/server/case-route-response';
import { serveMedia } from '../../src/features/media-library/server/media-response';
import { retryPublicationUpdate } from '../../src/helpers/payload/publication-updates';
process.once(
  'message',
  async (input: { mode: 'crash-ack' | 'http'; operationId?: string; userId?: string }) => {
    try {
      if (input.mode === 'crash-ack') {
        const payload = await getPayload({ config, key: 'publication-child' });
        const user = await payload.findByID({
          collection: 'users',
          id: input.userId!,
          overrideAccess: true,
        });
        const update = payload.db.updateOne.bind(payload.db);
        payload.db.updateOne = async (args) => {
          if (args.collection === 'publication-updates' && args.data.state === 'public') {
            process.send?.({ event: 'before-ack' });
            await new Promise<void>((resolve) => process.once('message', () => resolve()));
          }
          return update(args);
        };
        const result = await retryPublicationUpdate(
          input.operationId!,
          await createLocalReq({ user: { ...user, collection: 'users' } }, payload),
        );
        process.send?.({ event: 'result', result });
        await payload.destroy();
        process.exit(0);
      }
      const server = createServer(async (request, response) => {
        try {
          const url = new URL(request.url!, 'http://127.0.0.1');
          const parts = url.pathname.split('/').filter(Boolean);
          const result =
            parts[0] === 'media'
              ? await serveMedia(
                  { mediaId: parts[1]!, variant: parts[2]!, preview: false },
                  new Request(url, { method: request.method }),
                )
              : await caseRouteResponse(parts[0]!, parts[2]!);
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(
            request.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()),
          );
        } catch {
          response.writeHead(503);
          response.end();
        }
      });
      server.listen(0, '127.0.0.1', () =>
        process.send?.({ event: 'ready', port: (server.address() as { port: number }).port }),
      );
    } catch (error) {
      process.send?.({ event: 'failed', name: error instanceof Error ? error.name : 'Error' });
      process.exit(1);
    }
  },
);
