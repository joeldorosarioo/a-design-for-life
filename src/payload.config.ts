import { editorialError } from './helpers/payload/editorial-revision';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { postgresAdapter } from '@payloadcms/db-postgres';
import {
  lexicalEditor,
  ParagraphFeature,
  BoldFeature,
  ItalicFeature,
  OrderedListFeature,
  UnorderedListFeature,
  FixedToolbarFeature,
} from '@payloadcms/richtext-lexical';
import { installPayloadProvider } from './helpers/payload/runtime';
import { getPayload, buildConfig } from 'payload';
import sharp from 'sharp';
import { readServerEnv } from './config/server-env';
import { Users } from './helpers/payload/users.collection';
import { Cases } from './features/cases/content/collections/cases';
import { protectCaseIdentitySchema } from './features/cases/content/schema/protect-case-identity';
import { CaseContent } from './features/cases/content/collections/case-content';
import { CaseRoutes } from './features/cases/content/collections/case-routes';
import { SiteNavigation } from './features/site-navigation/content/collections/site-navigation';
import { ProfessionalProfiles } from './features/professional-profile/content/collections/professional-profiles';
import { contextualLinkFeature } from './features/cases/content/editor/contextual-link-feature';
import { caseEditorialError } from './features/cases/server/translate-case-conflict';
import { Media } from './features/media-library/content/collections/media';

loadEnv({ quiet: true });
const env = readServerEnv(process.env);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

const config = buildConfig({
  secret: env.PAYLOAD_SECRET,
  hooks: { afterError: [editorialError, caseEditorialError] },
  serverURL: env.SITE_ORIGIN,
  admin: {
    user: Users.slug,
    importMap: { baseDir: sourceDirectory },
  },
  db: postgresAdapter({
    pool: { connectionString: env.DATABASE_URI },
    beforeSchemaInit: [protectCaseIdentitySchema],
    idType: 'uuid',
    migrationDir: path.resolve(sourceDirectory, 'migrations'),
    push: false,
    disableCreateDatabase: true,
  }),
  collections: [Users, Cases, CaseContent, CaseRoutes, SiteNavigation, ProfessionalProfiles, Media],
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      BoldFeature(),
      ItalicFeature(),
      OrderedListFeature(),
      UnorderedListFeature(),
      contextualLinkFeature,
      FixedToolbarFeature(),
    ],
  }),
  sharp,
  cors: [env.SITE_ORIGIN],
  csrf: [env.SITE_ORIGIN],
  graphQL: { disable: true },
  telemetry: false,
  typescript: { outputFile: path.resolve(sourceDirectory, 'payload-types.ts') },
});

installPayloadProvider(() => getPayload({ config }));
export default config;
