import 'server-only';
import type { ServerEnv } from '../../config/server-env';
import type { ObjectStorage } from './object-storage';

type RestoreEnvironment = Pick<
  ServerEnv,
  'APP_ENV' | 'PUBLIC_SITE_ENABLED' | 'SITE_ORIGIN' | 'DATABASE_URI'
>;

// Opt-in protection for the local HTTP proof of a fresh staging database clone.
// The application can read existing immutable media; no write reaches the SDK.
export function restoreReadOnlyMedia<T extends ObjectStorage>(
  storage: T | undefined,
  env: RestoreEnvironment,
  flag: string | undefined,
): T | undefined {
  if (flag === undefined || flag === 'false') return storage;
  const database = URL.parse(env.DATABASE_URI);
  const origin = URL.parse(env.SITE_ORIGIN);
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
    !database ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['127.0.0.1', 'host.docker.internal'].includes(database.hostname) ||
    database.port !== '55435' ||
    database.username !== 'joeldorosarioo_local' ||
    !/^\/a_design_for_life_restore_[a-f0-9]{32}$/.test(database.pathname) ||
    database.search ||
    database.hash
  )
    throw new Error('Read-only restore media requires the private local staging database clone');
  const refuse = async (): Promise<never> => {
    throw new Error('Media writes are disabled for the staging database restore proof');
  };
  return { ...storage, put: refuse, delete: refuse };
}
