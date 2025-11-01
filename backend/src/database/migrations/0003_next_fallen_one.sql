CREATE TABLE "ai_service_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service" varchar(100) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"model" varchar(100),
	"request_data" jsonb DEFAULT '{}'::jsonb,
	"response_data" jsonb DEFAULT '{}'::jsonb,
	"tokens_used" integer,
	"cost" integer,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(255),
	"race" varchar(100),
	"class" varchar(100),
	"level" integer DEFAULT 1 NOT NULL,
	"faction" varchar(100),
	"personality" text,
	"backstory" text,
	"behavior" varchar(100) DEFAULT 'neutral' NOT NULL,
	"dialog_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_id" uuid,
	"voice_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"appearance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model_asset_id" uuid,
	"portrait_url" text,
	"location" varchar(255),
	"spawn_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"patrol_route" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health" integer DEFAULT 100 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"damage" integer DEFAULT 10 NOT NULL,
	"abilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"loot_table" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quest_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"teaches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lore_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"category" varchar(100),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"era" varchar(255),
	"region" varchar(255),
	"timeline_position" integer,
	"importance_level" integer DEFAULT 5 NOT NULL,
	"related_characters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"quest_type" varchar(100) DEFAULT 'side' NOT NULL,
	"difficulty" varchar(50) DEFAULT 'medium' NOT NULL,
	"min_level" integer DEFAULT 1 NOT NULL,
	"max_level" integer,
	"objectives" jsonb NOT NULL,
	"rewards" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"start_dialog" text,
	"complete_dialog" text,
	"fail_dialog" text,
	"quest_giver_npc_id" uuid,
	"location" varchar(255),
	"related_npcs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_duration" integer,
	"repeatable" boolean DEFAULT false NOT NULL,
	"cooldown_hours" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"manifest_data" jsonb NOT NULL,
	"manifest_url" text,
	"manifest_hash" varchar(64),
	"asset_count" integer DEFAULT 0 NOT NULL,
	"quest_count" integer DEFAULT 0 NOT NULL,
	"npc_count" integer DEFAULT 0 NOT NULL,
	"lore_count" integer DEFAULT 0 NOT NULL,
	"music_count" integer DEFAULT 0 NOT NULL,
	"sfx_count" integer DEFAULT 0 NOT NULL,
	"build_number" integer DEFAULT 1 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifest_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_id" uuid NOT NULL,
	"build_number" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"build_log" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fitting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_asset_id" uuid NOT NULL,
	"equipment_asset_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"attachment_points" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transforms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deformations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_asset_id" uuid,
	"preview_image_url" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rigging_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"skeleton_type" varchar(100) NOT NULL,
	"bone_count" integer DEFAULT 0 NOT NULL,
	"bones" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"has_blend_shapes" boolean DEFAULT false NOT NULL,
	"blend_shape_count" integer DEFAULT 0 NOT NULL,
	"has_ik" boolean DEFAULT false NOT NULL,
	"ik_chains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported_animations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"animation_clips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rigger_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_rigging_asset" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "weapon_detection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"is_weapon" boolean DEFAULT false NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"weapon_type" varchar(100),
	"weapon_class" varchar(100),
	"estimated_damage" integer,
	"estimated_range" integer,
	"handedness" varchar(20),
	"grip_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_model" varchar(100),
	"analysis_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processing_time" integer,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"audio_url" text,
	"duration" integer,
	"file_size" integer,
	"format" varchar(20),
	"bpm" integer,
	"key" varchar(10),
	"genre" varchar(100),
	"mood" varchar(100),
	"instruments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_type" varchar(50),
	"generation_prompt" text,
	"generation_params" jsonb,
	"generation_service" varchar(100),
	"usage_context" varchar(100),
	"loopable" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"audio_url" text,
	"duration" integer,
	"file_size" integer,
	"format" varchar(20),
	"category" varchar(100),
	"subcategory" varchar(100),
	"volume" integer,
	"priority" integer,
	"generation_type" varchar(50),
	"generation_prompt" text,
	"generation_params" jsonb,
	"generation_service" varchar(100),
	"variation_group" uuid,
	"variation_index" integer,
	"triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"spatial_audio" boolean DEFAULT false NOT NULL,
	"min_distance" integer,
	"max_distance" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"voice_profile_id" uuid NOT NULL,
	"npc_id" uuid,
	"project_id" uuid,
	"owner_id" uuid NOT NULL,
	"audio_url" text,
	"duration" integer,
	"file_size" integer,
	"format" varchar(20),
	"speed" numeric(3, 2),
	"pitch" integer,
	"stability" numeric(3, 2),
	"clarity" numeric(3, 2),
	"service_provider" varchar(100),
	"service_params" jsonb,
	"cost" numeric(10, 6),
	"context" varchar(100),
	"emotion" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"gender" varchar(20),
	"age" varchar(50),
	"accent" varchar(100),
	"tone" varchar(100),
	"service_provider" varchar(100),
	"service_voice_id" varchar(255),
	"service_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"character_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_audio_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_service_calls" ADD CONSTRAINT "ai_service_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_model_asset_id_assets_id_fk" FOREIGN KEY ("model_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_quest_giver_npc_id_npcs_id_fk" FOREIGN KEY ("quest_giver_npc_id") REFERENCES "public"."npcs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_manifests" ADD CONSTRAINT "game_manifests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_manifests" ADD CONSTRAINT "game_manifests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_builds" ADD CONSTRAINT "manifest_builds_manifest_id_game_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."game_manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_base_asset_id_assets_id_fk" FOREIGN KEY ("base_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_equipment_asset_id_assets_id_fk" FOREIGN KEY ("equipment_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_result_asset_id_assets_id_fk" FOREIGN KEY ("result_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rigging_metadata" ADD CONSTRAINT "rigging_metadata_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rigging_metadata" ADD CONSTRAINT "rigging_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weapon_detection" ADD CONSTRAINT "weapon_detection_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weapon_detection" ADD CONSTRAINT "weapon_detection_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_effects" ADD CONSTRAINT "sound_effects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_effects" ADD CONSTRAINT "sound_effects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_effects" ADD CONSTRAINT "sound_effects_variation_group_sound_effects_id_fk" FOREIGN KEY ("variation_group") REFERENCES "public"."sound_effects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generations" ADD CONSTRAINT "voice_generations_voice_profile_id_voice_profiles_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generations" ADD CONSTRAINT "voice_generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generations" ADD CONSTRAINT "voice_generations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_calls_user" ON "ai_service_calls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_service" ON "ai_service_calls" USING btree ("service");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_created" ON "ai_service_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_user_service" ON "ai_service_calls" USING btree ("user_id","service");--> statement-breakpoint
CREATE INDEX "npcs_owner_id_idx" ON "npcs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "npcs_project_id_idx" ON "npcs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "npcs_location_idx" ON "npcs" USING btree ("location");--> statement-breakpoint
CREATE INDEX "npcs_faction_idx" ON "npcs" USING btree ("faction");--> statement-breakpoint
CREATE INDEX "npcs_behavior_idx" ON "npcs" USING btree ("behavior");--> statement-breakpoint
CREATE INDEX "npcs_level_idx" ON "npcs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "lore_entries_owner_id_idx" ON "lore_entries" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lore_entries_project_id_idx" ON "lore_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lore_entries_category_idx" ON "lore_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "lore_entries_era_idx" ON "lore_entries" USING btree ("era");--> statement-breakpoint
CREATE INDEX "lore_entries_region_idx" ON "lore_entries" USING btree ("region");--> statement-breakpoint
CREATE INDEX "lore_entries_timeline_position_idx" ON "lore_entries" USING btree ("timeline_position");--> statement-breakpoint
CREATE INDEX "quests_owner_id_idx" ON "quests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "quests_project_id_idx" ON "quests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quests_quest_type_idx" ON "quests" USING btree ("quest_type");--> statement-breakpoint
CREATE INDEX "quests_difficulty_idx" ON "quests" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "quests_quest_giver_npc_id_idx" ON "quests" USING btree ("quest_giver_npc_id");--> statement-breakpoint
CREATE INDEX "quests_min_level_idx" ON "quests" USING btree ("min_level");--> statement-breakpoint
CREATE INDEX "quests_max_level_idx" ON "quests" USING btree ("max_level");--> statement-breakpoint
CREATE INDEX "idx_manifests_project" ON "game_manifests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_manifests_owner" ON "game_manifests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_manifests_status" ON "game_manifests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_manifests_version" ON "game_manifests" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_manifest_builds_manifest" ON "manifest_builds" USING btree ("manifest_id");--> statement-breakpoint
CREATE INDEX "idx_manifest_builds_status" ON "manifest_builds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fitting_base" ON "fitting_sessions" USING btree ("base_asset_id");--> statement-breakpoint
CREATE INDEX "idx_fitting_equipment" ON "fitting_sessions" USING btree ("equipment_asset_id");--> statement-breakpoint
CREATE INDEX "idx_fitting_project" ON "fitting_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_fitting_owner" ON "fitting_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_rigging_asset" ON "rigging_metadata" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_rigging_project" ON "rigging_metadata" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_weapon_asset" ON "weapon_detection" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_weapon_type" ON "weapon_detection" USING btree ("weapon_type");--> statement-breakpoint
CREATE INDEX "idx_weapon_is_weapon" ON "weapon_detection" USING btree ("is_weapon");--> statement-breakpoint
CREATE INDEX "idx_music_owner" ON "music_tracks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_music_project" ON "music_tracks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_music_genre" ON "music_tracks" USING btree ("genre");--> statement-breakpoint
CREATE INDEX "idx_music_mood" ON "music_tracks" USING btree ("mood");--> statement-breakpoint
CREATE INDEX "idx_music_status" ON "music_tracks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_music_owner_status" ON "music_tracks" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "idx_music_project_status" ON "music_tracks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_sfx_owner" ON "sound_effects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_sfx_project" ON "sound_effects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sfx_category" ON "sound_effects" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_sfx_variation" ON "sound_effects" USING btree ("variation_group");--> statement-breakpoint
CREATE INDEX "idx_sfx_status" ON "sound_effects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sfx_owner_status" ON "sound_effects" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "idx_sfx_project_status" ON "sound_effects" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_sfx_category_sub" ON "sound_effects" USING btree ("category","subcategory");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_owner" ON "voice_generations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_project" ON "voice_generations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_profile" ON "voice_generations" USING btree ("voice_profile_id");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_npc" ON "voice_generations" USING btree ("npc_id");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_status" ON "voice_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_owner_status" ON "voice_generations" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_project_status" ON "voice_generations" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_voice_gen_profile_status" ON "voice_generations" USING btree ("voice_profile_id","status");--> statement-breakpoint
CREATE INDEX "idx_voice_profiles_owner" ON "voice_profiles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_voice_profiles_project" ON "voice_profiles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_voice_profiles_provider" ON "voice_profiles" USING btree ("service_provider");--> statement-breakpoint
CREATE INDEX "idx_voice_profiles_owner_active" ON "voice_profiles" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_voice_profiles_project_active" ON "voice_profiles" USING btree ("project_id","is_active");