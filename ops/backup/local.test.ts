import { execFile, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it, vi } from 'vitest';
import {
  localBackupSourceIdentity,
  localMediaStorageRoot,
  runLocalBackupContainer,
} from './local.mjs';

it('maps the actual host media directory into the read-only backup mount', () => {
  expect(localMediaStorageRoot(path.resolve('.work/private-media/custom/content'))).toBe(
    '/app/.work/private-media/custom/content',
  );
  expect(localMediaStorageRoot(path.resolve('.work/private-media'))).toBe(
    '/app/.work/private-media',
  );
  expect(localMediaStorageRoot('.work/private-media/custom/content')).toBe(
    '/app/.work/private-media/custom/content',
  );
  expect(localMediaStorageRoot(undefined)).toBeUndefined();
});

it.each([
  path.resolve('.work/publication'),
  path.resolve('.work/private-media-other'),
  path.resolve('.work/private-media/../../publication'),
])('rejects a source root outside the host private media directory', (root) => {
  expect(() => localMediaStorageRoot(root)).toThrow(
    'The local media storage root must stay within its mounted directory.',
  );
});

it('identifies current host code, including deleted tracked files, independently of docs and outputs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'adfl-backup-source-'));
  const run = promisify(execFile);
  try {
    await run('git', ['init', '--quiet', directory], { windowsHide: true });
    await writeFile(path.join(directory, '.gitignore'), 'output.log\n');
    await writeFile(path.join(directory, 'app.ts'), 'export const value = 1;\n');
    await run('git', ['-C', directory, 'add', '--', '.gitignore', 'app.ts'], { windowsHide: true });
    const original = await localBackupSourceIdentity(directory);
    expect(original).toMatchObject({
      revision: 'draft-uncommitted',
      sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    await writeFile(path.join(directory, 'README.md'), 'Documentation\n');
    await writeFile(path.join(directory, 'output.log'), 'Generated output\n');
    expect(await localBackupSourceIdentity(directory)).toEqual(original);
    await writeFile(path.join(directory, 'app.ts'), 'export const value = 2;\n');
    const changed = await localBackupSourceIdentity(directory);
    expect(changed.sourceSha256).not.toBe(original.sourceSha256);
    await rm(path.join(directory, 'app.ts'));
    expect((await localBackupSourceIdentity(directory)).sourceSha256).not.toBe(
      changed.sourceSha256,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('aborts the attached backup process when the shared database reservation is lost', async () => {
  let loseLease!: () => void;
  const lost = new Promise<void>((resolve) => {
    loseLease = resolve;
  });
  let interrupted = false;
  const execute = vi.fn(
    (_binary: string, _args: string[], options: ExecFileOptionsWithStringEncoding) => {
      const signal = options.signal;
      if (!signal) throw new Error('Expected an abortable backup operation.');
      return new Promise<{ stdout: string }>((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => {
            interrupted = true;
            reject(new Error('Aborted'));
          },
          { once: true },
        ),
      );
    },
  );
  const running = runLocalBackupContainer('a'.repeat(64), lost, execute);
  const failed = expect(running).rejects.toThrow('database reservation was lost');
  loseLease();
  await failed;
  expect(interrupted).toBe(true);
  expect(execute.mock.calls[0]![1]).toEqual(['start', '--attach', 'a'.repeat(64)]);
});
