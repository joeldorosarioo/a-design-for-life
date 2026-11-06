import type { Payload } from 'payload';
import { backupNamespaceSchema, sameNamespace, type BackupNamespace } from './contracts';
import { postgresDumpConnection } from './postgres-dump';

declare const lockBrand: unique symbol;
export type OperationalBackupLockPermit = { readonly [lockBrand]: true };
type Storage = { endpoint: string; bucket: string };
const connectClient = (payload: Payload) => payload.db.pool.connect();
type Client = Awaited<ReturnType<typeof connectClient>>;
type HeldLock = {
  client: Client;
  pid: number;
  namespace: BackupNamespace;
  storage?: string;
  active: boolean;
  closing: boolean;
  operations: Set<Promise<unknown>>;
};
const permits = new WeakMap<object, HeldLock>();
const lockName = 'adfl:operational-backup-job';
const invalid = () => new Error('Operational backup lock refused');

export function r2RetentionStorageIdentity(namespace: BackupNamespace, storage: Storage): string {
  const endpoint = URL.parse(storage.endpoint);
  const loopback =
    namespace.environment === 'test' &&
    endpoint?.protocol === 'http:' &&
    ['127.0.0.1', '[::1]'].includes(endpoint.hostname);
  const cloudflare =
    endpoint?.protocol === 'https:' &&
    !endpoint.port &&
    /^[a-f0-9]{32}(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname);
  if (
    !endpoint ||
    (!loopback && !cloudflare) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(storage.bucket)
  )
    throw invalid();
  return `backup-repository:r2:${endpoint.origin}/${storage.bucket}`;
}

async function checkHeld(state: HeldLock) {
  if (!state.active) throw invalid();
  const result = await state.client.query<{ pid: number; held: boolean }>(`
    SELECT pg_backend_pid() AS pid, EXISTS (
      SELECT 1 FROM pg_locks WHERE locktype = 'advisory'
        AND pid = pg_backend_pid() AND granted AND mode = 'ExclusiveLock'
        AND classid = ((hashtextextended('${lockName}', 0) >> 32) & 4294967295)::oid
        AND objid = (hashtextextended('${lockName}', 0) & 4294967295)::oid
        AND objsubid = 1
    ) AS held
  `);
  if (result.rows[0]?.pid !== state.pid || result.rows[0].held !== true) throw invalid();
}

/** Owns the dedicated session until the consumer and all admitted operations end. */
export async function withOperationalBackupLock<T>(
  options: {
    payload: Payload;
    databaseUri: string;
    namespace: BackupNamespace;
    backupStorage?: Storage;
  },
  consume: (permit: OperationalBackupLockPermit) => Promise<T>,
): Promise<T> {
  const namespace = Object.freeze(backupNamespaceSchema.parse(options.namespace));
  if (namespace.environment === 'production') throw invalid();
  const database = postgresDumpConnection(options.databaseUri).PGDATABASE;
  const storage = options.backupStorage
    ? r2RetentionStorageIdentity(namespace, options.backupStorage)
    : undefined;
  const client = await connectClient(options.payload);
  let state: HeldLock | undefined;
  try {
    const actual = await client.query<{ database: string; version: number; pid: number }>(
      "SELECT current_database() AS database, current_setting('server_version_num')::int AS version, pg_backend_pid() AS pid",
    );
    const observed = actual.rows[0];
    if (
      observed?.database !== database ||
      observed.version < 170000 ||
      observed.version >= 180000 ||
      !Number.isInteger(observed.pid) ||
      observed.pid <= 0
    )
      throw invalid();
    const lock = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtextextended('${lockName}', 0)) AS acquired`,
    );
    if (lock.rows[0]?.acquired !== true) throw invalid();
    const held: HeldLock = {
      client,
      pid: observed.pid,
      namespace,
      storage,
      active: true,
      closing: false,
      operations: new Set(),
    };
    state = held;
    const permit = Object.freeze({}) as OperationalBackupLockPermit;
    permits.set(permit, held);
    return await consume(permit);
  } finally {
    if (state) {
      state.closing = true;
      // An unawaited consumer cannot release the PostgreSQL exclusion while an
      // already-admitted remote operation is still in flight.
      await Promise.allSettled([...state.operations]);
      state.active = false;
    }
    client.release(true);
  }
}

/** This is a privileged repository boundary; flags and copied permits are refused. */
export async function withR2RetentionLock<T>(
  permit: OperationalBackupLockPermit | undefined,
  scope: { namespace: BackupNamespace; endpoint: string; bucket: string },
  operation: (checkpoint: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const state = permit && permits.get(permit);
  if (
    !state ||
    !state.active ||
    state.closing ||
    !sameNamespace(state.namespace, scope.namespace) ||
    state.storage !== r2RetentionStorageIdentity(scope.namespace, scope)
  )
    throw invalid();
  const running = (async () => {
    await checkHeld(state);
    return operation(() => checkHeld(state));
  })();
  state.operations.add(running);
  try {
    return await running;
  } finally {
    state.operations.delete(running);
  }
}
