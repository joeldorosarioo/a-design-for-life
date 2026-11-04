import 'server-only';
import { createLocalReq, type Payload, type PayloadRequest } from 'payload';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { z } from 'zod';
import { assertUnlinkedWorkspacePath } from '@/config/next-dist';
import { publicRootSchema, withPublicRootWriter, type PublicRoot } from './public-root';
export type BackupSnapshotContext = { req: PayloadRequest; root: PublicRoot | null };
const requests = new WeakMap<
  PayloadRequest,
  { payload: Payload; transactionID: string | number; session: object }
>();
const exportedSnapshot = z.object({
  rows: z
    .array(z.object({ snapshot: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{8}-[0-9]+$/i) }))
    .length(1),
});

export function requireNativeBackupSnapshot(req: PayloadRequest): void {
  const owned = requests.get(req);
  const adapter = req.payload.db as unknown as PostgresAdapter;
  if (
    !owned ||
    req.payload !== owned.payload ||
    req.transactionID !== owned.transactionID ||
    adapter.sessions?.[String(owned.transactionID)]?.db !== owned.session
  )
    throw new Error('An active owned native backup snapshot is required');
}
export async function withNativeBackupSnapshot<T, R>(
  options: {
    payload: Payload;
    directory: string;
    capture: (context: BackupSnapshotContext) => Promise<T>;
  },
  consume: (snapshot: { snapshotId: string; root: PublicRoot | null; captured: T }) => Promise<R>,
): Promise<R> {
  const directory = path.resolve(options.directory);
  const relative = path.relative(path.resolve('.work/publication'), directory);
  if (
    !path.isAbsolute(options.directory) ||
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Backup snapshot requires a private publication namespace');
  assertUnlinkedWorkspacePath(directory);
  const req = await createLocalReq({}, options.payload);
  const adapter = options.payload.db as unknown as PostgresAdapter;
  let transactionID: string | number | null = null;
  let failure: unknown;
  try {
    const prepared = await withPublicRootWriter(directory, async (selected) => {
      transactionID = await adapter.beginTransaction({
        isolationLevel: 'repeatable read',
        accessMode: 'read only',
      });
      if (transactionID === null || transactionID === undefined)
        throw new Error('Native read-only backup transaction unavailable');
      req.transactionID = transactionID;
      const session = adapter.sessions?.[String(transactionID)]?.db;
      if (!session) throw new Error('Native backup transaction session unavailable');
      const result = exportedSnapshot.parse(
        await session.execute(sql`SELECT pg_export_snapshot() AS snapshot`),
      );
      const root = selected === null ? null : publicRootSchema.parse(selected);
      requests.set(req, { payload: options.payload, transactionID, session });
      try {
        const captured = await options.capture({ req, root });
        return { snapshotId: result.rows[0].snapshot, root, captured };
      } finally {
        requests.delete(req);
      }
    });
    // Release the publication writer after capturing root/inventory. Keep the
    // native exporting transaction alive until the external dump consumer ends.
    return await consume(prepared);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    requests.delete(req);
    try {
      if (transactionID !== null) await adapter.rollbackTransaction(transactionID);
    } catch (cleanupError) {
      if (failure !== undefined)
        throw new AggregateError(
          [failure, cleanupError],
          'Backup snapshot and native cleanup failed',
        );
      throw cleanupError;
    } finally {
      delete req.transactionID;
    }
  }
}
