import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'
import { assets } from './assets'

// =====================================================
// NPCS TABLE
// =====================================================
// Non-player characters for games

export const npcs = pgTable('npcs', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Ownership & Project
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Character Details
  title: varchar('title', { length: 255 }), // e.g., "Village Blacksmith"
  race: varchar('race', { length: 100 }),
  class: varchar('class', { length: 100 }),
  level: integer('level').notNull().default(1),
  faction: varchar('faction', { length: 100 }),

  // Personality & Behavior
  personality: text('personality'),
  backstory: text('backstory'),
  behavior: varchar('behavior', { length: 100 }).notNull().default('neutral'), // 'friendly' | 'neutral' | 'hostile' | 'merchant'

  // Dialog & Voice
  dialogLines: jsonb('dialog_lines').$type<Array<{
    id: string
    trigger?: string
    text: string
    responses?: Array<{ text: string; nextId?: string }>
  }>>().default([]).notNull(),
  voiceId: uuid('voice_id'), // FK to voice_profiles (future table)
  voiceSettings: jsonb('voice_settings').$type<Record<string, any>>().default({}).notNull(),

  // Appearance
  appearance: jsonb('appearance').$type<{
    height?: string
    build?: string
    hairColor?: string
    eyeColor?: string
    features?: string[]
    clothing?: string
  }>().default({}).notNull(),
  modelAssetId: uuid('model_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  portraitUrl: text('portrait_url'),

  // Location & Movement
  location: varchar('location', { length: 255 }),
  spawnPoints: jsonb('spawn_points').$type<Array<{
    x: number
    y: number
    z: number
    label?: string
  }>>().default([]).notNull(),
  patrolRoute: jsonb('patrol_route').$type<Array<{
    x: number
    y: number
    z: number
    waitTime?: number
  }>>().default([]).notNull(),

  // Combat & Stats (optional)
  health: integer('health').notNull().default(100),
  armor: integer('armor').notNull().default(0),
  damage: integer('damage').notNull().default(10),
  abilities: jsonb('abilities').$type<Array<{
    id: string
    name: string
    description: string
    cooldown?: number
    damage?: number
  }>>().default([]).notNull(),
  lootTable: jsonb('loot_table').$type<Array<{
    itemId: string
    itemName: string
    dropChance: number
    minQuantity?: number
    maxQuantity?: number
  }>>().default([]).notNull(),

  // Interactions
  questIds: jsonb('quest_ids').$type<string[]>().default([]).notNull(),
  sells: jsonb('sells').$type<Array<{
    itemId: string
    itemName: string
    price: number
    stock?: number
  }>>().default([]).notNull(),
  teaches: jsonb('teaches').$type<Array<{
    id: string
    type: string // 'skill' | 'recipe' | 'spell'
    name: string
    cost?: number
  }>>().default([]).notNull(),

  // Metadata
  tags: text('tags').array().default([]).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'active' | 'archived'

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdIdx: index('npcs_owner_id_idx').on(table.ownerId),
  projectIdIdx: index('npcs_project_id_idx').on(table.projectId),
  locationIdx: index('npcs_location_idx').on(table.location),
  factionIdx: index('npcs_faction_idx').on(table.faction),
  behaviorIdx: index('npcs_behavior_idx').on(table.behavior),
  levelIdx: index('npcs_level_idx').on(table.level),
}))

// =====================================================
// RELATIONS
// =====================================================

export const npcsRelations = relations(npcs, ({ one }) => ({
  project: one(projects, {
    fields: [npcs.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [npcs.ownerId],
    references: [users.id],
  }),
  modelAsset: one(assets, {
    fields: [npcs.modelAssetId],
    references: [assets.id],
  }),
}))
