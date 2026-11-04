import 'server-only';
import { z } from 'zod';
import type { ServerEnv } from './server-env';
import type { EditorialResendConfiguration } from '@/helpers/payload/editorial-email';

const secret = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value && !/[\r\n]/.test(value));
const storageSchema = z.object({
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname)
    );
  }),
  bucket: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  accessKeyId: secret,
  secretAccessKey: secret,
});
const resendSchema = z.object({
  apiKey: secret,
  fromAddress: z
    .email()
    .refine((value) => value.split('@')[1]?.toLowerCase() === 'mail.joeldorosarioo.dev'),
  fromName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => !/[\r\n<>]/.test(value)),
});
export type IntegrationEnvironment = {
  storage: { driver: 'local' } | ({ driver: 'r2' } & z.infer<typeof storageSchema>);
  resend?: EditorialResendConfiguration;
};
function invalidConfiguration(): never {
  // Never include the input or upstream validation issues: they may contain secrets.
  throw new Error(
    'Integration configuration is incomplete or invalid. Check the private environment configuration.',
  );
}
export function readIntegrationEnv(
  input: Partial<NodeJS.ProcessEnv>,
  env: ServerEnv,
): IntegrationEnvironment {
  const deployed = env.APP_ENV === 'staging' || env.APP_ENV === 'production';
  const driver = input.MEDIA_STORAGE_DRIVER ?? (deployed ? 'r2' : 'local');
  if (
    !['local', 'r2'].includes(driver) ||
    (deployed && driver !== 'r2') ||
    (env.APP_ENV === 'test' && driver !== 'local')
  )
    invalidConfiguration();
  let storage: IntegrationEnvironment['storage'] = { driver: 'local' };
  if (driver === 'r2') {
    const parsed = storageSchema.safeParse({
      endpoint: input.R2_ENDPOINT,
      bucket: env.MEDIA_BUCKET,
      accessKeyId: input.R2_ACCESS_KEY_ID,
      secretAccessKey: input.R2_SECRET_ACCESS_KEY,
    });
    if (!parsed.success) invalidConfiguration();
    storage = { driver: 'r2', ...parsed.data };
  }
  if (!deployed) return { storage };
  const resend = resendSchema.safeParse({
    apiKey: input.RESEND_API_KEY,
    fromAddress: input.EDITORIAL_EMAIL_FROM_ADDRESS,
    fromName: input.EDITORIAL_EMAIL_FROM_NAME,
  });
  if (!resend.success) invalidConfiguration();
  return { storage, resend: resend.data };
}
