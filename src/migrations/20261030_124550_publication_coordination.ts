import { captureLegacyPublications } from '../config/capture-legacy-publications';
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_case_content_sections_presentation" AS ENUM('narrative', 'process', 'comparison', 'learnings');
  CREATE TYPE "public"."enum__case_content_v_version_sections_presentation" AS ENUM('narrative', 'process', 'comparison', 'learnings');
  CREATE TYPE "public"."enum_publication_updates_subject_collection" AS ENUM('cases', 'case-content', 'professional-profiles', 'site-navigation');
  CREATE TYPE "public"."enum_publication_updates_state" AS ENUM('update-pending', 'public', 'superseded');
  CREATE TABLE "publication_updates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "operation_id" varchar NOT NULL,
    "subject_collection" "enum_publication_updates_subject_collection" NOT NULL,
    "subject_id" varchar NOT NULL,
    "target_revision" varchar NOT NULL,
    "dependencies" jsonb NOT NULL,
    "target" jsonb NOT NULL,
    "state" "enum_publication_updates_state" DEFAULT 'update-pending' NOT NULL,
    "attempts" numeric DEFAULT 0 NOT NULL,
    "diagnostic" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "cases" ADD COLUMN "latest_publication_intent" varchar;
  ALTER TABLE "cases" ADD COLUMN "public_confirmed" boolean DEFAULT false;
  ALTER TABLE "case_content_blocks_text" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "case_content_blocks_text" ADD COLUMN "heading" varchar;
  ALTER TABLE "case_content_blocks_text" ADD COLUMN "note" varchar;
  ALTER TABLE "case_content_sections" ADD COLUMN "presentation" "enum_case_content_sections_presentation" DEFAULT 'narrative';
  ALTER TABLE "case_content_sections" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "case_content_sections" ADD COLUMN "description" varchar;
  ALTER TABLE "case_content_sections" ADD COLUMN "note" varchar;
  ALTER TABLE "case_content" ADD COLUMN "title_emphasis" varchar;
  ALTER TABLE "case_content" ADD COLUMN "latest_publication_intent" varchar;
  ALTER TABLE "case_content" ADD COLUMN "public_confirmed" boolean DEFAULT false;
  ALTER TABLE "_case_content_v_blocks_text" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "_case_content_v_blocks_text" ADD COLUMN "heading" varchar;
  ALTER TABLE "_case_content_v_blocks_text" ADD COLUMN "note" varchar;
  ALTER TABLE "_case_content_v_version_sections" ADD COLUMN "presentation" "enum__case_content_v_version_sections_presentation" DEFAULT 'narrative';
  ALTER TABLE "_case_content_v_version_sections" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "_case_content_v_version_sections" ADD COLUMN "description" varchar;
  ALTER TABLE "_case_content_v_version_sections" ADD COLUMN "note" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_title_emphasis" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_latest_publication_intent" varchar;
  ALTER TABLE "_case_content_v" ADD COLUMN "version_public_confirmed" boolean DEFAULT false;
  ALTER TABLE "site_navigation" ADD COLUMN "latest_publication_intent" varchar;
  ALTER TABLE "site_navigation" ADD COLUMN "public_confirmed" boolean DEFAULT false;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_latest_publication_intent" varchar;
  ALTER TABLE "_site_navigation_v" ADD COLUMN "version_public_confirmed" boolean DEFAULT false;
  ALTER TABLE "profiles" ADD COLUMN "latest_publication_intent" varchar;
  ALTER TABLE "profiles" ADD COLUMN "public_confirmed" boolean DEFAULT false;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_latest_publication_intent" varchar;
  ALTER TABLE "_profiles_v" ADD COLUMN "version_public_confirmed" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "publication_updates_id" uuid;
  CREATE UNIQUE INDEX "publication_updates_operation_id_idx" ON "publication_updates" USING btree ("operation_id");
  CREATE INDEX "publication_updates_subject_id_idx" ON "publication_updates" USING btree ("subject_id");
  CREATE INDEX "publication_updates_updated_at_idx" ON "publication_updates" USING btree ("updated_at");
  CREATE INDEX "publication_updates_created_at_idx" ON "publication_updates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_publication_updates_fk" FOREIGN KEY ("publication_updates_id") REFERENCES "public"."publication_updates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cases_latest_publication_intent_idx" ON "cases" USING btree ("latest_publication_intent");
  CREATE INDEX "case_content_latest_publication_intent_idx" ON "case_content" USING btree ("latest_publication_intent");
  CREATE INDEX "_case_content_v_version_version_latest_publication_inten_idx" ON "_case_content_v" USING btree ("version_latest_publication_intent");
  CREATE INDEX "site_navigation_latest_publication_intent_idx" ON "site_navigation" USING btree ("latest_publication_intent");
  CREATE INDEX "_site_navigation_v_version_version_latest_publication_in_idx" ON "_site_navigation_v" USING btree ("version_latest_publication_intent");
  CREATE INDEX "profiles_latest_publication_intent_idx" ON "profiles" USING btree ("latest_publication_intent");
  CREATE INDEX "_profiles_v_version_version_latest_publication_intent_idx" ON "_profiles_v" USING btree ("version_latest_publication_intent");
  CREATE INDEX "payload_locked_documents_rels_publication_updates_id_idx" ON "payload_locked_documents_rels" USING btree ("publication_updates_id");`);
  await captureLegacyPublications(req);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publication_updates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_publication_updates_fk";
  DROP TABLE "publication_updates" CASCADE;

  DROP INDEX "cases_latest_publication_intent_idx";
  DROP INDEX "case_content_latest_publication_intent_idx";
  DROP INDEX "_case_content_v_version_version_latest_publication_inten_idx";
  DROP INDEX "site_navigation_latest_publication_intent_idx";
  DROP INDEX "_site_navigation_v_version_version_latest_publication_in_idx";
  DROP INDEX "profiles_latest_publication_intent_idx";
  DROP INDEX "_profiles_v_version_version_latest_publication_intent_idx";
  DROP INDEX "payload_locked_documents_rels_publication_updates_id_idx";
  ALTER TABLE "cases" DROP COLUMN "latest_publication_intent";
  ALTER TABLE "cases" DROP COLUMN "public_confirmed";
  ALTER TABLE "case_content_blocks_text" DROP COLUMN "eyebrow";
  ALTER TABLE "case_content_blocks_text" DROP COLUMN "heading";
  ALTER TABLE "case_content_blocks_text" DROP COLUMN "note";
  ALTER TABLE "case_content_sections" DROP COLUMN "presentation";
  ALTER TABLE "case_content_sections" DROP COLUMN "eyebrow";
  ALTER TABLE "case_content_sections" DROP COLUMN "description";
  ALTER TABLE "case_content_sections" DROP COLUMN "note";
  ALTER TABLE "case_content" DROP COLUMN "title_emphasis";
  ALTER TABLE "case_content" DROP COLUMN "latest_publication_intent";
  ALTER TABLE "case_content" DROP COLUMN "public_confirmed";
  ALTER TABLE "_case_content_v_blocks_text" DROP COLUMN "eyebrow";
  ALTER TABLE "_case_content_v_blocks_text" DROP COLUMN "heading";
  ALTER TABLE "_case_content_v_blocks_text" DROP COLUMN "note";
  ALTER TABLE "_case_content_v_version_sections" DROP COLUMN "presentation";
  ALTER TABLE "_case_content_v_version_sections" DROP COLUMN "eyebrow";
  ALTER TABLE "_case_content_v_version_sections" DROP COLUMN "description";
  ALTER TABLE "_case_content_v_version_sections" DROP COLUMN "note";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_title_emphasis";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_latest_publication_intent";
  ALTER TABLE "_case_content_v" DROP COLUMN "version_public_confirmed";
  ALTER TABLE "site_navigation" DROP COLUMN "latest_publication_intent";
  ALTER TABLE "site_navigation" DROP COLUMN "public_confirmed";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_latest_publication_intent";
  ALTER TABLE "_site_navigation_v" DROP COLUMN "version_public_confirmed";
  ALTER TABLE "profiles" DROP COLUMN "latest_publication_intent";
  ALTER TABLE "profiles" DROP COLUMN "public_confirmed";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_latest_publication_intent";
  ALTER TABLE "_profiles_v" DROP COLUMN "version_public_confirmed";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "publication_updates_id";
  DROP TYPE "public"."enum_case_content_sections_presentation";
  DROP TYPE "public"."enum__case_content_v_version_sections_presentation";
  DROP TYPE "public"."enum_publication_updates_subject_collection";
  DROP TYPE "public"."enum_publication_updates_state";`);
}
