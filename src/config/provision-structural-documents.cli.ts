import 'server-only';
import { createLocalReq, getPayload } from 'payload';
import config from '@payload-config';
import { readServerEnv } from './server-env';
import { provisionStructuralDocuments } from './provision-structural-documents';

// Explicit post-migration operation. Never imported by config or application startup.
const env = readServerEnv(process.env);
if (!['local', 'test'].includes(env.APP_ENV)) {
  throw new Error('This stage only authorizes local or isolated-test provisioning.');
}
const payload = await getPayload({ config, disableOnInit: true });
try {
  const req = await createLocalReq({ context: { trustedStructuralProvisioning: true } }, payload);
  await provisionStructuralDocuments(req);
  payload.logger.info('Structural drafts provisioned: navigation and profile, pt/en.');
} finally {
  await payload.destroy();
}
