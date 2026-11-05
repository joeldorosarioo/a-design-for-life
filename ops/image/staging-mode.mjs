import path from 'node:path';

export function stagingDatabaseOnly(env) {
  const selected = env.STAGING_DATABASE_ONLY;
  if (selected === undefined || selected === 'false') return false;
  if (
    selected !== 'true' ||
    env.APP_ENV !== 'staging' ||
    env.PUBLIC_SITE_ENABLED !== 'false' ||
    [
      env.PUBLICATION_RETRIES_ENABLED,
      env.PUBLICATION_RETRY_WORKER_ENABLED,
      env.PUBLICATION_HTTP_VERIFICATION_ENABLED,
    ].some((value) => value !== undefined && value !== 'false')
  ) {
    throw new Error(
      'Database-only startup requires private staging with publication workers disabled.',
    );
  }
  return true;
}

export function embeddedDatabaseTarget(env) {
  let url;
  try {
    url = new URL(env.DATABASE_URI ?? '');
  } catch {
    throw new Error('Expected a valid embedded PostgreSQL target.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') ||
    url.search ||
    url.hash ||
    !path.isAbsolute(env.PGDATA ?? '')
  ) {
    throw new Error('Expected a local PostgreSQL URL and an absolute PGDATA.');
  }
  const user = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(user) || !/^[a-z_][a-z0-9_]{0,62}$/i.test(database))
    throw new Error('Expected simple PostgreSQL role and database names.');
  return { url, user, database };
}
