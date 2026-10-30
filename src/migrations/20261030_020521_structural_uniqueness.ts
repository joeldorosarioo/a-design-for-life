import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "site_navigation_locale_idx" ON "site_navigation" USING btree ("locale");
  CREATE INDEX "_site_navigation_v_version_version_locale_idx" ON "_site_navigation_v" USING btree ("version_locale");
  CREATE UNIQUE INDEX "profiles_locale_idx" ON "profiles" USING btree ("locale");
  CREATE INDEX "_profiles_v_version_version_locale_idx" ON "_profiles_v" USING btree ("version_locale");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "site_navigation_locale_idx";
  DROP INDEX "_site_navigation_v_version_version_locale_idx";
  DROP INDEX "profiles_locale_idx";
  DROP INDEX "_profiles_v_version_version_locale_idx";`);
}
