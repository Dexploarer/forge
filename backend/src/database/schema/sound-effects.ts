import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'

// =====================================================
// SOUND EFFECTS TABLE - Weapon sounds, footsteps, ambient, UI sounds
// =====================================================

export const soundEffects = pgTable('sound_effects', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),

  // Ownership
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Audio File
  audioUrl: text('audio_url'),
  duration: integer('duration'), // milliseconds
  fileSize: integer('file_size'), // bytes
  format: varchar('format', { length: 20 }), // 'mp3' | 'wav' | 'ogg'

  // SFX Metadata
  category: varchar('category', { length: 100 }), // 'weapon' | 'footstep' | 'ambient' | 'ui' | 'voice'
  subcategory: varchar('subcategory', { length: 100 }), // e.g., 'sword_swing', 'door_open'
  volume: integer('volume'), // 0-100
  priority: integer('priority'), // 1-10

  // Generation Info
  generationType: varchar('generation_type', { length: 50 }), // 'ai' | 'upload' | 'recorded'
  generationPrompt: text('generation_prompt'),
  generationParams: jsonb('generation_params'),
  generationService: varchar('generation_service', { length: 100 }),

  // Variations (self-reference for grouping variations)
  variationGroup: uuid('variation_group').references((): any => soundEffects.id, { onDelete: 'set null' }),
  variationIndex: integer('variation_index'),

  // Usage
  triggers: jsonb('triggers').$type<string[]>().default([]).notNull(), // array of event triggers
  spatialAudio: boolean('spatial_audio').default(false).notNull(),
  minDistance: integer('min_distance'),
  maxDistance: integer('max_distance'),

  // Metadata
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'processing' | 'published' | 'failed'

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Single column indexes
  ownerIdx: index('idx_sfx_owner').on(table.ownerId),
  projectIdx: index('idx_sfx_project').on(table.projectId),
  categoryIdx: index('idx_sfx_category').on(table.category),
  variationIdx: index('idx_sfx_variation').on(table.variationGroup),
  statusIdx: index('idx_sfx_status').on(table.status),

  // Composite indexes
  ownerStatusIdx: index('idx_sfx_owner_status').on(table.ownerId, table.status),
  projectStatusIdx: index('idx_sfx_project_status').on(table.projectId, table.status),
  categorySub: index('idx_sfx_category_sub').on(table.category, table.subcategory),
}))

// =====================================================
// RELATIONS
// =====================================================

export const soundEffectsRelations = relations(soundEffects, ({ one, many }) => ({
  owner: one(users, {
    fields: [soundEffects.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [soundEffects.projectId],
    references: [projects.id],
  }),
  variationGroupParent: one(soundEffects, {
    fields: [soundEffects.variationGroup],
    references: [soundEffects.id],
    relationName: 'variations',
  }),
  variations: many(soundEffects, {
    relationName: 'variations',
  }),
}))
