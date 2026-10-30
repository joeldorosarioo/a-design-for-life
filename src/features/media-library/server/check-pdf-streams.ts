import 'server-only';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// QPDF checks stream encoding without executing document actions. Exit 3 is a
// recoverable warning, not blanket rejection; page semantics are checked separately.
export async function checkPdfStreams(
  bytes: Uint8Array,
  binary: string,
  signal?: AbortSignal,
): Promise<'valid' | 'warnings' | 'invalid' | 'cancelled' | 'unavailable'> {
  if (signal?.aborted) return 'cancelled';
  const temporaryParent = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(temporaryParent, 'adfl-pdf-check-'));
  try {
    const file = path.join(directory, 'input.pdf');
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    return await new Promise((resolve) => {
      let failed = false;
      const child = spawn(binary, ['--password=', '--check', file], {
        stdio: 'ignore',
        windowsHide: true,
        signal,
      });
      child.once('error', () => {
        failed = true;
      });
      child.once('close', (code) => {
        if (signal?.aborted) resolve('cancelled');
        else if (failed) resolve('unavailable');
        else
          resolve(
            code === 0 ? 'valid' : code === 3 ? 'warnings' : code === 2 ? 'invalid' : 'unavailable',
          );
      });
    });
  } finally {
    if (
      path.dirname(path.resolve(directory)) !== temporaryParent ||
      !path.basename(directory).startsWith('adfl-pdf-check-')
    )
      throw new Error('Invalid PDF cleanup target');
    await rm(directory, { recursive: true, force: true });
  }
}
