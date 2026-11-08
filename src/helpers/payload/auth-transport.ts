import 'server-only';

const endpoints = new Set(['login', 'forgot-password', 'reset-password']);
const limiterKey = Symbol.for('a-design-for-life.editorial-auth-limiter');
type Window = { startsAt: number; attempts: number };
const state = globalThis as typeof globalThis & { [limiterKey]?: Map<string, Window> };

export function isEditorialAuthTransport(slug: string[] | undefined): boolean {
  return slug?.length === 2 && slug[0] === 'users' && endpoints.has(slug[1].toLowerCase());
}

// Direct local ingress has no trustworthy socket IP. Three fixed process-wide buckets
// intentionally ignore all forwarded headers. Native lockout/cooldown also remain active.
export function limitEditorialAuthTransport(slug: string[] | undefined): Response | null {
  if (!isEditorialAuthTransport(slug)) return null;
  const windows = (state[limiterKey] ??= new Map());
  const endpoint = slug![1].toLowerCase();
  const now = Date.now();
  let window = windows.get(endpoint);
  if (!window || now - window.startsAt >= 60_000) {
    window = { startsAt: now, attempts: 0 };
    windows.set(endpoint, window);
  }
  window.attempts++;
  if (window.attempts <= 60) return null;
  return Response.json(
    { errors: [{ message: 'Too many attempts. Try again later.' }] },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Retry-After': String(Math.max(1, Math.ceil((60_000 - (now - window.startsAt)) / 1000))),
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
