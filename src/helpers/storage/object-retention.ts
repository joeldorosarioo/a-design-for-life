import 'server-only';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { withPublicationWriter } from '@/helpers/payload/publication-writer';
const capabilities = new WeakMap<object, () => Promise<string>>();
// Internal factory registration, not an application/user supplied proof flag.
export function registerObjectStorageRetention<T extends object>(
  storage: T,
  resolveIdentity: () => Promise<string>,
): T {
  if (capabilities.has(storage)) throw new Error('Storage retention capability already registered');
  capabilities.set(storage, resolveIdentity);
  return storage;
}
export async function localStorageRetentionIdentity(root: string): Promise<string> {
  if (!path.isAbsolute(root))
    throw new Error('Storage retention requires an absolute private root');
  let ancestor = path.resolve(root);
  const tail: string[] = [];
  while (true) {
    try {
      const canonical = path.join(await realpath(ancestor), ...tail.reverse());
      return `object-storage:local:${process.platform === 'win32' ? canonical.toLowerCase() : canonical}`;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'ENOENT' ||
        ancestor === path.dirname(ancestor)
      )
        throw error;
      tail.push(path.basename(ancestor));
      ancestor = path.dirname(ancestor);
    }
  }
}
export async function withObjectStorageRetention<T>(
  storage: object,
  operation: (scope: Readonly<{ identity: string }>) => Promise<T>,
): Promise<T> {
  const resolveIdentity = capabilities.get(storage);
  if (!resolveIdentity) throw new Error('Object storage has no registered retention capability');
  const identity = await resolveIdentity();
  return withPublicationWriter(identity, () => operation(Object.freeze({ identity })));
}
