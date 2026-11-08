import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_content" ADD COLUMN "card_title" varchar;
  ALTER TABLE "case_content" ADD COLUMN "card_eyebrow" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_card_title" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_card_eyebrow" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_content" DROP COLUMN "card_title";
  ALTER TABLE "case_content" DROP COLUMN "card_eyebrow";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_card_title";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_card_eyebrow";`);
}
