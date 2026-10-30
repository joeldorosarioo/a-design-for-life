import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { publicRootSchema, type PublicRoot } from './public-root';

const pinSchema = z.strictObject({
  generation: publicRootSchema.shape.generation.regex(/^[0-9a-f-]+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PublicRootPin = z.infer<typeof pinSchema>;

function snapshotPath(directory: string, generation: string) {
  return path.join(directory, 'render-snapshots', `${generation}.json`);
}

export async function readPinnedPublicRoot(
  directory: string,
  input: PublicRootPin,
): Promise<PublicRoot> {
  const pin = pinSchema.parse(input);
  const bytes = await readFile(snapshotPath(directory, pin.generation));
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256)
    throw new Error('Pinned public root integrity mismatch.');
  const root = publicRootSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (root.generation !== pin.generation)
    throw new Error('Pinned public root generation mismatch.');
  return root;
}

// The caller selects current.json first. This helper only transports that
// captured root to a separate render graph; it never selects an older root.
export async function pinPublicRoot(directory: string, input: PublicRoot): Promise<PublicRootPin> {
  const root = publicRootSchema.parse(input);
  const serialized = JSON.stringify(root);
  const pin = pinSchema.parse({
    generation: root.generation,
    sha256: createHash('sha256').update(serialized).digest('hex'),
  });
  try {
    await readPinnedPublicRoot(directory, pin);
    return pin;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const snapshots = path.join(directory, 'render-snapshots');
  await mkdir(snapshots, { recursive: true, mode: 0o700 });
  const temporary = path.join(snapshots, `${randomUUID()}.tmp`);
  let owned = false;
  try {
    const file = await open(temporary, 'wx', 0o600);
    owned = true;
    try {
      await file.writeFile(serialized);
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      // Same-directory hard link makes complete bytes visible without replacing
      // any generation another process has already pinned.
      await link(temporary, snapshotPath(directory, pin.generation));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await readPinnedPublicRoot(directory, pin);
      return pin;
    }
    if (process.platform === 'linux') {
      const directoryFile = await open(snapshots, 'r');
      try {
        await directoryFile.sync();
      } finally {
        await directoryFile.close();
      }
    }
    return pin;
  } finally {
    if (owned)
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
}
