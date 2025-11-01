CREATE TABLE "manifest_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"manifest_type" varchar(100) NOT NULL,
	"item_id" varchar(255) NOT NULL,
	"item_data" jsonb NOT NULL,
	"has_details" boolean DEFAULT false NOT NULL,
	"has_sprites" boolean DEFAULT false NOT NULL,
	"has_images" boolean DEFAULT false NOT NULL,
	"has_3d_model" boolean DEFAULT false NOT NULL,
	"sprite_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_url" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"admin_notes" text,
	"rejection_reason" text,
	"edited_item_data" jsonb,
	"was_edited" boolean DEFAULT false NOT NULL,
	"submission_version" integer DEFAULT 1 NOT NULL,
	"parent_submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manifest_submissions" ADD CONSTRAINT "manifest_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_submissions" ADD CONSTRAINT "manifest_submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_submissions" ADD CONSTRAINT "manifest_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_submissions" ADD CONSTRAINT "manifest_submissions_parent_submission_id_manifest_submissions_id_fk" FOREIGN KEY ("parent_submission_id") REFERENCES "public"."manifest_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_submissions_user" ON "manifest_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_team" ON "manifest_submissions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_type" ON "manifest_submissions" USING btree ("manifest_type");--> statement-breakpoint
CREATE INDEX "idx_submissions_status" ON "manifest_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_submissions_item" ON "manifest_submissions" USING btree ("manifest_type","item_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_reviewed_by" ON "manifest_submissions" USING btree ("reviewed_by");