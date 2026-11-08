import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_content" DROP CONSTRAINT "case_content_case_id_cases_id_fk";

  ALTER TABLE "_case_content_v" DROP CONSTRAINT "_case_content_v_version_case_id_cases_id_fk";

  ALTER TABLE "case_routes" DROP CONSTRAINT "case_routes_case_id_cases_id_fk";

  ALTER TABLE "case_content" ADD CONSTRAINT "case_content_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_version_case_id_cases_id_fk" FOREIGN KEY ("version_case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "case_routes" ADD CONSTRAINT "case_routes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_content" DROP CONSTRAINT "case_content_case_id_cases_id_fk";

  ALTER TABLE "_case_content_v" DROP CONSTRAINT "_case_content_v_version_case_id_cases_id_fk";

  ALTER TABLE "case_routes" DROP CONSTRAINT "case_routes_case_id_cases_id_fk";

  ALTER TABLE "case_content" ADD CONSTRAINT "case_content_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_version_case_id_cases_id_fk" FOREIGN KEY ("version_case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_routes" ADD CONSTRAINT "case_routes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;`);
}
