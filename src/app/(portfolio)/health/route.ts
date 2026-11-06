// Readiness of this process only. Origin diagnostics must remain separate.
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function GET(): Response {
  return Response.json({ status: 'ready' }, { headers });
}

export function HEAD(): Response {
  return new Response(null, { headers });
}
