import 'server-only';
import { createLocalReq, getPayload } from 'payload';

import { readServerEnv } from './server-env';
import { bootstrapLegacyPublications } from './bootstrap-publications';
const env = readServerEnv(process.env);
if (!['local', 'test'].includes(env.APP_ENV))
  throw new Error('Publication bootstrap requires local or isolated-test mode.');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config, disableOnInit: true });
try {
  const count = await bootstrapLegacyPublications(await createLocalReq({}, payload));
  payload.logger.info(`Confirmed ${count} captured legacy publication operations.`);
} finally {
  await payload.destroy();
}
