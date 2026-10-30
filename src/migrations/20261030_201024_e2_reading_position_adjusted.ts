import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_navigation" ADD COLUMN "messages_reading_position_adjusted" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_messages_reading_position_adjusted" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_navigation" DROP COLUMN "messages_reading_position_adjusted";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_messages_reading_position_adjusted";`);
}
