import 'server-only';
import { matchesLocalDatabase } from '../../config/local-database';
import type { ServerEnv } from '../../config/server-env';
import type { ObjectStorage } from './object-storage';

type RestoreEnvironment = Pick<
  ServerEnv,
  'APP_ENV' | 'PUBLIC_SITE_ENABLED' | 'SITE_ORIGIN' | 'DATABASE_URI'
>;

// Opt-in protection for recovery proofs using the fixed local database.
// The application can read existing immutable media; no write reaches the SDK.
export function restoreReadOnlyMedia<T extends ObjectStorage>(
  storage: T | undefined,
  env: RestoreEnvironment,
  flag: string | undefined,
): T | undefined {
  if (flag === undefined || flag === 'false') return storage;
  const database = URL.parse(env.DATABASE_URI);
  const origin = URL.parse(env.SITE_ORIGIN);
  if (database?.hostname === 'host.docker.internal') database.hostname = '127.0.0.1';
  if (
    flag !== 'true' ||
    !storage ||
    env.APP_ENV !== 'local' ||
    env.PUBLIC_SITE_ENABLED !== 'false' ||
    origin?.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    !origin.port ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    !matchesLocalDatabase(database?.href)
  )
    throw new Error('Read-only restore media requires the private local recovery environment');
  const refuse = async (): Promise<never> => {
    throw new Error('Media writes are disabled for the local recovery proof');
  };
  return { ...storage, put: refuse, delete: refuse };
}
