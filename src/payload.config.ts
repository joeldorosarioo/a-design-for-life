import { provisionStructuralDocuments } from './config/provision-structural-documents';
import { withConfirmedTransactions } from './helpers/payload/transaction-settlement';
import { publicRootDirectory } from './helpers/payload/public-root-directory';
import { installPublicationProvider } from './helpers/payload/publication-runtime';
import { portfolioPublicationCoordinator } from './config/publication';
import {
  casePublicationAdapter,
  caseOrderPublicationAdapter,
} from './features/cases/server/case-publication';
import { profilePublicationAdapter } from './features/professional-profile/server/profile-publication';
import { navigationPublicationAdapter } from './features/site-navigation/server/navigation-publication';
import { PublicationUpdates } from './helpers/payload/publication-updates.collection';
import { PublicationRetries } from './helpers/payload/publication-retries.collection';
import { publicationFields } from './helpers/payload/publication-fields';
import { editorialError } from './helpers/payload/editorial-revision';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { en } from '@payloadcms/translations/languages/en';
import { pt } from '@payloadcms/translations/languages/pt';
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
import { getPayload, buildConfig, type PayloadRequest } from 'payload';
import { installMediaRuntime } from './features/media-library/server/media-runtime';
import { readServerEnv, resolveInternalHttpOrigin } from './config/server-env';
import { payloadRuntimeLoggerOptions } from './helpers/logger';
import { readIntegrationEnv } from './config/integration-env';
import { dependencyDiagnostics } from './config/dependency-diagnostics';
import { createR2ObjectStorage } from './helpers/storage/r2-storage';
import { restoreReadOnlyMedia } from './helpers/storage/restore-read-only';
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
const siteOrigin = new URL(env.SITE_ORIGIN).origin;
const integrations = readIntegrationEnv(process.env, env);
const r2Storage = restoreReadOnlyMedia(
  integrations.storage.driver === 'r2' ? createR2ObjectStorage(integrations.storage) : undefined,
  env,
  process.env.RESTORE_READ_ONLY_MEDIA,
);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const Users = usersCollection(siteOrigin, {
  enabled: env.EDITORIAL_FIRST_ACCESS_ENABLED === 'true',
  appEnv: env.APP_ENV,
  publicSiteEnabled: env.PUBLIC_SITE_ENABLED === 'true',
  databaseUri: env.DATABASE_URI,
  mediaBucket: env.MEDIA_BUCKET,
  provisionStructuralDocuments,
});
const publicationDirectory = publicRootDirectory(env);
const verificationOrigin =
  env.PUBLICATION_HTTP_VERIFICATION_ENABLED === 'true' && resolveInternalHttpOrigin(env);
installPublicationProvider(() =>
  portfolioPublicationCoordinator(
    publicationDirectory,
    verificationOrigin
      ? { internalOrigin: verificationOrigin, siteOrigin: env.SITE_ORIGIN }
      : undefined,
  ),
);
installMediaRuntime({
  ...(r2Storage
    ? { storage: r2Storage }
    : {
        root:
          env.MEDIA_STORAGE_ROOT ??
          path.resolve(
            '.work/private-media',
            env.MEDIA_BUCKET,
            new URL(env.DATABASE_URI).pathname.slice(1),
          ),
      }),
  checkerBinary:
    env.MEDIA_CHECKER_BINARY ??
    path.resolve(
      ` .toolchain/qpdf-12.4.2-${process.platform}-${process.arch}/bin/${process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'}`.trim(),
    ),
});

const config = buildConfig({
  secret: env.PAYLOAD_SECRET,
  i18n: { fallbackLanguage: 'pt', supportedLanguages: { pt, en } },
  logger: payloadRuntimeLoggerOptions(env.APP_ENV),
  email: editorialEmailAdapter(env.APP_ENV, env.DATABASE_URI, integrations.resend),
  hooks: { afterError: [editorialError, caseEditorialError] },
  serverURL: siteOrigin,
  admin: {
    avatar: 'default',
    user: Users.slug,
    importMap: { baseDir: sourceDirectory },
  },
  db: withConfirmedTransactions(
    postgresAdapter({
      pool: { connectionString: env.DATABASE_URI },
      beforeSchemaInit: [protectCaseIdentitySchema],
      idType: 'uuid',
      migrationDir: path.resolve(sourceDirectory, 'migrations'),
      push: false,
      disableCreateDatabase: true,
    }),
  ),
  endpoints: [
    {
      path: '/operations/diagnostics',
      method: 'get',
      handler: dependencyDiagnostics<PayloadRequest>({
        postgresql: async (req) => {
          const query = { text: 'SELECT 1', query_timeout: 1_500 };
          await req.payload.db.pool.query(query);
        },
        r2: r2Storage?.checkBucket,
      }),
    },
  ],
  collections: [
    Users,
    publicationFields(Cases, caseOrderPublicationAdapter),
    publicationFields(CaseContent, casePublicationAdapter),
    CaseRoutes,
    publicationFields(SiteNavigation, navigationPublicationAdapter),
    publicationFields(ProfessionalProfiles, profilePublicationAdapter),
    Media,
    PublicationUpdates,
    // Default OFF: apply the additive migration before operational opt-in.
    ...(env.PUBLICATION_RETRIES_ENABLED === 'true' ? [PublicationRetries] : []),
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
  cors: [siteOrigin],
  csrf: [siteOrigin],
  graphQL: { disable: true },
  telemetry: false,
  typescript: { outputFile: path.resolve(sourceDirectory, 'payload-types.ts') },
});

installPayloadProvider(() => getPayload({ config }));
export default config;
