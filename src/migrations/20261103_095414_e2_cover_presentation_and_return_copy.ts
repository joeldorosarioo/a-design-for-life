import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_case_content_cover_presentation" AS ENUM('contained-cherry', 'contained-soft');
  CREATE TYPE "public"."enum__case_content_v_version_cover_presentation" AS ENUM('contained-cherry', 'contained-soft');
  ALTER TABLE "case_content" ADD COLUMN "cover_presentation" "enum_case_content_cover_presentation";
  ALTER TABLE "_case_content_v" ADD COLUMN "version_cover_presentation" "enum__case_content_v_version_cover_presentation";
  ALTER TABLE "site_navigation" ADD COLUMN "controls_back_to_projects_label" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_controls_back_to_projects_label" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_content" DROP COLUMN "cover_presentation";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_cover_presentation";
  ALTER TABLE "site_navigation" DROP COLUMN "controls_back_to_projects_label";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_controls_back_to_projects_label";
  DROP TYPE "public"."enum_case_content_cover_presentation";
  DROP TYPE "public"."enum__case_content_v_version_cover_presentation";`);
}
