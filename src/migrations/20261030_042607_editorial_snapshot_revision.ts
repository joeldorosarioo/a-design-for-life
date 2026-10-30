import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cases" ADD COLUMN "content_revision" varchar;
  ALTER TABLE "case_content" ADD COLUMN "content_revision" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_content_revision" varchar;
  ALTER TABLE "site_navigation" ADD COLUMN "content_revision" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_content_revision" varchar;
  ALTER TABLE "profiles" ADD COLUMN "content_revision" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_content_revision" varchar;
  UPDATE "cases" SET "content_revision"="editorial_revision";
  UPDATE "case_content" SET "content_revision"="editorial_revision";
  UPDATE "_case_content_v" SET "version_content_revision"=gen_random_uuid()::text;
  UPDATE "case_content" d SET "editorial_revision"=v."version_content_revision",
    "content_revision"=CASE WHEN v."version__status"='published' THEN v."version_content_revision" ELSE d."content_revision" END
    FROM "_case_content_v" v WHERE v."parent_id"=d."id" AND v."latest"=true;
  UPDATE "site_navigation" SET "content_revision"="editorial_revision";
  UPDATE "_site_navigation_v" SET "version_content_revision"=gen_random_uuid()::text;
  UPDATE "site_navigation" d SET "editorial_revision"=v."version_content_revision",
    "content_revision"=CASE WHEN v."version__status"='published' THEN v."version_content_revision" ELSE d."content_revision" END
    FROM "_site_navigation_v" v WHERE v."parent_id"=d."id" AND v."latest"=true;
  UPDATE "profiles" SET "content_revision"="editorial_revision";
  UPDATE "_profiles_v" SET "version_content_revision"=gen_random_uuid()::text;
  UPDATE "profiles" d SET "editorial_revision"=v."version_content_revision",
    "content_revision"=CASE WHEN v."version__status"='published' THEN v."version_content_revision" ELSE d."content_revision" END
    FROM "_profiles_v" v WHERE v."parent_id"=d."id" AND v."latest"=true;
`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cases" DROP COLUMN "content_revision";
  ALTER TABLE "case_content" DROP COLUMN "content_revision";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_content_revision";
  ALTER TABLE "site_navigation" DROP COLUMN "content_revision";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_content_revision";
  ALTER TABLE "profiles" DROP COLUMN "content_revision";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_content_revision";`);
}
