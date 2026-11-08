import { expect, it } from 'vitest';
import { ProcessingBusy, ProcessingGate } from './processing-gate';
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it('runs one complete job at a time and admits only one waiting job', async () => {
  const gate = new ProcessingGate();
  const release = deferred();
  const events: string[] = [];
  let active = 0;
  let peak = 0;
  const job = (name: string, wait: Promise<void>) =>
    gate.run(async () => {
      active++;
      peak = Math.max(peak, active);
      events.push(`${name}:start`);
      await wait;
      events.push(`${name}:end`);
      active--;
      return name;
    });
  const first = job('first', release.promise);
  const second = job('second', Promise.resolve());
  await Promise.resolve();
  const beforeRelease = [...events];
  const third = job('third', Promise.resolve()).catch((error: unknown) => error);
  release.resolve();
  expect(await Promise.all([first, second])).toEqual(['first', 'second']);
  expect(await third).toBeInstanceOf(ProcessingBusy);
  expect(beforeRelease).toEqual(['first:start']);
  expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  expect(peak).toBe(1);
});
it('releases its slot after a failed whole job so the queued and next jobs can proceed', async () => {
  const gate = new ProcessingGate();
  const release = deferred();
  const first = gate.run(async () => {
    await release.promise;
    throw new Error('synthetic decode error');
  });
  const rejection = expect(first).rejects.toThrow('synthetic decode error');
  const next = gate.run(async () => 'queued result');
  release.resolve();
  await rejection;
  expect(await next).toBe('queued result');
  expect(await gate.run(async () => 'later result')).toBe('later result');
});
