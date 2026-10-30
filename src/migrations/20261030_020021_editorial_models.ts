import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_case_content_blocks_image_pair_presentation" AS ENUM('pair', 'comparison');
  CREATE TYPE "public"."enum_case_content_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum_case_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__case_content_v_blocks_image_pair_presentation" AS ENUM('pair', 'comparison');
  CREATE TYPE "public"."enum__case_content_v_version_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum__case_content_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_case_routes_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum_case_routes_state" AS ENUM('draft', 'current', 'historical');
  CREATE TYPE "public"."enum_site_navigation_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum_site_navigation_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_navigation_v_version_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum__site_navigation_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_profiles_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum_profiles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__profiles_v_version_locale" AS ENUM('pt', 'en');
  CREATE TYPE "public"."enum__profiles_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "cases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "internal_title" varchar NOT NULL,
    "sort_order" numeric DEFAULT 0,
    "featured" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "case_content_blocks_text" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "content" jsonb,
    "block_name" varchar
  );

  CREATE TABLE "case_content_blocks_image" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "image_media_id" uuid,
    "image_decorative" boolean DEFAULT false,
    "image_alt" varchar,
    "image_caption" varchar,
    "block_name" varchar
  );

  CREATE TABLE "case_content_blocks_image_pair" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "presentation" "enum_case_content_blocks_image_pair_presentation" DEFAULT 'pair',
    "first_media_id" uuid,
    "first_decorative" boolean DEFAULT false,
    "first_alt" varchar,
    "first_caption" varchar,
    "second_media_id" uuid,
    "second_decorative" boolean DEFAULT false,
    "second_alt" varchar,
    "second_caption" varchar,
    "first_label" varchar,
    "second_label" varchar,
    "block_name" varchar
  );

  CREATE TABLE "case_content_sections" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "heading" varchar
  );

  CREATE TABLE "case_content" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "case_id" uuid,
    "locale" "enum_case_content_locale",
    "title" varchar,
    "summary" varchar,
    "introduction" varchar,
    "slug" varchar,
    "cover_media_id" uuid,
    "cover_decorative" boolean DEFAULT false,
    "cover_alt" varchar,
    "cover_caption" varchar,
    "role" varchar,
    "scope" varchar,
    "context_note" varchar,
    "seo_title" varchar,
    "seo_description" varchar,
    "seo_image_media_id" uuid,
    "seo_image_decorative" boolean DEFAULT false,
    "seo_image_alt" varchar,
    "seo_image_caption" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_case_content_status" DEFAULT 'draft'
  );

  CREATE TABLE "_case_content_v_blocks_text" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "content" jsonb,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "_case_content_v_blocks_image" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "image_media_id" uuid,
    "image_decorative" boolean DEFAULT false,
    "image_alt" varchar,
    "image_caption" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "_case_content_v_blocks_image_pair" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "_path" text NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "presentation" "enum__case_content_v_blocks_image_pair_presentation" DEFAULT 'pair',
    "first_media_id" uuid,
    "first_decorative" boolean DEFAULT false,
    "first_alt" varchar,
    "first_caption" varchar,
    "second_media_id" uuid,
    "second_decorative" boolean DEFAULT false,
    "second_alt" varchar,
    "second_caption" varchar,
    "first_label" varchar,
    "second_label" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "_case_content_v_version_sections" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "heading" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_case_content_v" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_id" uuid,
    "version_case_id" uuid,
    "version_locale" "enum__case_content_v_version_locale",
    "version_title" varchar,
    "version_summary" varchar,
    "version_introduction" varchar,
    "version_slug" varchar,
    "version_cover_media_id" uuid,
    "version_cover_decorative" boolean DEFAULT false,
    "version_cover_alt" varchar,
    "version_cover_caption" varchar,
    "version_role" varchar,
    "version_scope" varchar,
    "version_context_note" varchar,
    "version_seo_title" varchar,
    "version_seo_description" varchar,
    "version_seo_image_media_id" uuid,
    "version_seo_image_decorative" boolean DEFAULT false,
    "version_seo_image_alt" varchar,
    "version_seo_image_caption" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__case_content_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "case_routes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "locale" "enum_case_routes_locale" NOT NULL,
    "slug" varchar NOT NULL,
    "case_id" uuid NOT NULL,
    "content_id" uuid NOT NULL,
    "ever_published" boolean DEFAULT false NOT NULL,
    "state" "enum_case_routes_state" DEFAULT 'draft' NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "site_navigation" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "locale" "enum_site_navigation_locale",
    "header_brand_label" varchar,
    "header_projects_label" varchar,
    "header_about_label" varchar,
    "header_resume_label" varchar,
    "header_contact_label" varchar,
    "footer_eyebrow" varchar,
    "footer_title" varchar,
    "footer_description" varchar,
    "footer_email_label" varchar,
    "footer_linkedin_label" varchar,
    "footer_resume_label" varchar,
    "footer_copyright" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_site_navigation_status" DEFAULT 'draft'
  );

  CREATE TABLE "_site_navigation_v" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_id" uuid,
    "version_locale" "enum__site_navigation_v_version_locale",
    "version_header_brand_label" varchar,
    "version_header_projects_label" varchar,
    "version_header_about_label" varchar,
    "version_header_resume_label" varchar,
    "version_header_contact_label" varchar,
    "version_footer_eyebrow" varchar,
    "version_footer_title" varchar,
    "version_footer_description" varchar,
    "version_footer_email_label" varchar,
    "version_footer_linkedin_label" varchar,
    "version_footer_resume_label" varchar,
    "version_footer_copyright" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__site_navigation_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "profiles_home_about_trajectory" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "period" varchar,
    "title" varchar,
    "description" varchar
  );

  CREATE TABLE "profiles_approach_methods" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "reading_key" varchar,
    "title" varchar,
    "description" varchar
  );

  CREATE TABLE "profiles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "locale" "enum_profiles_locale",
    "identity_name" varchar,
    "identity_role" varchar,
    "home_eyebrow" varchar,
    "home_title" varchar,
    "home_title_emphasis" varchar,
    "home_description" varchar,
    "home_portrait_media_id" uuid,
    "home_portrait_decorative" boolean DEFAULT false,
    "home_portrait_alt" varchar,
    "home_portrait_caption" varchar,
    "home_projects_label" varchar,
    "home_about_eyebrow" varchar,
    "home_about_title" varchar,
    "home_about_description" varchar,
    "home_about_about_label" varchar,
    "approach_eyebrow" varchar,
    "approach_title" varchar,
    "approach_description" varchar,
    "about_eyebrow" varchar,
    "about_title" varchar,
    "about_description" varchar,
    "about_introduction_heading" varchar,
    "about_introduction" varchar,
    "about_portrait_media_id" uuid,
    "about_portrait_decorative" boolean DEFAULT false,
    "about_portrait_alt" varchar,
    "about_portrait_caption" varchar,
    "about_journey_heading" varchar,
    "about_journey" varchar,
    "about_desk_photograph_media_id" uuid,
    "about_desk_photograph_decorative" boolean DEFAULT false,
    "about_desk_photograph_alt" varchar,
    "about_desk_photograph_caption" varchar,
    "about_editorial_emphasis" varchar,
    "about_approach_heading" varchar,
    "about_approach" varchar,
    "about_architecture_photograph_media_id" uuid,
    "about_architecture_photograph_decorative" boolean DEFAULT false,
    "about_architecture_photograph_alt" varchar,
    "about_architecture_photograph_caption" varchar,
    "about_in_motion_heading" varchar,
    "about_in_motion" varchar,
    "about_closing_heading" varchar,
    "about_closing" varchar,
    "about_projects_label" varchar,
    "contacts_email" varchar,
    "contacts_linkedin" varchar,
    "resume_id" uuid,
    "seo_home_title" varchar,
    "seo_home_description" varchar,
    "seo_about_title" varchar,
    "seo_about_description" varchar,
    "seo_image_media_id" uuid,
    "seo_image_decorative" boolean DEFAULT false,
    "seo_image_alt" varchar,
    "seo_image_caption" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_profiles_status" DEFAULT 'draft'
  );

  CREATE TABLE "_profiles_v_version_home_about_trajectory" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "period" varchar,
    "title" varchar,
    "description" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_profiles_v_version_approach_methods" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reading_key" varchar,
    "title" varchar,
    "description" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_profiles_v" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_id" uuid,
    "version_locale" "enum__profiles_v_version_locale",
    "version_identity_name" varchar,
    "version_identity_role" varchar,
    "version_home_eyebrow" varchar,
    "version_home_title" varchar,
    "version_home_title_emphasis" varchar,
    "version_home_description" varchar,
    "version_home_portrait_media_id" uuid,
    "version_home_portrait_decorative" boolean DEFAULT false,
    "version_home_portrait_alt" varchar,
    "version_home_portrait_caption" varchar,
    "version_home_projects_label" varchar,
    "version_home_about_eyebrow" varchar,
    "version_home_about_title" varchar,
    "version_home_about_description" varchar,
    "version_home_about_about_label" varchar,
    "version_approach_eyebrow" varchar,
    "version_approach_title" varchar,
    "version_approach_description" varchar,
    "version_about_eyebrow" varchar,
    "version_about_title" varchar,
    "version_about_description" varchar,
    "version_about_introduction_heading" varchar,
    "version_about_introduction" varchar,
    "version_about_portrait_media_id" uuid,
    "version_about_portrait_decorative" boolean DEFAULT false,
    "version_about_portrait_alt" varchar,
    "version_about_portrait_caption" varchar,
    "version_about_journey_heading" varchar,
    "version_about_journey" varchar,
    "version_about_desk_photograph_media_id" uuid,
    "version_about_desk_photograph_decorative" boolean DEFAULT false,
    "version_about_desk_photograph_alt" varchar,
    "version_about_desk_photograph_caption" varchar,
    "version_about_editorial_emphasis" varchar,
    "version_about_approach_heading" varchar,
    "version_about_approach" varchar,
    "version_about_architecture_photograph_media_id" uuid,
    "version_about_architecture_photograph_decorative" boolean DEFAULT false,
    "version_about_architecture_photograph_alt" varchar,
    "version_about_architecture_photograph_caption" varchar,
    "version_about_in_motion_heading" varchar,
    "version_about_in_motion" varchar,
    "version_about_closing_heading" varchar,
    "version_about_closing" varchar,
    "version_about_projects_label" varchar,
    "version_contacts_email" varchar,
    "version_contacts_linkedin" varchar,
    "version_resume_id" uuid,
    "version_seo_home_title" varchar,
    "version_seo_home_description" varchar,
    "version_seo_about_title" varchar,
    "version_seo_about_description" varchar,
    "version_seo_image_media_id" uuid,
    "version_seo_image_decorative" boolean DEFAULT false,
    "version_seo_image_alt" varchar,
    "version_seo_image_caption" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__profiles_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "media" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cases_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "case_content_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "case_routes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_navigation_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "profiles_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "case_content_blocks_text" ADD CONSTRAINT "case_content_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_content_blocks_image" ADD CONSTRAINT "case_content_blocks_image_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_content_blocks_image" ADD CONSTRAINT "case_content_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_content_blocks_image_pair" ADD CONSTRAINT "case_content_blocks_image_pair_first_media_id_media_id_fk" FOREIGN KEY ("first_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_content_blocks_image_pair" ADD CONSTRAINT "case_content_blocks_image_pair_second_media_id_media_id_fk" FOREIGN KEY ("second_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_content_blocks_image_pair" ADD CONSTRAINT "case_content_blocks_image_pair_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_content_sections" ADD CONSTRAINT "case_content_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_content" ADD CONSTRAINT "case_content_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_content" ADD CONSTRAINT "case_content_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_content" ADD CONSTRAINT "case_content_seo_image_media_id_media_id_fk" FOREIGN KEY ("seo_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_text" ADD CONSTRAINT "_case_content_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_image" ADD CONSTRAINT "_case_content_v_blocks_image_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_image" ADD CONSTRAINT "_case_content_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_image_pair" ADD CONSTRAINT "_case_content_v_blocks_image_pair_first_media_id_media_id_fk" FOREIGN KEY ("first_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_image_pair" ADD CONSTRAINT "_case_content_v_blocks_image_pair_second_media_id_media_id_fk" FOREIGN KEY ("second_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v_blocks_image_pair" ADD CONSTRAINT "_case_content_v_blocks_image_pair_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_content_v_version_sections" ADD CONSTRAINT "_case_content_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_parent_id_case_content_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."case_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_version_case_id_cases_id_fk" FOREIGN KEY ("version_case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_version_cover_media_id_media_id_fk" FOREIGN KEY ("version_cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_content_v" ADD CONSTRAINT "_case_content_v_version_seo_image_media_id_media_id_fk" FOREIGN KEY ("version_seo_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_routes" ADD CONSTRAINT "case_routes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_routes" ADD CONSTRAINT "case_routes_content_id_case_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."case_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_navigation_v" ADD CONSTRAINT "_site_navigation_v_parent_id_site_navigation_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_navigation"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles_home_about_trajectory" ADD CONSTRAINT "profiles_home_about_trajectory_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "profiles_approach_methods" ADD CONSTRAINT "profiles_approach_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_home_portrait_media_id_media_id_fk" FOREIGN KEY ("home_portrait_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_about_portrait_media_id_media_id_fk" FOREIGN KEY ("about_portrait_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_about_desk_photograph_media_id_media_id_fk" FOREIGN KEY ("about_desk_photograph_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_about_architecture_photograph_media_id_media_id_fk" FOREIGN KEY ("about_architecture_photograph_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_resume_id_media_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_seo_image_media_id_media_id_fk" FOREIGN KEY ("seo_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v_version_home_about_trajectory" ADD CONSTRAINT "_profiles_v_version_home_about_trajectory_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_profiles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_profiles_v_version_approach_methods" ADD CONSTRAINT "_profiles_v_version_approach_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_profiles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_parent_id_profiles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_home_portrait_media_id_media_id_fk" FOREIGN KEY ("version_home_portrait_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_about_portrait_media_id_media_id_fk" FOREIGN KEY ("version_about_portrait_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_about_desk_photograph_media_id_media_id_fk" FOREIGN KEY ("version_about_desk_photograph_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_about_architecture_photograph_media_id_media_id_fk" FOREIGN KEY ("version_about_architecture_photograph_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_resume_id_media_id_fk" FOREIGN KEY ("version_resume_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_profiles_v" ADD CONSTRAINT "_profiles_v_version_seo_image_media_id_media_id_fk" FOREIGN KEY ("version_seo_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cases_updated_at_idx" ON "cases" USING btree ("updated_at");
  CREATE INDEX "cases_created_at_idx" ON "cases" USING btree ("created_at");
  CREATE INDEX "case_content_blocks_text_order_idx" ON "case_content_blocks_text" USING btree ("_order");
  CREATE INDEX "case_content_blocks_text_parent_id_idx" ON "case_content_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "case_content_blocks_text_path_idx" ON "case_content_blocks_text" USING btree ("_path");
  CREATE INDEX "case_content_blocks_image_order_idx" ON "case_content_blocks_image" USING btree ("_order");
  CREATE INDEX "case_content_blocks_image_parent_id_idx" ON "case_content_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "case_content_blocks_image_path_idx" ON "case_content_blocks_image" USING btree ("_path");
  CREATE INDEX "case_content_blocks_image_image_image_media_idx" ON "case_content_blocks_image" USING btree ("image_media_id");
  CREATE INDEX "case_content_blocks_image_pair_order_idx" ON "case_content_blocks_image_pair" USING btree ("_order");
  CREATE INDEX "case_content_blocks_image_pair_parent_id_idx" ON "case_content_blocks_image_pair" USING btree ("_parent_id");
  CREATE INDEX "case_content_blocks_image_pair_path_idx" ON "case_content_blocks_image_pair" USING btree ("_path");
  CREATE INDEX "case_content_blocks_image_pair_first_first_media_idx" ON "case_content_blocks_image_pair" USING btree ("first_media_id");
  CREATE INDEX "case_content_blocks_image_pair_second_second_media_idx" ON "case_content_blocks_image_pair" USING btree ("second_media_id");
  CREATE INDEX "case_content_sections_order_idx" ON "case_content_sections" USING btree ("_order");
  CREATE INDEX "case_content_sections_parent_id_idx" ON "case_content_sections" USING btree ("_parent_id");
  CREATE INDEX "case_content_case_idx" ON "case_content" USING btree ("case_id");
  CREATE INDEX "case_content_cover_cover_media_idx" ON "case_content" USING btree ("cover_media_id");
  CREATE INDEX "case_content_seo_image_seo_image_media_idx" ON "case_content" USING btree ("seo_image_media_id");
  CREATE INDEX "case_content_updated_at_idx" ON "case_content" USING btree ("updated_at");
  CREATE INDEX "case_content_created_at_idx" ON "case_content" USING btree ("created_at");
  CREATE INDEX "case_content__status_idx" ON "case_content" USING btree ("_status");
  CREATE INDEX "_case_content_v_blocks_text_order_idx" ON "_case_content_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_case_content_v_blocks_text_parent_id_idx" ON "_case_content_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_case_content_v_blocks_text_path_idx" ON "_case_content_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_case_content_v_blocks_image_order_idx" ON "_case_content_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_case_content_v_blocks_image_parent_id_idx" ON "_case_content_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_case_content_v_blocks_image_path_idx" ON "_case_content_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_case_content_v_blocks_image_image_image_media_idx" ON "_case_content_v_blocks_image" USING btree ("image_media_id");
  CREATE INDEX "_case_content_v_blocks_image_pair_order_idx" ON "_case_content_v_blocks_image_pair" USING btree ("_order");
  CREATE INDEX "_case_content_v_blocks_image_pair_parent_id_idx" ON "_case_content_v_blocks_image_pair" USING btree ("_parent_id");
  CREATE INDEX "_case_content_v_blocks_image_pair_path_idx" ON "_case_content_v_blocks_image_pair" USING btree ("_path");
  CREATE INDEX "_case_content_v_blocks_image_pair_first_first_media_idx" ON "_case_content_v_blocks_image_pair" USING btree ("first_media_id");
  CREATE INDEX "_case_content_v_blocks_image_pair_second_second_media_idx" ON "_case_content_v_blocks_image_pair" USING btree ("second_media_id");
  CREATE INDEX "_case_content_v_version_sections_order_idx" ON "_case_content_v_version_sections" USING btree ("_order");
  CREATE INDEX "_case_content_v_version_sections_parent_id_idx" ON "_case_content_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_case_content_v_parent_idx" ON "_case_content_v" USING btree ("parent_id");
  CREATE INDEX "_case_content_v_version_version_case_idx" ON "_case_content_v" USING btree ("version_case_id");
  CREATE INDEX "_case_content_v_version_cover_version_cover_media_idx" ON "_case_content_v" USING btree ("version_cover_media_id");
  CREATE INDEX "_case_content_v_version_seo_image_version_seo_image_medi_idx" ON "_case_content_v" USING btree ("version_seo_image_media_id");
  CREATE INDEX "_case_content_v_version_version_updated_at_idx" ON "_case_content_v" USING btree ("version_updated_at");
  CREATE INDEX "_case_content_v_version_version_created_at_idx" ON "_case_content_v" USING btree ("version_created_at");
  CREATE INDEX "_case_content_v_version_version__status_idx" ON "_case_content_v" USING btree ("version__status");
  CREATE INDEX "_case_content_v_created_at_idx" ON "_case_content_v" USING btree ("created_at");
  CREATE INDEX "_case_content_v_updated_at_idx" ON "_case_content_v" USING btree ("updated_at");
  CREATE INDEX "_case_content_v_latest_idx" ON "_case_content_v" USING btree ("latest");
  CREATE INDEX "case_routes_case_idx" ON "case_routes" USING btree ("case_id");
  CREATE INDEX "case_routes_content_idx" ON "case_routes" USING btree ("content_id");
  CREATE INDEX "case_routes_updated_at_idx" ON "case_routes" USING btree ("updated_at");
  CREATE INDEX "case_routes_created_at_idx" ON "case_routes" USING btree ("created_at");
  CREATE INDEX "site_navigation_updated_at_idx" ON "site_navigation" USING btree ("updated_at");
  CREATE INDEX "site_navigation_created_at_idx" ON "site_navigation" USING btree ("created_at");
  CREATE INDEX "site_navigation__status_idx" ON "site_navigation" USING btree ("_status");
  CREATE INDEX "_site_navigation_v_parent_idx" ON "_site_navigation_v" USING btree ("parent_id");
  CREATE INDEX "_site_navigation_v_version_version_updated_at_idx" ON "_site_navigation_v" USING btree ("version_updated_at");
  CREATE INDEX "_site_navigation_v_version_version_created_at_idx" ON "_site_navigation_v" USING btree ("version_created_at");
  CREATE INDEX "_site_navigation_v_version_version__status_idx" ON "_site_navigation_v" USING btree ("version__status");
  CREATE INDEX "_site_navigation_v_created_at_idx" ON "_site_navigation_v" USING btree ("created_at");
  CREATE INDEX "_site_navigation_v_updated_at_idx" ON "_site_navigation_v" USING btree ("updated_at");
  CREATE INDEX "_site_navigation_v_latest_idx" ON "_site_navigation_v" USING btree ("latest");
  CREATE INDEX "profiles_home_about_trajectory_order_idx" ON "profiles_home_about_trajectory" USING btree ("_order");
  CREATE INDEX "profiles_home_about_trajectory_parent_id_idx" ON "profiles_home_about_trajectory" USING btree ("_parent_id");
  CREATE INDEX "profiles_approach_methods_order_idx" ON "profiles_approach_methods" USING btree ("_order");
  CREATE INDEX "profiles_approach_methods_parent_id_idx" ON "profiles_approach_methods" USING btree ("_parent_id");
  CREATE INDEX "profiles_home_portrait_home_portrait_media_idx" ON "profiles" USING btree ("home_portrait_media_id");
  CREATE INDEX "profiles_about_portrait_about_portrait_media_idx" ON "profiles" USING btree ("about_portrait_media_id");
  CREATE INDEX "profiles_about_desk_photograph_about_desk_photograph_med_idx" ON "profiles" USING btree ("about_desk_photograph_media_id");
  CREATE INDEX "profiles_about_architecture_photograph_about_architectur_idx" ON "profiles" USING btree ("about_architecture_photograph_media_id");
  CREATE INDEX "profiles_resume_idx" ON "profiles" USING btree ("resume_id");
  CREATE INDEX "profiles_seo_image_seo_image_media_idx" ON "profiles" USING btree ("seo_image_media_id");
  CREATE INDEX "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at");
  CREATE INDEX "profiles_created_at_idx" ON "profiles" USING btree ("created_at");
  CREATE INDEX "profiles__status_idx" ON "profiles" USING btree ("_status");
  CREATE INDEX "_profiles_v_version_home_about_trajectory_order_idx" ON "_profiles_v_version_home_about_trajectory" USING btree ("_order");
  CREATE INDEX "_profiles_v_version_home_about_trajectory_parent_id_idx" ON "_profiles_v_version_home_about_trajectory" USING btree ("_parent_id");
  CREATE INDEX "_profiles_v_version_approach_methods_order_idx" ON "_profiles_v_version_approach_methods" USING btree ("_order");
  CREATE INDEX "_profiles_v_version_approach_methods_parent_id_idx" ON "_profiles_v_version_approach_methods" USING btree ("_parent_id");
  CREATE INDEX "_profiles_v_parent_idx" ON "_profiles_v" USING btree ("parent_id");
  CREATE INDEX "_profiles_v_version_home_portrait_version_home_portrait__idx" ON "_profiles_v" USING btree ("version_home_portrait_media_id");
  CREATE INDEX "_profiles_v_version_about_portrait_version_about_portrai_idx" ON "_profiles_v" USING btree ("version_about_portrait_media_id");
  CREATE INDEX "_profiles_v_version_about_desk_photograph_version_about__idx" ON "_profiles_v" USING btree ("version_about_desk_photograph_media_id");
  CREATE INDEX "_profiles_v_version_about_architecture_photograph_versio_idx" ON "_profiles_v" USING btree ("version_about_architecture_photograph_media_id");
  CREATE INDEX "_profiles_v_version_version_resume_idx" ON "_profiles_v" USING btree ("version_resume_id");
  CREATE INDEX "_profiles_v_version_seo_image_version_seo_image_media_idx" ON "_profiles_v" USING btree ("version_seo_image_media_id");
  CREATE INDEX "_profiles_v_version_version_updated_at_idx" ON "_profiles_v" USING btree ("version_updated_at");
  CREATE INDEX "_profiles_v_version_version_created_at_idx" ON "_profiles_v" USING btree ("version_created_at");
  CREATE INDEX "_profiles_v_version_version__status_idx" ON "_profiles_v" USING btree ("version__status");
  CREATE INDEX "_profiles_v_created_at_idx" ON "_profiles_v" USING btree ("created_at");
  CREATE INDEX "_profiles_v_updated_at_idx" ON "_profiles_v" USING btree ("updated_at");
  CREATE INDEX "_profiles_v_latest_idx" ON "_profiles_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cases_fk" FOREIGN KEY ("cases_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_case_content_fk" FOREIGN KEY ("case_content_id") REFERENCES "public"."case_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_case_routes_fk" FOREIGN KEY ("case_routes_id") REFERENCES "public"."case_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_navigation_fk" FOREIGN KEY ("site_navigation_id") REFERENCES "public"."site_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_professional_profiles_fk" FOREIGN KEY ("profiles_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cases_id_idx" ON "payload_locked_documents_rels" USING btree ("cases_id");
  CREATE INDEX "payload_locked_documents_rels_case_content_id_idx" ON "payload_locked_documents_rels" USING btree ("case_content_id");
  CREATE INDEX "payload_locked_documents_rels_case_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("case_routes_id");
  CREATE INDEX "payload_locked_documents_rels_site_navigation_id_idx" ON "payload_locked_documents_rels" USING btree ("site_navigation_id");
  CREATE INDEX "payload_locked_documents_rels_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("profiles_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_content_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_content_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_content_blocks_image_pair" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_content_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_content_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_content_v_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_content_v_blocks_image_pair" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_content_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_content_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_routes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_navigation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_navigation_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "profiles_home_about_trajectory" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "profiles_approach_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_profiles_v_version_home_about_trajectory" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_profiles_v_version_approach_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_profiles_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cases" CASCADE;
  DROP TABLE "case_content_blocks_text" CASCADE;
  DROP TABLE "case_content_blocks_image" CASCADE;
  DROP TABLE "case_content_blocks_image_pair" CASCADE;
  DROP TABLE "case_content_sections" CASCADE;
  DROP TABLE "case_content" CASCADE;
  DROP TABLE "_case_content_v_blocks_text" CASCADE;
  DROP TABLE "_case_content_v_blocks_image" CASCADE;
  DROP TABLE "_case_content_v_blocks_image_pair" CASCADE;
  DROP TABLE "_case_content_v_version_sections" CASCADE;
  DROP TABLE "_case_content_v" CASCADE;
  DROP TABLE "case_routes" CASCADE;
  DROP TABLE "site_navigation" CASCADE;
  DROP TABLE "_site_navigation_v" CASCADE;
  DROP TABLE "profiles_home_about_trajectory" CASCADE;
  DROP TABLE "profiles_approach_methods" CASCADE;
  DROP TABLE "profiles" CASCADE;
  DROP TABLE "_profiles_v_version_home_about_trajectory" CASCADE;
  DROP TABLE "_profiles_v_version_approach_methods" CASCADE;
  DROP TABLE "_profiles_v" CASCADE;
  DROP TABLE "media" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cases_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_case_content_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_case_routes_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_navigation_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_professional_profiles_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";

  DROP INDEX "payload_locked_documents_rels_cases_id_idx";
  DROP INDEX "payload_locked_documents_rels_case_content_id_idx";
  DROP INDEX "payload_locked_documents_rels_case_routes_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_navigation_id_idx";
  DROP INDEX "payload_locked_documents_rels_profiles_id_idx";
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cases_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "case_content_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "case_routes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_navigation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "profiles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  DROP TYPE "public"."enum_case_content_blocks_image_pair_presentation";
  DROP TYPE "public"."enum_case_content_locale";
  DROP TYPE "public"."enum_case_content_status";
  DROP TYPE "public"."enum__case_content_v_blocks_image_pair_presentation";
  DROP TYPE "public"."enum__case_content_v_version_locale";
  DROP TYPE "public"."enum__case_content_v_version_status";
  DROP TYPE "public"."enum_case_routes_locale";
  DROP TYPE "public"."enum_case_routes_state";
  DROP TYPE "public"."enum_site_navigation_locale";
  DROP TYPE "public"."enum_site_navigation_status";
  DROP TYPE "public"."enum__site_navigation_v_version_locale";
  DROP TYPE "public"."enum__site_navigation_v_version_status";
  DROP TYPE "public"."enum_profiles_locale";
  DROP TYPE "public"."enum_profiles_status";
  DROP TYPE "public"."enum__profiles_v_version_locale";
  DROP TYPE "public"."enum__profiles_v_version_status";`);
}
