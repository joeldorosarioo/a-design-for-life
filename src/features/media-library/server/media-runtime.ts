import 'server-only';
import path from 'node:path';
import { createLocalObjectStorage, type ObjectStorage } from '@/helpers/storage/object-storage';
import { selectNextDistDir } from '@/config/next-dist-value';
const key = Symbol.for('adfl.media-library.runtime');
type Runtime = { storage: ObjectStorage; checkerBinary: string };
const state = globalThis as typeof globalThis & { [key]?: Runtime };
type Options = { checkerBinary: string } & (
  { root: string; storage?: ObjectStorage } | { storage: ObjectStorage; root?: string }
);
export function installMediaRuntime(options: Options) {
  if (options.root !== undefined) {
    const selected = path.resolve(options.root);
    const servedRoots = [
      path.resolve('public'),
      path.resolve('.next/static'),
      path.resolve('.work/next-build/static'),
      path.resolve(selectNextDistDir(process.env), 'static'),
    ];
    for (const servedRoot of servedRoots) {
      const relative = path.relative(servedRoot, selected);
      if (
        relative === '' ||
        (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
      )
        throw new Error('Private media storage must remain outside Next public and static paths.');
    }
  }
  let storage = options.storage;
  if (!storage) {
    if (options.root === undefined) throw new Error('Media storage capability is required');
    storage = createLocalObjectStorage(options.root);
  }
  state[key] = { storage, checkerBinary: options.checkerBinary };
}
export function mediaRuntime() {
  const runtime = state[key];
  if (!runtime) throw new Error('Media runtime is not configured');
  return runtime;
}
