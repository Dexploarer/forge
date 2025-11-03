ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;