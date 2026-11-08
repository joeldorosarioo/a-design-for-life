import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "case_locale_idx" ON "case_content" USING btree ("case_id","locale");
  CREATE INDEX "version_case_version_locale_idx" ON "_case_content_v" USING btree ("version_case_id","version_locale");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "case_locale_idx";
  DROP INDEX "version_case_version_locale_idx";`);
}
