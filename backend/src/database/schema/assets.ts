import { pgTable, uuid, varchar, text, timestamp, jsonb, bigint, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { assetType, assetStatus, visibilityType } from './enums'
import { users } from './users'

// =====================================================
// ASSETS TABLE - 3D Models, Audio, Textures
// =====================================================

export const assets = pgTable('assets', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),

  // Ownership
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Classification
  type: assetType('type').notNull(),
  status: assetStatus('status').default('draft').notNull(),
  visibility: visibilityType('visibility').default('private').notNull(),

  // File Information
  fileUrl: text('file_url'),
  thumbnailUrl: text('thumbnail_url'),
  fileSize: bigint('file_size', { mode: 'number' }),
  mimeType: varchar('mime_type', { length: 100 }),

  // Generation Metadata (if AI-generated)
  prompt: text('prompt'),
  generationParams: jsonb('generation_params'),

  // Additional Metadata
  metadata: jsonb('metadata').default({}).notNull(),
  tags: jsonb('tags').default([]).notNull(), // Array of strings

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  // Single column indexes
  ownerIdx: index('idx_assets_owner').on(table.ownerId),
  typeIdx: index('idx_assets_type').on(table.type),
  statusIdx: index('idx_assets_status').on(table.status),
  visibilityIdx: index('idx_assets_visibility').on(table.visibility),

  // Composite indexes for common query patterns
  ownerStatusIdx: index('idx_assets_owner_status').on(table.ownerId, table.status),
  ownerTypeIdx: index('idx_assets_owner_type').on(table.ownerId, table.type),
  statusCreatedIdx: index('idx_assets_status_created').on(table.status, table.createdAt),
}))

// =====================================================
// RELATIONS
// =====================================================

export const assetsRelations = relations(assets, ({ one }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
}))
