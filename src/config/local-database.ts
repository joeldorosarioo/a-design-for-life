export const localDatabaseName = 'a_design_for_life_rebuild';
export const localDatabasePort = '5432';

export function matchesLocalDatabase(value: string | undefined): boolean {
  const url = value && URL.parse(value);
  return Boolean(
    url &&
    ['postgres:', 'postgresql:'].includes(url.protocol) &&
    url.hostname === '127.0.0.1' &&
    url.port === localDatabasePort &&
    url.pathname === `/${localDatabaseName}` &&
    /^[a-z_][a-z0-9_]{0,62}$/i.test(url.username) &&
    url.password &&
    !url.search &&
    !url.hash,
  );
}

export function assertLocalDatabase(value: string | undefined): URL {
  if (!matchesLocalDatabase(value))
    throw new Error('Expected the configured shared local PostgreSQL database.');
  return new URL(value!);
}
