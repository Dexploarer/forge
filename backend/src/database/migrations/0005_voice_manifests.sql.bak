CREATE TABLE "voice_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"project_id" uuid,
	"owner_id" uuid NOT NULL,
	"voice_assignments" jsonb NOT NULL,
	"manifest_data" jsonb,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_manifests" ADD CONSTRAINT "voice_manifests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_manifests" ADD CONSTRAINT "voice_manifests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_voice_manifests_project" ON "voice_manifests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_voice_manifests_owner" ON "voice_manifests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_voice_manifests_project_active" ON "voice_manifests" USING btree ("project_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_voice_manifests_owner_active" ON "voice_manifests" USING btree ("owner_id","is_active");