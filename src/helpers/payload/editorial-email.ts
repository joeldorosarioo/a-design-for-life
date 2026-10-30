import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PayloadEmailAdapter } from 'payload';

export class EditorialEmailUnavailable extends Error {
  constructor() {
    super('Editorial email delivery is unavailable.');
    this.name = 'EditorialEmailUnavailable';
  }
}

async function captureLock(directory: string) {
  const lockPath = path.join(directory, '.capture.lock');
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      return { handle: await open(lockPath, 'wx', 0o600), lockPath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  // Never steal a live/stale lock: fail closed until local cleanup after stopping the process.
  throw new EditorialEmailUnavailable();
}
// Only local/test capture is implemented in E1.7. Never fall back to the console adapter.
export function editorialEmailAdapter(
  environment: string,
  databaseURI: string,
): PayloadEmailAdapter {
  return () => ({
    name: 'editorial-local-capture',
    defaultFromAddress: 'editorial@example.invalid',
    defaultFromName: 'Editorial local capture',
    async sendEmail(message) {
      if (environment !== 'local' && environment !== 'test') throw new EditorialEmailUnavailable();
      const directory = path.resolve(
        '.work/editorial-mail',
        createHash('sha256').update(databaseURI).digest('hex').slice(0, 16),
      );
      try {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const lock = await captureLock(directory);
        try {
          const now = Date.now();
          const files = (await readdir(directory)).filter((file) =>
            /^[a-f0-9-]{36}\.json$/.test(file),
          );
          const retained: { file: string; createdAt: number }[] = [];
          for (const file of files) {
            try {
              const captured = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
              if (typeof captured.createdAt !== 'number' || now - captured.createdAt > 15 * 60_000)
                await unlink(path.join(directory, file));
              else retained.push({ file, createdAt: captured.createdAt });
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
          }
          retained.sort((a, b) => a.createdAt - b.createdAt);
          for (const { file } of retained.slice(0, Math.max(0, retained.length - 31)))
            await unlink(path.join(directory, file)).catch((error: NodeJS.ErrnoException) => {
              if (error.code !== 'ENOENT') throw error;
            });
          const captured = {
            createdAt: now,
            to: message.to,
            subject: message.subject,
            html: message.html,
          };
          if (Buffer.byteLength(JSON.stringify(captured)) > 64 * 1024)
            throw new EditorialEmailUnavailable();
          await writeFile(path.join(directory, `${randomUUID()}.json`), JSON.stringify(captured), {
            flag: 'wx',
            mode: 0o600,
          });
          return { captured: true };
        } finally {
          await lock.handle.close();
          await unlink(lock.lockPath);
        }
      } catch {
        throw new EditorialEmailUnavailable();
      }
    },
  });
}
