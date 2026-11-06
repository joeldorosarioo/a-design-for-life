import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "publication_retries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"operation_id" varchar NOT NULL,
  	"retry_user_id" varchar,
  	"started_attempts_version" numeric DEFAULT 0 NOT NULL,
  	"automatic_attempts" numeric DEFAULT 0 NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE UNIQUE INDEX "publication_retries_operation_id_idx" ON "publication_retries" USING btree ("operation_id");
  CREATE INDEX "publication_retries_next_attempt_at_idx" ON "publication_retries" USING btree ("next_attempt_at");
  CREATE INDEX "publication_retries_updated_at_idx" ON "publication_retries" USING btree ("updated_at");
  CREATE INDEX "publication_retries_created_at_idx" ON "publication_retries" USING btree ("created_at");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "publication_retries" CASCADE;`);
}
