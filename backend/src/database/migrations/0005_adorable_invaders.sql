CREATE TABLE "ai_context_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"use_own_preview" boolean DEFAULT true NOT NULL,
	"use_cdn_content" boolean DEFAULT true NOT NULL,
	"use_team_preview" boolean DEFAULT true NOT NULL,
	"use_all_submissions" boolean DEFAULT false NOT NULL,
	"max_context_items" integer DEFAULT 100 NOT NULL,
	"prefer_recent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_context_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "preview_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"manifest_type" varchar(100) NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preview_manifests_unique_type" UNIQUE("user_id","team_id","manifest_type")
);
--> statement-breakpoint
ALTER TABLE "ai_context_preferences" ADD CONSTRAINT "ai_context_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_manifests" ADD CONSTRAINT "preview_manifests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_manifests" ADD CONSTRAINT "preview_manifests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_context_user" ON "ai_context_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_preview_manifests_user" ON "preview_manifests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_preview_manifests_team" ON "preview_manifests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_preview_manifests_type" ON "preview_manifests" USING btree ("manifest_type");