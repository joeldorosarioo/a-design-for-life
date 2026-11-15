import { EventEmitter } from 'node:events';
import { execFile, spawn } from 'node:child_process';
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { runLocalRuntime } from '../../scripts/local-runtime';
import { acquireSharedDatabaseRuntime } from './owned-test-database';

vi.mock('node:child_process', () => ({ execFile: vi.fn(), spawn: vi.fn() }));
vi.mock('./owned-test-database', () => ({ acquireSharedDatabaseRuntime: vi.fn() }));

let child: EventEmitter & {
  pid: number | undefined;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: ReturnType<typeof vi.fn>;
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

let lost: ReturnType<typeof deferred>;
let release: Mock<() => Promise<void>> & { lost: Promise<void> };

beforeEach(() => {
  lost = deferred();
  release = Object.assign(
    vi.fn(async () => {}),
    { lost: lost.promise },
  );
  vi.mocked(acquireSharedDatabaseRuntime).mockResolvedValue(release);
  child = Object.assign(new EventEmitter(), {
    pid: 4242,
    exitCode: null,
    signalCode: null,
    kill: vi.fn(),
  });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
});

afterEach(() => vi.resetAllMocks());

function exit() {
  child.exitCode = 0;
  child.emit('exit', 0, null);
}

it('stops the owned Windows process tree and confirms exit before releasing its database reservation', async () => {
  const treeStopped = deferred();
  vi.mocked(execFile).mockImplementation((binary, args, options, callback) => {
    expect(String(binary)).toMatch(/taskkill\.exe$/i);
    expect(args).toEqual(['/PID', '4242', '/T', '/F']);
    expect(options).toMatchObject({ windowsHide: true });
    treeStopped.promise.then(() => {
      callback!(null, '', '');
      exit();
    });
    return {} as ReturnType<typeof execFile>;
  });
  const running = runLocalRuntime('dev', [], 'win32');
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
  lost.resolve();
  await vi.waitFor(() => expect(execFile).toHaveBeenCalledOnce());
  expect(release).not.toHaveBeenCalled();
  treeStopped.resolve();
  await expect(running).resolves.toBe(1);
  expect(child.kill).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
});

it('uses SIGTERM and waits for the owned POSIX child to exit before release', async () => {
  child.kill.mockImplementation(() => {
    queueMicrotask(exit);
    return true;
  });
  const running = runLocalRuntime('dev', [], 'linux');
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
  lost.resolve();
  await expect(running).resolves.toBe(1);
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
  expect(execFile).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
});

it('retains the database reservation when Windows process-tree shutdown cannot be confirmed', async () => {
  vi.mocked(execFile).mockImplementation((_binary, _args, _options, callback) => {
    queueMicrotask(() => callback!(new Error('Synthetic tree termination failure'), '', ''));
    return {} as ReturnType<typeof execFile>;
  });
  const running = runLocalRuntime('dev', [], 'win32');
  const rejected = expect(running).rejects.toThrow(/process tree/i);
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
  lost.resolve();
  await rejected;
  expect(release).not.toHaveBeenCalled();
});

it('releases the reservation if the application could not spawn any process', async () => {
  child.pid = undefined;
  const running = runLocalRuntime('start', [], 'win32');
  const rejected = expect(running).rejects.toThrow('Synthetic spawn failure');
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
  child.emit('error', new Error('Synthetic spawn failure'));
  await rejected;
  expect(execFile).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
});

it('retains the reservation when the Windows development CLI exits before its worker tree can be confirmed', async () => {
  const running = runLocalRuntime('dev', [], 'win32');
  const rejected = expect(running).rejects.toThrow(/process tree.*reservation was retained/i);
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
  exit();
  await rejected;
  expect(execFile).not.toHaveBeenCalled();
  expect(release).not.toHaveBeenCalled();
});
