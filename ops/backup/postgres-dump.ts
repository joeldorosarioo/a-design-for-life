import { runBackupTool } from './tools';

const tlsModes = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];

export function postgresDumpConnection(databaseUri: string) {
  const invalid = () => new Error('Invalid PostgreSQL snapshot dump configuration.');
  const database = URL.parse(databaseUri);
  if (
    !database ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !/^(?:[a-z0-9][a-z0-9.-]*|\[[a-f0-9:]+\])$/i.test(database.hostname) ||
    !/^\/[a-z_][a-z0-9_]{0,62}$/.test(database.pathname) ||
    !/^[a-z_][a-z0-9_-]{0,62}$/i.test(database.username) ||
    !database.password ||
    database.hash
  )
    throw invalid();

  const parameters = [...database.searchParams];
  const sslmode = database.searchParams.get('sslmode') ?? 'prefer';
  if (
    parameters.length > 1 ||
    parameters.some(([key]) => key !== 'sslmode') ||
    !tlsModes.includes(sslmode)
  )
    throw invalid();

  let password: string;
  try {
    password = decodeURIComponent(database.password);
  } catch {
    throw invalid();
  }
  if (password.includes('\0') || password.includes('\r') || password.includes('\n'))
    throw invalid();

  return {
    PGHOST: database.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: database.port || '5432',
    PGDATABASE: database.pathname.slice(1),
    PGUSER: database.username,
    PGPASSWORD: password,
    PGSSLMODE: sslmode,
    PGCONNECT_TIMEOUT: '5',
  };
}

export async function dumpPostgresSnapshot(input: {
  databaseUri: string;
  snapshotId: string;
  destination: string;
  binary: string;
  run?: typeof runBackupTool;
}): Promise<void> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{8}-[1-9]\d{0,8}$/i.test(input.snapshotId))
    throw new Error('Invalid PostgreSQL snapshot dump configuration.');

  await (input.run ?? runBackupTool)({
    binary: input.binary,
    args: [
      '--format=custom',
      '--snapshot=' + input.snapshotId,
      '--no-owner',
      '--no-acl',
      '--no-password',
    ],
    env: postgresDumpConnection(input.databaseUri),
    outputFile: input.destination,
    timeoutMs: 600_000,
  });
}
