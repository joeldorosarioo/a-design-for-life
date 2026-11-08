import { expect, it, vi } from 'vitest';
import type { PayloadRequest } from 'payload';
import { dependencyDiagnostics } from './dependency-diagnostics';

const editor = { user: { collection: 'users' } as PayloadRequest['user'] };

it('requires a native editor before contacting any dependency', async () => {
  const postgresql = vi.fn().mockResolvedValue(undefined);
  const r2 = vi.fn().mockResolvedValue(undefined);
  const response = await dependencyDiagnostics({ postgresql, r2 })({ user: null });
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toBe('');
  expect(postgresql).not.toHaveBeenCalled();
  expect(r2).not.toHaveBeenCalled();
});

it('reports only dependency reachability to the authenticated editor', async () => {
  const result = await dependencyDiagnostics({
    postgresql: async () => ({ secret: 'synthetic-db-credential' }),
    r2: async () => ({ endpoint: 'synthetic-bucket-endpoint' }),
  })(editor);
  expect(result.status).toBe(200);
  expect(result.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(await result.json()).toEqual({ postgresql: 'reachable', r2: 'reachable' });
});

it('redacts a failed dependency independently of the other probe', async () => {
  const result = await dependencyDiagnostics({
    postgresql: async () => {
      throw new Error('synthetic-secret-database-url');
    },
    r2: async () => undefined,
  })(editor);
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ postgresql: 'unavailable', r2: 'reachable' });
});

it('identifies local storage without attempting R2', async () => {
  const result = await dependencyDiagnostics({ postgresql: async () => undefined })(editor);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ postgresql: 'reachable', r2: 'not-configured' });
});

it('bounds diagnostics when a dependency never settles', async () => {
  vi.useFakeTimers();
  try {
    const pending = dependencyDiagnostics({
      postgresql: () => new Promise(() => {}),
      r2: async () => undefined,
    })(editor);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await pending;
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ postgresql: 'unavailable', r2: 'reachable' });
  } finally {
    vi.useRealTimers();
  }
});
