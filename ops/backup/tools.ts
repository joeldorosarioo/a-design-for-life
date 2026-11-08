import { constants } from 'node:fs';
import { lstat, link, open, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

export type BackupToolOptions = {
  binary: string;
  args: readonly string[];
  inputFile?: string;
  outputFile?: string;
  timeoutMs?: number;
};
export async function assertUnlinkedBackupPath(selected: string): Promise<void> {
  if (!path.isAbsolute(selected) || path.dirname(selected) === selected)
    throw new Error('Invalid private backup path');
  for (let ancestor = path.resolve(selected); ; ancestor = path.dirname(ancestor)) {
    const info = await lstat(ancestor).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (info?.isSymbolicLink()) throw new Error('Linked backup path refused');
    if (ancestor === path.dirname(ancestor)) break;
  }
}
export async function assertPrivateBackupOutput(selected: string): Promise<void> {
  await assertUnlinkedBackupPath(selected);
  for (const served of ['public', '.next', '.work/next-build', '.work/next-tests']) {
    const relative = path.relative(path.resolve(served), path.resolve(selected));
    if (
      !relative ||
      (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
    )
      throw new Error('Backup plaintext and tools must remain outside public/build paths');
  }
}
export async function openBackupInput(selected: string) {
  await assertUnlinkedBackupPath(selected);
  const info = await lstat(selected);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error('Backup input must be a regular file');
  const handle = await open(selected, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  const actual = await handle.stat();
  if (!actual.isFile() || actual.ino !== info.ino || actual.dev !== info.dev) {
    await handle.close();
    throw new Error('Backup input identity changed');
  }
  return handle;
}
export async function hashBackupFile(
  selected: string,
): Promise<{ byteLength: number; sha256: string }> {
  const handle = await openBackupInput(selected);
  const hash = createHash('sha256');
  let byteLength = 0;
  try {
    for await (const chunk of backupFileChunks(handle)) {
      hash.update(chunk);
      byteLength += chunk.length;
    }
    return { byteLength, sha256: hash.digest('hex') };
  } finally {
    await handle.close();
  }
}
export async function* backupFileChunks(handle: Awaited<ReturnType<typeof open>>) {
  let position = 0;
  while (true) {
    const buffer = Buffer.allocUnsafe(65_536);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
    if (bytesRead === 0) return;
    position += bytesRead;
    yield buffer.subarray(0, bytesRead);
  }
}

export class BackupToolError extends Error {
  constructor(
    readonly exitCode: number | null,
    readonly timedOut = false,
  ) {
    super('Backup tool failed; no output was published');
    this.name = 'BackupToolError';
  }
}
export async function runBackupTool(
  options: BackupToolOptions,
): Promise<{ stdout: string; exitCode: 0 }> {
  if (
    !path.isAbsolute(options.binary) ||
    !Array.isArray(options.args) ||
    options.args.some((value) => typeof value !== 'string' || value.includes('\0')) ||
    (options.timeoutMs !== undefined &&
      (!Number.isSafeInteger(options.timeoutMs) ||
        options.timeoutMs < 1 ||
        options.timeoutMs > 600_000))
  )
    throw new Error('Invalid backup tool invocation');
  const input = options.inputFile ? await openBackupInput(options.inputFile) : undefined;
  let temporary: string | undefined;
  let output: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (options.outputFile) {
      await assertPrivateBackupOutput(options.outputFile);
      const existing = await lstat(options.outputFile).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (existing) throw new Error('Existing backup output refused');
      temporary = path.join(
        path.dirname(options.outputFile),
        `.${path.basename(options.outputFile)}.${randomUUID()}.tmp`,
      );
      output = await open(temporary, 'wx', 0o600);
    }
    const child = spawn(options.binary, [...options.args], {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let timedOut = false,
      overflow = false,
      spawnFailed = false,
      stdout = '';
    const close = new Promise<number | null>((resolve) => {
      child.once('error', () => {
        spawnFailed = true;
      });
      child.once('close', (code) => resolve(code));
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? 120_000);
    child.stderr.resume(); // Never copy tool diagnostics containing identities into exceptions/logs.
    const outputPipeline = output
      ? (async () => {
          for await (const value of child.stdout) {
            const chunk = Buffer.from(value);
            let offset = 0;
            while (offset < chunk.length) {
              const { bytesWritten } = await output!.write(chunk, offset, chunk.length - offset);
              if (bytesWritten === 0) throw new Error('Backup output write did not advance');
              offset += bytesWritten;
            }
          }
        })()
      : new Promise<void>((resolve, reject) => {
          child.stdout.on('data', (chunk: Buffer) => {
            if (Buffer.byteLength(stdout) + chunk.length > 16_384) {
              overflow = true;
              child.kill();
            } else stdout += chunk.toString('utf8');
          });
          child.stdout.once('end', resolve);
          child.stdout.once('error', reject);
        });
    const inputPipeline = input
      ? pipeline(Readable.from(backupFileChunks(input)), child.stdin)
      : Promise.resolve(child.stdin.end());
    try {
      const [code, outgoing, incoming] = await Promise.all([
        close,
        outputPipeline.then(
          () => true,
          () => false,
        ),
        inputPipeline.then(
          () => true,
          () => false,
        ),
      ]);
      if (code !== 0 || !outgoing || !incoming || timedOut || overflow || spawnFailed)
        throw new BackupToolError(code, timedOut);
      if (output && options.outputFile && temporary) {
        await output.sync();
        await link(temporary, options.outputFile);
      }
      return { stdout, exitCode: 0 };
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await input?.close();
    await output?.close();
    if (temporary)
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
}
