import 'server-only';
import type { PayloadRequest } from 'payload';

type EditorRequest = Pick<PayloadRequest, 'user'>;

type Probes<Request extends EditorRequest> = {
  postgresql: (req: Request) => Promise<unknown>;
  r2?: (signal: AbortSignal) => Promise<unknown>;
};

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

async function reachability(probe: (signal: AbortSignal) => Promise<unknown>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => probe(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Dependency probe timed out'));
        }, 2_000);
      }),
    ]);
    return 'reachable';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}

export function dependencyDiagnostics<Request extends EditorRequest>(probes: Probes<Request>) {
  return async (req: Request) => {
    if (req.user?.collection !== 'users') return new Response(null, { status: 401, headers });

    const [postgresql, r2] = await Promise.all([
      reachability(() => probes.postgresql(req)),
      probes.r2 ? reachability(probes.r2) : 'not-configured',
    ]);
    const status = postgresql === 'unavailable' || r2 === 'unavailable' ? 503 : 200;
    return Response.json({ postgresql, r2 }, { status, headers });
  };
}
