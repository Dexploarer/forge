import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, numeric, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'
import { assets } from './assets'

// =====================================================
// RIGGING METADATA TABLE
// =====================================================
// Skeleton and animation metadata for 3D character models

export const riggingMetadata = pgTable('rigging_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Relationships (one-to-one with assets)
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  // Skeleton Information
  skeletonType: varchar('skeleton_type', { length: 100 }).notNull(), // 'humanoid' | 'quadruped' | 'custom'
  boneCount: integer('bone_count').default(0).notNull(),
  bones: jsonb('bones').$type<Record<string, unknown>>().default({}).notNull(), // Bone hierarchy

  // Rigging Features
  hasBlendShapes: boolean('has_blend_shapes').default(false).notNull(),
  blendShapeCount: integer('blend_shape_count').default(0).notNull(),
  hasIK: boolean('has_ik').default(false).notNull(),
  ikChains: jsonb('ik_chains').$type<unknown[]>().default([]).notNull(),

  // Animation Support
  supportedAnimations: jsonb('supported_animations').$type<string[]>().default([]).notNull(), // Array of animation types
  animationClips: jsonb('animation_clips').$type<unknown[]>().default([]).notNull(), // Animation data

  // Metadata
  riggerNotes: text('rigger_notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  assetIdIdx: index('idx_rigging_asset').on(table.assetId),
  projectIdIdx: index('idx_rigging_project').on(table.projectId),
  assetIdUnique: unique('uq_rigging_asset').on(table.assetId),
}))

// =====================================================
// FITTING SESSIONS TABLE
// =====================================================
// Equipment/armor fitting sessions for character models

export const fittingSessions = pgTable('fitting_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  name: varchar('name', { length: 255 }).notNull(),

  // Relationships
  baseAssetId: uuid('base_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }), // Character model
  equipmentAssetId: uuid('equipment_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }), // Armor/clothing
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Fitting Data
  attachmentPoints: jsonb('attachment_points').$type<Record<string, unknown>>().default({}).notNull(), // Where equipment attaches
  transforms: jsonb('transforms').$type<Record<string, unknown>>().default({}).notNull(), // Position/rotation/scale adjustments
  deformations: jsonb('deformations').$type<Record<string, unknown>>().default({}).notNull(), // Mesh deformations

  // Results
  resultAssetId: uuid('result_asset_id').references(() => assets.id, { onDelete: 'set null' }), // Fitted result
  previewImageUrl: text('preview_image_url'),

  // Status
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'processing' | 'completed' | 'failed'

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  baseAssetIdIdx: index('idx_fitting_base').on(table.baseAssetId),
  equipmentAssetIdIdx: index('idx_fitting_equipment').on(table.equipmentAssetId),
  projectIdIdx: index('idx_fitting_project').on(table.projectId),
  ownerIdIdx: index('idx_fitting_owner').on(table.ownerId),
}))

// =====================================================
// WEAPON DETECTION TABLE
// =====================================================
// AI-powered weapon detection and classification

export const weaponDetection = pgTable('weapon_detection', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Relationship
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),

  // Detection Results
  isWeapon: boolean('is_weapon').default(false).notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  weaponType: varchar('weapon_type', { length: 100 }), // 'sword' | 'bow' | 'staff' | 'axe' | etc.
  weaponClass: varchar('weapon_class', { length: 100 }), // 'melee' | 'ranged' | 'magic'

  // Properties
  estimatedDamage: integer('estimated_damage'),
  estimatedRange: integer('estimated_range'),
  handedness: varchar('handedness', { length: 20 }), // 'one-handed' | 'two-handed'
  gripPoints: jsonb('grip_points').$type<unknown[]>().default([]).notNull(), // Where to hold weapon

  // AI Analysis
  aiModel: varchar('ai_model', { length: 100 }),
  analysisData: jsonb('analysis_data').$type<Record<string, unknown>>().default({}).notNull(),
  processingTime: integer('processing_time'), // milliseconds

  // Verification
  verified: boolean('verified').default(false).notNull(),
  verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  assetIdIdx: index('idx_weapon_asset').on(table.assetId),
  weaponTypeIdx: index('idx_weapon_type').on(table.weaponType),
  isWeaponIdx: index('idx_weapon_is_weapon').on(table.isWeapon),
}))

// =====================================================
// RELATIONS
// =====================================================

export const riggingMetadataRelations = relations(riggingMetadata, ({ one }) => ({
  asset: one(assets, {
    fields: [riggingMetadata.assetId],
    references: [assets.id],
  }),
  project: one(projects, {
    fields: [riggingMetadata.projectId],
    references: [projects.id],
  }),
}))

export const fittingSessionsRelations = relations(fittingSessions, ({ one }) => ({
  baseAsset: one(assets, {
    fields: [fittingSessions.baseAssetId],
    references: [assets.id],
    relationName: 'base_asset',
  }),
  equipmentAsset: one(assets, {
    fields: [fittingSessions.equipmentAssetId],
    references: [assets.id],
    relationName: 'equipment_asset',
  }),
  resultAsset: one(assets, {
    fields: [fittingSessions.resultAssetId],
    references: [assets.id],
    relationName: 'result_asset',
  }),
  project: one(projects, {
    fields: [fittingSessions.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [fittingSessions.ownerId],
    references: [users.id],
  }),
}))

export const weaponDetectionRelations = relations(weaponDetection, ({ one }) => ({
  asset: one(assets, {
    fields: [weaponDetection.assetId],
    references: [assets.id],
  }),
  verifier: one(users, {
    fields: [weaponDetection.verifiedBy],
    references: [users.id],
  }),
}))
