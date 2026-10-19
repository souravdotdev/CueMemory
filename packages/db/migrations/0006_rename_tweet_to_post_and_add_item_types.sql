-- Hand-written: drizzle-kit drops and recreates the type, which fails on existing 'tweet' rows.
ALTER TYPE "public"."item_type" RENAME VALUE 'tweet' TO 'post';--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'audio' AFTER 'image';--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'code' AFTER 'pdf';--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'file' AFTER 'code';
