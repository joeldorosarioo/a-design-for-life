import { writeSync } from 'node:fs';
import { readServerEnv } from '../../src/config/server-env';
import { readIntegrationEnv } from '../../src/config/integration-env';
import { getPayload } from 'payload';
import { closeStagingPayload, initializeStaging } from './initialize';

async function main() {
  const env = readServerEnv(process.env);
  // Validate the imported real staging integrations before config's dotenv loader.
  if (
    env.APP_ENV !== 'staging' ||
    process.env.STAGING_DATABASE_ONLY !== 'true' ||
    process.env.PAYLOAD_DROP_DATABASE !== 'false'
  )
    throw new Error('Invalid operator phase.');
  readIntegrationEnv(process.env, env);
  if (
    !process.env.STAGING_OPERATOR_WORKDIR ||
    !process.env.STAGING_INITIALIZATION_DATABASE ||
    !['initialize', 'verify', 'prepare-first-access'].includes(
      process.env.STAGING_INITIALIZATION_MODE ?? '',
    ) ||
    (process.env.STAGING_INITIALIZATION_MODE !== 'prepare-first-access' &&
      (!process.env.STAGING_EDITOR_EMAIL || !process.env.STAGING_EDITOR_PASSWORD))
  )
    throw new Error('Missing private operator inputs.');
  // The fresh owned directory has no .env. Do not merge unrelated local settings
  // through payload.config's normal development dotenv loader.
  process.chdir(process.env.STAGING_OPERATOR_WORKDIR);
  const { default: configured } = await import('../../src/payload.config');
  const config = await configured;
  const payload = await getPayload({
    config: {
      ...config,
      logger: { options: { level: 'silent' } } as typeof config.logger,
      typescript: { ...config.typescript, autoGenerate: false },
    },
    disableDBConnect: true,
    disableOnInit: true,
    key: `staging-initialize-${crypto.randomUUID()}`,
  });
  try {
    const target = {
      databaseUri: env.DATABASE_URI,
      database: process.env.STAGING_INITIALIZATION_DATABASE,
      role: decodeURIComponent(new URL(env.DATABASE_URI).username),
      origin: env.SITE_ORIGIN,
    };
    const result =
      process.env.STAGING_INITIALIZATION_MODE === 'prepare-first-access'
        ? await initializeStaging(payload, { ...target, mode: 'prepare-first-access' })
        : await initializeStaging(payload, {
            ...target,
            mode: process.env.STAGING_INITIALIZATION_MODE as 'initialize' | 'verify',
            editor: {
              email: process.env.STAGING_EDITOR_EMAIL!,
              password: process.env.STAGING_EDITOR_PASSWORD!,
            },
          });
    writeSync(1, JSON.stringify(result));
  } finally {
    await closeStagingPayload(payload);
  }
}

void main().then(
  () => process.exit(0),
  () => {
    // The parent intentionally receives no upstream errors, SQL values or credentials.
    writeSync(2, 'Staging initialization refused or incomplete.\n');
    process.exit(1);
  },
);
