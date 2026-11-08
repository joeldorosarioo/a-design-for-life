import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { selectNextDistDir } from './next-dist-value';

export function assertUnlinkedWorkspacePath(selected: string, root = process.cwd()) {
  const target = path.resolve(root, selected);
  const relative = path.relative(path.resolve(root), target);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Unsafe or linked workspace path refused.');
  let ancestor = target;
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = path.dirname(ancestor);
  const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
  try {
    if (normalize(realpathSync(ancestor)) === normalize(ancestor)) return;
  } catch {
    /* Dangling links are never a safe output or cleanup target. */
  }
  throw new Error('Unsafe or linked workspace path refused.');
}

export function resolveNextDistDir(input: Partial<NodeJS.ProcessEnv>, root = process.cwd()) {
  const selected = selectNextDistDir(input);
  try {
    assertUnlinkedWorkspacePath(selected, root);
  } catch {
    throw new Error('Linked Next build output ancestor refused.');
  }
  return selected;
}
