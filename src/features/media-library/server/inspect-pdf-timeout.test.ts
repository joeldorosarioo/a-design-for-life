import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pdfUploadFixture } from '../../../../testing/fixtures/media-uploads';
import { inspectPdf } from './inspect-pdf';
import { ProcessingGate } from './processing-gate';

const resources = vi.hoisted(() => ({
  workers: [] as import('node:worker_threads').Worker[],
  children: [] as import('node:child_process').ChildProcess[],
  checkerFile: '',
  checkerReady: undefined as Promise<unknown> | undefined,
}));

// Harmless real processes wait instead of parsing a pathological document.
vi.mock('node:worker_threads', async () => {
  const actual = await vi.importActual<typeof import('node:worker_threads')>('node:worker_threads');
  return {
    ...actual,
    Worker: class extends actual.Worker {
      constructor(_source: string, options: import('node:worker_threads').WorkerOptions) {
        super(
          `const { parentPort } = require('node:worker_threads');
           parentPort.once('message', () => parentPort.postMessage({ kind: 'valid', pages: 3 }));
           setInterval(() => {}, 1000);`,
          options,
        );
        resources.workers.push(this);
      }
    },
  };
});

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    spawn(_binary: string, args: string[], options: import('node:child_process').SpawnOptions) {
      resources.checkerFile = args.at(-1)!;
      const child = actual.spawn(
        process.execPath,
        [
          '-e',
          `process.on('SIGTERM', () => {});
           process.send('ready');
           setInterval(() => {}, 1000);`,
        ],
        { ...options, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
      );
      resources.children.push(child);
      resources.checkerReady = once(child, 'message');
      return child;
    },
  };
});

let request: AbortController;
const pending: Promise<unknown>[] = [];

beforeEach(() => {
  request = new AbortController();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(async () => {
  request.abort();
  for (const child of resources.children) child.kill('SIGKILL');
  await Promise.all(resources.workers.map((worker) => worker.terminate()));
  await Promise.allSettled(pending);
  resources.workers.length = 0;
  resources.children.length = 0;
  resources.checkerReady = undefined;
  resources.checkerFile = '';
  pending.length = 0;
  vi.useRealTimers();
});

it('terminates an overdue parser before releasing the next upload', async () => {
  const gate = new ProcessingGate();
  let result: unknown;
  pending.push(
    gate
      .run(() =>
        inspectPdf(pdfUploadFixture(), { checkerBinary: 'fixture', signal: request.signal }),
      )
      .then((value) => {
        result = value;
      }),
  );
  const queued = gate.run(async () => resources.workers[0].threadId);
  pending.push(queued);

  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(() => expect(result).toEqual({ kind: 'unavailable' }));

  expect(await queued).toBe(-1);
});

it('uses the remaining parser deadline to kill a stalled checker and remove its temporary file', async () => {
  let result: unknown;
  let checkerAtCompletion: { signal: string | null; fileExists: boolean } | undefined;
  pending.push(
    inspectPdf(pdfUploadFixture(), { checkerBinary: 'fixture', signal: request.signal }).then(
      (value) => {
        checkerAtCompletion = {
          signal: resources.children[0]?.signalCode ?? null,
          fileExists: existsSync(resources.checkerFile),
        };
        result = value;
      },
    ),
  );
  await vi.advanceTimersByTimeAsync(20_000);
  resources.workers[0].postMessage('finish parsing');
  await vi.waitFor(() => expect(resources.children).toHaveLength(1));
  await resources.checkerReady;
  await access(resources.checkerFile);

  await vi.advanceTimersByTimeAsync(10_000);
  await vi.waitFor(() => expect(result).toEqual({ kind: 'unavailable' }));

  expect(checkerAtCompletion).toEqual({ signal: 'SIGKILL', fileExists: false });
});
