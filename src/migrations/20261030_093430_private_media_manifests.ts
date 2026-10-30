import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_state" AS ENUM('ready', 'deleted');
  ALTER TABLE "media" ADD COLUMN "label" varchar;
  ALTER TABLE "media" ADD COLUMN "manifest" jsonb;
  ALTER TABLE "media" ADD COLUMN "usages" jsonb;
  ALTER TABLE "media" ADD COLUMN "guard_revision" varchar;
  ALTER TABLE "media" ADD COLUMN "state" "enum_media_state";
  ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  CREATE INDEX "media_deleted_at_idx" ON "media" USING btree ("deleted_at");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_deleted_at_idx";
  ALTER TABLE "media" DROP COLUMN "label";
  ALTER TABLE "media" DROP COLUMN "manifest";
  ALTER TABLE "media" DROP COLUMN "usages";
  ALTER TABLE "media" DROP COLUMN "guard_revision";
  ALTER TABLE "media" DROP COLUMN "state";
  ALTER TABLE "media" DROP COLUMN "deleted_at";
  DROP TYPE "public"."enum_media_state";`);
}
