import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { withPublicationWriter } from './publication-writer';
const rootSchema = z.strictObject({
  generation: z.uuid(),
  subjects: z.record(
    z.string(),
    z.strictObject({
      operationId: z.string().min(1),
      targetRevision: z.string().min(1),
      value: z.json(),
    }),
  ),
});
export type PublicRoot = z.infer<typeof rootSchema>;
export async function readPublicRoot(directory: string): Promise<PublicRoot | null> {
  try {
    return rootSchema.parse(
      JSON.parse(await readFile(path.join(directory, 'current.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
export async function withPublicRootWriter<T>(
  directory: string,
  operation: (root: PublicRoot | null, commit: (next: PublicRoot) => Promise<void>) => Promise<T>,
): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const canonical = await realpath(directory);
  return withPublicationWriter(
    process.platform === 'win32' ? canonical.toLowerCase() : canonical,
    async () => {
      const root = await readPublicRoot(canonical);
      let active = true;
      try {
        return await operation(root, async (next) => {
          if (!active) throw new Error('Publication writer closed.');
          const serialized = JSON.stringify(rootSchema.parse(next));
          const temporary = path.join(canonical, `${randomUUID()}.tmp`);
          try {
            const file = await open(temporary, 'wx', 0o600);
            try {
              await file.writeFile(serialized);
              await file.sync();
            } finally {
              await file.close();
            }
            await rename(temporary, path.join(canonical, 'current.json'));
            // Directory fsync is supported on Linux. Windows does not expose it
            // through this Node API; no claim of power-loss durability is made.
            if (process.platform === 'linux') {
              const directoryFile = await open(canonical, 'r');
              try {
                await directoryFile.sync();
              } finally {
                await directoryFile.close();
              }
            }
          } finally {
            await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
              if (error.code !== 'ENOENT') throw error;
            });
          }
        });
      } finally {
        active = false;
      }
    },
  );
}
