import postgres from 'postgres'
import { env } from '../../config/env'

const sql = postgres(env.DATABASE_URL)

async function applyVoiceManifestsMigration() {
  try {
    console.log('📋 Checking if voice_manifests table exists...')

    // Check if table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'voice_manifests'
      );
    `

    const tableExists = result[0]?.exists

    if (tableExists) {
      console.log('✅ voice_manifests table already exists')
      await sql.end()
      return
    }

    console.log('📦 Creating voice_manifests table...')

    // Create table
    await sql`
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
    `

    // Add foreign keys
    await sql`
      ALTER TABLE "voice_manifests"
      ADD CONSTRAINT "voice_manifests_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
      ON DELETE cascade ON UPDATE no action;
    `

    await sql`
      ALTER TABLE "voice_manifests"
      ADD CONSTRAINT "voice_manifests_owner_id_users_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    `

    // Create indexes
    await sql`
      CREATE INDEX "idx_voice_manifests_project"
      ON "voice_manifests" USING btree ("project_id");
    `

    await sql`
      CREATE INDEX "idx_voice_manifests_owner"
      ON "voice_manifests" USING btree ("owner_id");
    `

    await sql`
      CREATE INDEX "idx_voice_manifests_project_active"
      ON "voice_manifests" USING btree ("project_id","is_active");
    `

    await sql`
      CREATE INDEX "idx_voice_manifests_owner_active"
      ON "voice_manifests" USING btree ("owner_id","is_active");
    `

    console.log('✅ voice_manifests table created successfully')

    await sql.end()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await sql.end()
    process.exit(1)
  }
}

applyVoiceManifestsMigration()
