import 'server-only';
import { writeSync } from 'node:fs';
import { getPayload } from 'payload';
import { provisionLocalEditor, readLocalEditorCredentials } from './provision-local-editor';

// Explicit local operator command. Validate credentials before loading the application config.
async function main() {
  const credentials = readLocalEditorCredentials(process.env);
  const { default: config } = await import('@payload-config');
  const payload = await getPayload({
    config,
    disableDBConnect: true,
    disableOnInit: true,
  });
  payload.logger.level = 'silent';
  try {
    await payload.db.connect!();
    const result = await provisionLocalEditor(payload, credentials);
    writeSync(
      1,
      result === 'created'
        ? 'Local editorial account created.\n'
        : 'Local editorial account exists.\n',
    );
  } finally {
    await payload.destroy();
  }
}

try {
  await main();
} catch {
  throw new Error(
    'Local editor provisioning failed. Check APP_ENV, private credentials and the migrated database.',
  );
}
