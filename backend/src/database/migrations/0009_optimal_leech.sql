ALTER TABLE "projects" ADD COLUMN "status" varchar(50) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "thumbnail_url" text;