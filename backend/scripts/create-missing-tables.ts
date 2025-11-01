#!/usr/bin/env bun
/**
 * Create Missing Core Tables
 *
 * Creates users, teams, and assets tables that are referenced by other tables
 * but were never created in migrations.
 */

import postgres from 'postgres'
import { env } from '../src/config/env'

const sql = postgres(env.DATABASE_URL)

async function createMissingTables() {
  console.log('🔧 Creating missing core tables...\n')

  try {
    // Create ENUMs if they don't exist
    await sql`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM('admin', 'member', 'guest');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log('✓ Created user_role enum')

    await sql`
      DO $$ BEGIN
        CREATE TYPE asset_status AS ENUM('draft', 'processing', 'published', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log('✓ Created asset_status enum')

    await sql`
      DO $$ BEGIN
        CREATE TYPE asset_type AS ENUM('model', 'texture', 'audio');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log('✓ Created asset_type enum')

    await sql`
      DO $$ BEGIN
        CREATE TYPE visibility_type AS ENUM('private', 'public');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log('✓ Created visibility_type enum\n')

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        privy_user_id varchar(255) NOT NULL UNIQUE,
        email varchar(255),
        display_name varchar(255),
        avatar_url text,
        wallet_address varchar(255),
        farcaster_fid integer UNIQUE,
        farcaster_username varchar(255),
        farcaster_verified boolean DEFAULT false,
        farcaster_profile jsonb,
        role user_role DEFAULT 'member' NOT NULL,
        settings jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        last_login_at timestamp with time zone
      )
    `
    console.log('✓ Created users table')

    // Create indexes for users
    await sql`CREATE INDEX IF NOT EXISTS idx_users_privy_id ON users(privy_user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_farcaster_fid ON users(farcaster_fid)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`
    console.log('✓ Created users indexes\n')

    // Create teams table
    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        description text,
        owner_id uuid NOT NULL,
        settings jsonb DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `
    console.log('✓ Created teams table')

    // Create teams indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id)`
    console.log('✓ Created teams indexes\n')

    // Create team_invitations table
    await sql`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id uuid NOT NULL,
        email varchar(255) NOT NULL,
        invited_by uuid NOT NULL,
        token varchar(255) NOT NULL UNIQUE,
        status varchar(50) DEFAULT 'pending',
        expires_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now(),
        responded_at timestamp with time zone
      )
    `
    console.log('✓ Created team_invitations table')

    // Create team_members table
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role varchar(50) DEFAULT 'member' NOT NULL,
        invited_by uuid,
        joined_at timestamp with time zone DEFAULT now(),
        created_at timestamp with time zone DEFAULT now(),
        UNIQUE(team_id, user_id)
      )
    `
    console.log('✓ Created team_members table')

    // Create indexes for team tables
    await sql`CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`
    console.log('✓ Created team indexes\n')

    // Create assets table
    await sql`
      CREATE TABLE IF NOT EXISTS assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        type asset_type NOT NULL,
        status asset_status DEFAULT 'draft' NOT NULL,
        visibility visibility_type DEFAULT 'private' NOT NULL,
        file_url text,
        file_size bigint,
        mime_type varchar(100),
        prompt text,
        generation_params jsonb,
        metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
        tags jsonb DEFAULT '[]'::jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        published_at timestamp with time zone
      )
    `
    console.log('✓ Created assets table')

    // Create assets indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_visibility ON assets(visibility)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_owner_status ON assets(owner_id, status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_owner_type ON assets(owner_id, type)`
    await sql`CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(created_at)`
    console.log('✓ Created assets indexes\n')

    console.log('✅ All missing core tables created successfully!')
    console.log('\nNext step: Run the seed script to populate data')

  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message)
    throw error
  } finally {
    await sql.end()
  }
}

createMissingTables().catch((error) => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
