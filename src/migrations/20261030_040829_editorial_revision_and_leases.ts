import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cases" ADD COLUMN "editorial_revision" varchar;
  ALTER TABLE "cases" ADD COLUMN "lease_token" varchar;
  ALTER TABLE "cases" ADD COLUMN "lease_owner" varchar;
  ALTER TABLE "cases" ADD COLUMN "lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "case_content" ADD COLUMN "editorial_revision" varchar;
  ALTER TABLE "case_content" ADD COLUMN "lease_token" varchar;
  ALTER TABLE "case_content" ADD COLUMN "lease_owner" varchar;
  ALTER TABLE "case_content" ADD COLUMN "lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_editorial_revision" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_lease_token" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_lease_owner" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "site_navigation" ADD COLUMN "editorial_revision" varchar;
  ALTER TABLE "site_navigation" ADD COLUMN "lease_token" varchar;
  ALTER TABLE "site_navigation" ADD COLUMN "lease_owner" varchar;
  ALTER TABLE "site_navigation" ADD COLUMN "lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_editorial_revision" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_lease_token" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_lease_owner" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "profiles" ADD COLUMN "editorial_revision" varchar;
  ALTER TABLE "profiles" ADD COLUMN "lease_token" varchar;
  ALTER TABLE "profiles" ADD COLUMN "lease_owner" varchar;
  ALTER TABLE "profiles" ADD COLUMN "lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_editorial_revision" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_lease_token" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_lease_owner" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_lease_expires_at" timestamp(3) with time zone;
  UPDATE "cases" SET "editorial_revision" = gen_random_uuid()::text;
  UPDATE "case_content" SET "editorial_revision" = gen_random_uuid()::text;
  UPDATE "site_navigation" SET "editorial_revision" = gen_random_uuid()::text;
  UPDATE "profiles" SET "editorial_revision" = gen_random_uuid()::text;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cases" DROP COLUMN "editorial_revision";
  ALTER TABLE "cases" DROP COLUMN "lease_token";
  ALTER TABLE "cases" DROP COLUMN "lease_owner";
  ALTER TABLE "cases" DROP COLUMN "lease_expires_at";
  ALTER TABLE "case_content" DROP COLUMN "editorial_revision";
  ALTER TABLE "case_content" DROP COLUMN "lease_token";
  ALTER TABLE "case_content" DROP COLUMN "lease_owner";
  ALTER TABLE "case_content" DROP COLUMN "lease_expires_at";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_editorial_revision";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_lease_token";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_lease_owner";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_lease_expires_at";
  ALTER TABLE "site_navigation" DROP COLUMN "editorial_revision";
  ALTER TABLE "site_navigation" DROP COLUMN "lease_token";
  ALTER TABLE "site_navigation" DROP COLUMN "lease_owner";
  ALTER TABLE "site_navigation" DROP COLUMN "lease_expires_at";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_editorial_revision";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_lease_token";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_lease_owner";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_lease_expires_at";
  ALTER TABLE "profiles" DROP COLUMN "editorial_revision";
  ALTER TABLE "profiles" DROP COLUMN "lease_token";
  ALTER TABLE "profiles" DROP COLUMN "lease_owner";
  ALTER TABLE "profiles" DROP COLUMN "lease_expires_at";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_editorial_revision";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_lease_token";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_lease_owner";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_lease_expires_at";`);
}
