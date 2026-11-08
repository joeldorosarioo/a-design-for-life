import { expect, it, vi } from 'vitest';
it('shares only the installed factory across independent server module instances', async () => {
  const first = await import('./runtime');
  first.installPayloadProvider(async () => {
    throw new Error('Reached composed factory');
  });
  vi.resetModules();
  const second = await import('./runtime');
  await expect(second.runtimePayload()).rejects.toThrow('Reached composed factory');
});
