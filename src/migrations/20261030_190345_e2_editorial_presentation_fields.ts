import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_navigation" ADD COLUMN "controls_case_link_label" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_controls_case_link_label" varchar;
  ALTER TABLE "profiles_approach_methods" ADD COLUMN "keywords" varchar;
  ALTER TABLE "profiles" ADD COLUMN "about_journey_eyebrow" varchar;
  ALTER TABLE "profiles" ADD COLUMN "about_approach_eyebrow" varchar;
  ALTER TABLE "profiles" ADD COLUMN "about_in_motion_eyebrow" varchar;
  ALTER TABLE "_profiles_v_version_approach_methods" ADD COLUMN "keywords" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_about_journey_eyebrow" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_about_approach_eyebrow" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_about_in_motion_eyebrow" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_navigation" DROP COLUMN "controls_case_link_label";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_controls_case_link_label";
  ALTER TABLE "profiles_approach_methods" DROP COLUMN "keywords";
  ALTER TABLE "profiles" DROP COLUMN "about_journey_eyebrow";
  ALTER TABLE "profiles" DROP COLUMN "about_approach_eyebrow";
  ALTER TABLE "profiles" DROP COLUMN "about_in_motion_eyebrow";
  ALTER TABLE "_profiles_v_version_approach_methods" DROP COLUMN "keywords";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_about_journey_eyebrow";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_about_approach_eyebrow";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_about_in_motion_eyebrow";`);
}
