import 'server-only';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';

// The listener belongs to the writer process for the whole critical section.
// No TTL, filesystem timestamp, stale-file removal, or transferable lease.
export async function withPublicationWriter<T>(
  identity: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = createHash('sha256').update(identity).digest('hex');
  const address =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\portfolio-publication-${key}`
      : `\0portfolio-publication-${key}`;
  if (process.platform !== 'win32' && process.platform !== 'linux')
    throw new Error('Publication writer unsupported.');
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? 'Publication writer busy.'
            : 'Publication writer unavailable.',
        ),
      ),
    );
    server.listen(address, resolve);
  });
  try {
    return await operation();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
