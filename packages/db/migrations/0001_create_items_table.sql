CREATE TYPE "public"."item_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('article', 'tweet', 'video', 'image', 'pdf', 'link');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"type" "item_type",
	"status" "item_status" DEFAULT 'processing' NOT NULL,
	"title" text,
	"description" text,
	"thumbnail_key" text,
	"extracted_text" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "items_type_set_when_finished" CHECK ("items"."status" = 'processing' OR "items"."type" IS NOT NULL),
	CONSTRAINT "items_failure_reason_iff_failed" CHECK (("items"."status" = 'failed') = ("items"."failure_reason" IS NOT NULL)),
	CONSTRAINT "items_source_url_http" CHECK ("items"."source_url" ~* '^https?://')
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_user_id_created_at_idx" ON "items" USING btree ("user_id","created_at" DESC NULLS LAST);