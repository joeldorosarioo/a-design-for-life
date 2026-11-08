import { readFileSync, writeSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runOperationalBackupJob } from './job-runner';

function privateAddress(address: string) {
  const bytes = address.split('.').map(Number);
  return (
    bytes.length === 4 &&
    bytes.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) &&
    (bytes[0] === 10 ||
      (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
      (bytes[0] === 192 && bytes[1] === 168))
  );
}

/** Read build provenance from the image file, never from image environment metadata. */
export function embeddedBuildRevision(identity: unknown): string {
  if (
    !identity ||
    typeof identity !== 'object' ||
    Array.isArray(identity) ||
    Object.keys(identity).length !== 1 ||
    !('revision' in identity) ||
    typeof identity.revision !== 'string' ||
    !/^[a-f0-9]{40}$/.test(identity.revision)
  )
    throw new Error('Embedded staging build identity refused.');
  return identity.revision;
}

/** Only translate the embedded PostgreSQL loopback into this same container's private address. */
export function embeddedStagingBackupEnvironment(input: {
  env: Partial<NodeJS.ProcessEnv>;
  platform: NodeJS.Platform;
  uid: number | undefined;
  alpineRelease: string;
  buildRevision: string;
  addresses: readonly string[];
}) {
  const invalid = () => new Error('Embedded staging backup configuration refused.');
  const { env } = input;
  if (
    input.platform !== 'linux' ||
    input.uid !== 70 ||
    !/^3\.24\.\d+\s*$/.test(input.alpineRelease) ||
    !/^[a-f0-9]{40}$/.test(input.buildRevision) ||
    (env.OPS_SOURCE_REVISION !== undefined && env.OPS_SOURCE_REVISION !== input.buildRevision) ||
    env.APP_ENV !== 'staging' ||
    env.NODE_ENV !== 'production' ||
    !env.DATABASE_URI
  )
    throw invalid();
  const database = URL.parse(env.DATABASE_URI);
  const addresses = [...new Set(input.addresses.filter(privateAddress))];
  if (
    !database ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['127.0.0.1', 'localhost'].includes(database.hostname) ||
    (database.port && database.port !== '5432') ||
    !database.username ||
    !database.password ||
    !/^\/[a-z_][a-z0-9_]{0,62}$/.test(database.pathname) ||
    database.search ||
    database.hash ||
    addresses.length !== 1
  )
    throw invalid();
  database.hostname = addresses[0];
  database.port = '5432';
  const target = `${database.hostname}:5432/${database.pathname.slice(1)}`;
  if (env.OPS_STAGING_DATABASE_TARGET && env.OPS_STAGING_DATABASE_TARGET !== target)
    throw invalid();
  return {
    DATABASE_URI: database.href,
    OPS_STAGING_DATABASE_TARGET: target,
    OPS_SOURCE_REVISION: input.buildRevision,
  };
}

/** Migrations remain explicit operator actions; the reviewed runner backs up before DDL. */
export function embeddedOperationalCommand(
  args: readonly string[],
  env: Partial<NodeJS.ProcessEnv>,
) {
  const [command] = args;
  if (
    args.length !== 1 ||
    (command !== 'backup' && command !== 'migrate') ||
    (command === 'migrate' && env.OPS_ALLOW_REVIEWED_MIGRATION !== 'true')
  )
    throw new Error('Embedded staging operation requires an explicit reviewed command.');
  return command;
}

async function main() {
  const command = embeddedOperationalCommand(process.argv.slice(2), process.env);
  Object.assign(
    process.env,
    embeddedStagingBackupEnvironment({
      env: process.env,
      platform: process.platform,
      uid: process.getuid?.(),
      alpineRelease: readFileSync('/etc/alpine-release', 'utf8'),
      buildRevision: embeddedBuildRevision(
        JSON.parse(readFileSync('/app/ops/image/build-identity.json', 'utf8')),
      ),
      addresses: Object.values(networkInterfaces())
        .flatMap((items) => items ?? [])
        .filter((item) => item.family === 'IPv4' && !item.internal)
        .map((item) => item.address),
    }),
  );
  return runOperationalBackupJob({
    args: [command],
    tools: { ageBinary: '/opt/adfl-age/age', tarBinary: '/usr/bin/tar' },
    pgDumpBinary: '/usr/local/bin/pg_dump',
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const exit = await main().then(
    (result) => {
      writeSync(1, JSON.stringify(result) + '\n');
      return 0;
    },
    () => {
      writeSync(2, 'Embedded staging backup failed.\n');
      return 1;
    },
  );
  process.exit(exit);
}
