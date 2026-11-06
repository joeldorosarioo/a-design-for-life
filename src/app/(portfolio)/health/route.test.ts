import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD } from './route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('minimal public readiness', () => {
  // Break caught: publishing detailed diagnostics or caching the readiness response.
  it('returns only minimal process readiness with no-store and nosniff', async () => {
    const read: (request: Request) => Response = GET;
    const response = read(
      new Request('http://readiness.invalid/health?details=1', {
        headers: { authorization: 'PRIVATE_SENTINEL', cookie: 'PRIVATE_SENTINEL' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });

  // Break caught: sending diagnostics/body on HEAD or changing its caching policy.
  it('provides an empty HEAD response with the same public status and safety headers', async () => {
    const get = GET();
    const head = HEAD();

    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect([...head.headers]).toEqual([...get.headers]);
  });

  // Break caught: an origin probe/configuration dependency taking readiness down.
  it('stays available with unusable dependency configuration and network disabled', async () => {
    vi.stubEnv('DATABASE_URL', 'invalid:PRIVATE_SENTINEL');
    vi.stubEnv('R2_ENDPOINT', 'invalid:PRIVATE_SENTINEL');
    vi.stubGlobal('fetch', () => {
      throw new Error('No network is available');
    });

    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"status":"ready"}');
  });
});
