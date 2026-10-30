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
import { installMediaRuntime } from './features/media-library/server/media-runtime';
import { readServerEnv } from './config/server-env';
import { usersCollection } from './helpers/payload/users.collection';
import { editorialEmailAdapter } from './helpers/payload/editorial-email';
import { nativePreviewURL } from './helpers/payload/preview-session';
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
const Users = usersCollection(env.SITE_ORIGIN);
installMediaRuntime({
  root:
    env.MEDIA_STORAGE_ROOT ??
    path.resolve(
      '.work/private-media',
      env.MEDIA_BUCKET,
      new URL(env.DATABASE_URI).pathname.slice(1),
    ),
  checkerBinary:
    env.MEDIA_CHECKER_BINARY ??
    path.resolve(
      ` .toolchain/qpdf-12.4.2-${process.platform}-${process.arch}/bin/${process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'}`.trim(),
    ),
});

const config = buildConfig({
  secret: env.PAYLOAD_SECRET,
  email: editorialEmailAdapter(env.APP_ENV, env.DATABASE_URI),
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
  collections: [
    Users,
    Cases,
    CaseContent,
    CaseRoutes,
    SiteNavigation,
    ProfessionalProfiles,
    Media,
  ].map((collection) =>
    ['case-content', 'site-navigation', 'professional-profiles'].includes(collection.slug)
      ? {
          ...collection,
          admin: {
            ...collection.admin,
            preview: (document: Record<string, unknown>) =>
              nativePreviewURL(
                collection.slug as 'case-content' | 'site-navigation' | 'professional-profiles',
                document,
              ),
          },
        }
      : collection,
  ),
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
  upload: { limits: { fileSize: 10_000_000 }, abortOnLimit: true },
  cors: [env.SITE_ORIGIN],
  csrf: [env.SITE_ORIGIN],
  graphQL: { disable: true },
  telemetry: false,
  typescript: { outputFile: path.resolve(sourceDirectory, 'payload-types.ts') },
});

installPayloadProvider(() => getPayload({ config }));
export default config;
