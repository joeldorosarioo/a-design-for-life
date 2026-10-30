import 'server-only';
import { createLocalReq, getPayload } from 'payload';
import config from '@payload-config';
import { readServerEnv } from './server-env';
import { bootstrapLegacyPublications } from './bootstrap-publications';
const env = readServerEnv(process.env);
if (!['local', 'test'].includes(env.APP_ENV))
  throw new Error('This stage authorizes only local or isolated-test publication bootstrap.');
const payload = await getPayload({ config, disableOnInit: true });
try {
  const count = await bootstrapLegacyPublications(await createLocalReq({}, payload));
  payload.logger.info(`Confirmed ${count} captured legacy publication operations.`);
} finally {
  await payload.destroy();
}
