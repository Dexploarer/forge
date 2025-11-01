import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'
import { teams } from './teams'

// =====================================================
// GAME MANIFESTS TABLE
// =====================================================
// Complete game data exports with versioning

export const gameManifests = pgTable('game_manifests', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  name: varchar('name', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(), // Semantic versioning
  description: text('description'),

  // Relationships
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Manifest Data
  manifestData: jsonb('manifest_data').$type<Record<string, unknown>>().notNull(),
  manifestUrl: text('manifest_url'), // CDN URL for manifest JSON
  manifestHash: varchar('manifest_hash', { length: 64 }), // SHA-256 hash

  // Contents Summary
  assetCount: integer('asset_count').default(0).notNull(),
  questCount: integer('quest_count').default(0).notNull(),
  npcCount: integer('npc_count').default(0).notNull(),
  loreCount: integer('lore_count').default(0).notNull(),
  musicCount: integer('music_count').default(0).notNull(),
  sfxCount: integer('sfx_count').default(0).notNull(),

  // Build Information
  buildNumber: integer('build_number').default(1).notNull(),

  // Metadata
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),

  // Publishing Status
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'building' | 'published' | 'archived'
  publishedAt: timestamp('published_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('idx_manifests_project').on(table.projectId),
  ownerIdIdx: index('idx_manifests_owner').on(table.ownerId),
  statusIdx: index('idx_manifests_status').on(table.status),
  versionIdx: index('idx_manifests_version').on(table.version),
}))

// =====================================================
// MANIFEST BUILDS TABLE
// =====================================================
// Build process tracking for manifests

export const manifestBuilds = pgTable('manifest_builds', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Relationship
  manifestId: uuid('manifest_id').notNull().references(() => gameManifests.id, { onDelete: 'cascade' }),

  // Build Information
  buildNumber: integer('build_number').notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'building' | 'completed' | 'failed'

  // Build Output
  buildLog: text('build_log'),
  error: text('error'),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  manifestIdIdx: index('idx_manifest_builds_manifest').on(table.manifestId),
  statusIdx: index('idx_manifest_builds_status').on(table.status),
}))

// =====================================================
// PREVIEW MANIFESTS TABLE
// =====================================================
// User and team preview content for AI context building

export const previewManifests = pgTable('preview_manifests', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Ownership
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),

  // Manifest type: items, npcs, lore, quests, music, voice, sound_effects, static_images, biomes, zones, world
  manifestType: varchar('manifest_type', { length: 100 }).notNull(),

  // Content data as JSONB array
  content: jsonb('content').$type<unknown[]>().notNull().default([]),

  // Metadata
  version: integer('version').default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_preview_manifests_user').on(table.userId),
  teamIdIdx: index('idx_preview_manifests_team').on(table.teamId),
  typeIdx: index('idx_preview_manifests_type').on(table.manifestType),
  uniqueUserTeamType: unique('preview_manifests_unique_type').on(table.userId, table.teamId, table.manifestType),
}))

// =====================================================
// MANIFEST SUBMISSIONS TABLE
// =====================================================
// User-submitted manifest items for review and approval

export const manifestSubmissions = pgTable('manifest_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Ownership
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),

  // What type and item is being submitted
  manifestType: varchar('manifest_type', { length: 100 }).notNull(),
  itemId: varchar('item_id', { length: 255 }).notNull(),
  itemData: jsonb('item_data').notNull(),

  // Required assets for submission
  hasDetails: boolean('has_details').default(false).notNull(),
  hasSprites: boolean('has_sprites').default(false).notNull(),
  hasImages: boolean('has_images').default(false).notNull(),
  has3dModel: boolean('has_3d_model').default(false).notNull(),

  // Asset references
  spriteUrls: jsonb('sprite_urls').$type<string[]>().default([]).notNull(),
  imageUrls: jsonb('image_urls').$type<string[]>().default([]).notNull(),
  modelUrl: text('model_url'),

  // Submission workflow
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),

  // Admin feedback
  adminNotes: text('admin_notes'),
  rejectionReason: text('rejection_reason'),

  // Edited version (if admin made changes before approval)
  editedItemData: jsonb('edited_item_data'),
  wasEdited: boolean('was_edited').default(false).notNull(),

  // Version tracking
  submissionVersion: integer('submission_version').default(1).notNull(),
  parentSubmissionId: uuid('parent_submission_id').references((): any => manifestSubmissions.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_submissions_user').on(table.userId),
  teamIdIdx: index('idx_submissions_team').on(table.teamId),
  typeIdx: index('idx_submissions_type').on(table.manifestType),
  statusIdx: index('idx_submissions_status').on(table.status),
  itemIdx: index('idx_submissions_item').on(table.manifestType, table.itemId),
  reviewedByIdx: index('idx_submissions_reviewed_by').on(table.reviewedBy),
}))

// =====================================================
// AI CONTEXT PREFERENCES TABLE
// =====================================================
// User preferences for AI context assembly

export const aiContextPreferences = pgTable('ai_context_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),

  // User relationship (one-to-one)
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),

  // Context source toggles
  useOwnPreview: boolean('use_own_preview').default(true).notNull(),
  useCdnContent: boolean('use_cdn_content').default(true).notNull(),
  useTeamPreview: boolean('use_team_preview').default(true).notNull(),
  useAllSubmissions: boolean('use_all_submissions').default(false).notNull(),

  // Additional settings
  maxContextItems: integer('max_context_items').default(100).notNull(),
  preferRecent: boolean('prefer_recent').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_ai_context_user').on(table.userId),
}))

// =====================================================
// RELATIONS
// =====================================================

export const gameManifestsRelations = relations(gameManifests, ({ one, many }) => ({
  project: one(projects, {
    fields: [gameManifests.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [gameManifests.ownerId],
    references: [users.id],
  }),
  builds: many(manifestBuilds),
}))

export const manifestBuildsRelations = relations(manifestBuilds, ({ one }) => ({
  manifest: one(gameManifests, {
    fields: [manifestBuilds.manifestId],
    references: [gameManifests.id],
  }),
}))

export const previewManifestsRelations = relations(previewManifests, ({ one }) => ({
  user: one(users, {
    fields: [previewManifests.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [previewManifests.teamId],
    references: [teams.id],
  }),
}))

export const manifestSubmissionsRelations = relations(manifestSubmissions, ({ one }) => ({
  user: one(users, {
    fields: [manifestSubmissions.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [manifestSubmissions.teamId],
    references: [teams.id],
  }),
  reviewer: one(users, {
    fields: [manifestSubmissions.reviewedBy],
    references: [users.id],
    relationName: 'reviewedSubmissions',
  }),
  parentSubmission: one(manifestSubmissions, {
    fields: [manifestSubmissions.parentSubmissionId],
    references: [manifestSubmissions.id],
    relationName: 'submissionVersions',
  }),
}))

export const aiContextPreferencesRelations = relations(aiContextPreferences, ({ one }) => ({
  user: one(users, {
    fields: [aiContextPreferences.userId],
    references: [users.id],
  }),
}))
