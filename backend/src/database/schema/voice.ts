import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, numeric, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'

// =====================================================
// VOICE PROFILES TABLE - Voice characteristics for characters
// =====================================================

export const voiceProfiles = pgTable('voice_profiles', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),

  // Ownership
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Voice Characteristics
  gender: varchar('gender', { length: 20 }), // 'male' | 'female' | 'neutral'
  age: varchar('age', { length: 50 }), // 'child' | 'young' | 'adult' | 'elderly'
  accent: varchar('accent', { length: 100 }),
  tone: varchar('tone', { length: 100 }), // 'warm' | 'cold' | 'professional' | 'casual'

  // Service Integration
  serviceProvider: varchar('service_provider', { length: 100 }), // 'elevenlabs' | 'openai' | 'azure'
  serviceVoiceId: varchar('service_voice_id', { length: 255 }),
  serviceSettings: jsonb('service_settings').default({}).notNull(),

  // Usage
  characterIds: jsonb('character_ids').$type<string[]>().default([]).notNull(), // array of NPC IDs
  sampleAudioUrl: text('sample_audio_url'),

  // Metadata
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Single column indexes
  ownerIdx: index('idx_voice_profiles_owner').on(table.ownerId),
  projectIdx: index('idx_voice_profiles_project').on(table.projectId),
  providerIdx: index('idx_voice_profiles_provider').on(table.serviceProvider),

  // Composite indexes
  ownerActiveIdx: index('idx_voice_profiles_owner_active').on(table.ownerId, table.isActive),
  projectActiveIdx: index('idx_voice_profiles_project_active').on(table.projectId, table.isActive),
}))

// =====================================================
// VOICE GENERATIONS TABLE - Generated voice audio
// =====================================================

export const voiceGenerations = pgTable('voice_generations', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),

  // Content
  text: text('text').notNull(),

  // Relationships
  voiceProfileId: uuid('voice_profile_id').notNull().references(() => voiceProfiles.id, { onDelete: 'cascade' }),
  npcId: uuid('npc_id'), // Optional reference to NPC
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Generation Output
  audioUrl: text('audio_url'),
  duration: integer('duration'), // seconds
  fileSize: integer('file_size'),
  format: varchar('format', { length: 20 }),

  // Generation Settings
  speed: numeric('speed', { precision: 3, scale: 2 }), // 0.5 to 2.0
  pitch: integer('pitch'), // -12 to +12
  stability: numeric('stability', { precision: 3, scale: 2 }), // 0.0 to 1.0
  clarity: numeric('clarity', { precision: 3, scale: 2 }), // 0.0 to 1.0

  // Service Info
  serviceProvider: varchar('service_provider', { length: 100 }),
  serviceParams: jsonb('service_params'),
  cost: numeric('cost', { precision: 10, scale: 6 }), // USD

  // Context
  context: varchar('context', { length: 100 }), // 'dialog' | 'narration' | 'combat_bark'
  emotion: varchar('emotion', { length: 100 }), // 'neutral' | 'happy' | 'sad' | 'angry'

  // Metadata
  metadata: jsonb('metadata').default({}).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  error: text('error'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Single column indexes
  ownerIdx: index('idx_voice_gen_owner').on(table.ownerId),
  projectIdx: index('idx_voice_gen_project').on(table.projectId),
  profileIdx: index('idx_voice_gen_profile').on(table.voiceProfileId),
  npcIdx: index('idx_voice_gen_npc').on(table.npcId),
  statusIdx: index('idx_voice_gen_status').on(table.status),

  // Composite indexes
  ownerStatusIdx: index('idx_voice_gen_owner_status').on(table.ownerId, table.status),
  projectStatusIdx: index('idx_voice_gen_project_status').on(table.projectId, table.status),
  profileStatusIdx: index('idx_voice_gen_profile_status').on(table.voiceProfileId, table.status),
}))

// =====================================================
// VOICE MANIFESTS TABLE - Voice assignment collections
// =====================================================

export const voiceManifests = pgTable('voice_manifests', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Ownership
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Manifest Content
  voiceAssignments: jsonb('voice_assignments').notNull(), // { [npcId]: voiceProfileId }
  manifestData: jsonb('manifest_data'),

  // Version Control
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Single column indexes
  projectIdx: index('idx_voice_manifests_project').on(table.projectId),
  ownerIdx: index('idx_voice_manifests_owner').on(table.ownerId),

  // Composite indexes
  projectActiveIdx: index('idx_voice_manifests_project_active').on(table.projectId, table.isActive),
  ownerActiveIdx: index('idx_voice_manifests_owner_active').on(table.ownerId, table.isActive),
}))

// =====================================================
// RELATIONS
// =====================================================

export const voiceProfilesRelations = relations(voiceProfiles, ({ one, many }) => ({
  owner: one(users, {
    fields: [voiceProfiles.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [voiceProfiles.projectId],
    references: [projects.id],
  }),
  generations: many(voiceGenerations),
}))

export const voiceGenerationsRelations = relations(voiceGenerations, ({ one }) => ({
  owner: one(users, {
    fields: [voiceGenerations.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [voiceGenerations.projectId],
    references: [projects.id],
  }),
  voiceProfile: one(voiceProfiles, {
    fields: [voiceGenerations.voiceProfileId],
    references: [voiceProfiles.id],
  }),
}))

export const voiceManifestsRelations = relations(voiceManifests, ({ one }) => ({
  owner: one(users, {
    fields: [voiceManifests.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [voiceManifests.projectId],
    references: [projects.id],
  }),
}))
