import path from 'node:path';
import { createHash } from 'node:crypto';
export function publicRootDirectory(input: {
  APP_ENV: string;
  SITE_ORIGIN: string;
  DATABASE_URI: string;
}) {
  return path.resolve(
    '.work/publication',
    createHash('sha256')
      .update(input.APP_ENV + input.SITE_ORIGIN + new URL(input.DATABASE_URI).pathname)
      .digest('hex'),
  );
}
