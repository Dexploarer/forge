-- System Infrastructure Tables Migration
-- Creates: activity_log, notifications, api_keys, user_credentials, model_configurations, system_settings, entity_relationships, ai_service_calls

-- Activity Log (Audit Trail)
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"action" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_activity_user" ON "activity_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_activity_entity" ON "activity_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_activity_action" ON "activity_log" ("action");
CREATE INDEX IF NOT EXISTS "idx_activity_created" ON "activity_log" ("created_at");

-- Notifications
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"link" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications" ("user_id", "is_read", "created_at");

-- API Keys
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
	"team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL UNIQUE,
	"key_prefix" varchar(20) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_team" ON "api_keys" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_hash" ON "api_keys" ("key_hash");

-- User Credentials (Encrypted AI Service API Keys)
CREATE TABLE IF NOT EXISTS "user_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"service" varchar(100) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_prefix" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_credentials_user_service" ON "user_credentials" ("user_id", "service");
CREATE INDEX IF NOT EXISTS "idx_user_credentials_user" ON "user_credentials" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_credentials_service" ON "user_credentials" ("service");

-- Model Configurations
CREATE TABLE IF NOT EXISTS "model_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" varchar(100) NOT NULL UNIQUE,
	"model_id" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"temperature" varchar(10) DEFAULT '0.70',
	"max_tokens" integer,
	"display_name" varchar(255),
	"description" text,
	"pricing_input" varchar(20),
	"pricing_output" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_model_configurations_task_type" ON "model_configurations" ("task_type");
CREATE INDEX IF NOT EXISTS "idx_model_configurations_is_active" ON "model_configurations" ("is_active");

-- System Settings
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" varchar(255) NOT NULL UNIQUE,
	"setting_value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_system_settings_key" ON "system_settings" ("setting_key");

-- Entity Relationships
CREATE TABLE IF NOT EXISTS "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_a_type" varchar(100) NOT NULL,
	"entity_a_id" uuid NOT NULL,
	"entity_b_type" varchar(100) NOT NULL,
	"entity_b_id" uuid NOT NULL,
	"relationship_type" varchar(100) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_relationships_a" ON "entity_relationships" ("entity_a_type", "entity_a_id");
CREATE INDEX IF NOT EXISTS "idx_relationships_b" ON "entity_relationships" ("entity_b_type", "entity_b_id");
CREATE INDEX IF NOT EXISTS "idx_relationships_type" ON "entity_relationships" ("relationship_type");

-- AI Service Calls (Cost Tracking)
CREATE TABLE IF NOT EXISTS "ai_service_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS "idx_ai_calls_user" ON "ai_service_calls" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_ai_calls_service" ON "ai_service_calls" ("service");
CREATE INDEX IF NOT EXISTS "idx_ai_calls_created" ON "ai_service_calls" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_calls_user_service" ON "ai_service_calls" ("user_id", "service");
