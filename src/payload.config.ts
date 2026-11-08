import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { readServerEnv } from './config/server-env';
import { Users } from './helpers/payload/users.collection';

loadEnv({ quiet: true });
const env = readServerEnv(process.env);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: env.SITE_ORIGIN,
  admin: {
    user: Users.slug,
    importMap: { baseDir: sourceDirectory },
  },
  db: postgresAdapter({
    pool: { connectionString: env.DATABASE_URI },
    idType: 'uuid',
    migrationDir: path.resolve(sourceDirectory, 'migrations'),
    push: false,
    disableCreateDatabase: true,
  }),
  collections: [Users],
  editor: lexicalEditor(),
  sharp,
  cors: [env.SITE_ORIGIN],
  csrf: [env.SITE_ORIGIN],
  graphQL: { disable: true },
  telemetry: false,
  typescript: { outputFile: path.resolve(sourceDirectory, 'payload-types.ts') },
});
