import 'server-only';
import path from 'node:path';
import { createLocalObjectStorage } from '@/helpers/storage/object-storage';
const key = Symbol.for('adfl.media-library.runtime');
type Runtime = { storage: ReturnType<typeof createLocalObjectStorage>; checkerBinary: string };
const state = globalThis as typeof globalThis & { [key]?: Runtime };
export function installMediaRuntime(options: { root: string; checkerBinary: string }) {
  const selected = path.resolve(options.root);
  const servedRoots = [path.resolve('public'), path.resolve('.next/static')];
  for (const servedRoot of servedRoots) {
    const relative = path.relative(servedRoot, selected);
    if (
      relative === '' ||
      (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
    )
      throw new Error('Private media storage must remain outside Next public and static paths.');
  }

  state[key] = {
    storage: createLocalObjectStorage(options.root),
    checkerBinary: options.checkerBinary,
  };
}
export function mediaRuntime() {
  const runtime = state[key];
  if (!runtime) throw new Error('Media runtime is not configured');
  return runtime;
}
