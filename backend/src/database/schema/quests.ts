import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'
import { npcs } from './npcs'

// =====================================================
// QUESTS TABLE
// =====================================================
// Game quests, missions, and objectives

export const quests = pgTable('quests', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // Ownership & Project
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Quest Details
  questType: varchar('quest_type', { length: 100 }).notNull().default('side'), // 'main' | 'side' | 'daily' | 'event'
  difficulty: varchar('difficulty', { length: 50 }).notNull().default('medium'), // 'easy' | 'medium' | 'hard' | 'expert'
  minLevel: integer('min_level').notNull().default(1),
  maxLevel: integer('max_level'),

  // Objectives & Rewards (flexible JSONB structures)
  objectives: jsonb('objectives').$type<Array<{
    id: string
    type: string
    description: string
    target?: string
    count?: number
    completed?: boolean
  }>>().notNull(),
  rewards: jsonb('rewards').$type<{
    experience?: number
    gold?: number
    items?: Array<{ id: string; name: string; quantity: number }>
    reputation?: Record<string, number>
  }>().default({}).notNull(),
  requirements: jsonb('requirements').$type<{
    level?: number
    previousQuests?: string[]
    items?: string[]
    reputation?: Record<string, number>
  }>().default({}).notNull(),

  // Story & Dialog
  startDialog: text('start_dialog'),
  completeDialog: text('complete_dialog'),
  failDialog: text('fail_dialog'),

  // NPCs & Locations
  questGiverNpcId: uuid('quest_giver_npc_id').references(() => npcs.id, { onDelete: 'set null' }),
  location: varchar('location', { length: 255 }),
  relatedNpcs: jsonb('related_npcs').$type<string[]>().default([]).notNull(),

  // Progression
  estimatedDuration: integer('estimated_duration'), // minutes
  repeatable: boolean('repeatable').notNull().default(false),
  cooldownHours: integer('cooldown_hours').notNull().default(0),

  // Metadata
  tags: text('tags').array().default([]).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'active' | 'archived'

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdIdx: index('quests_owner_id_idx').on(table.ownerId),
  projectIdIdx: index('quests_project_id_idx').on(table.projectId),
  questTypeIdx: index('quests_quest_type_idx').on(table.questType),
  difficultyIdx: index('quests_difficulty_idx').on(table.difficulty),
  questGiverNpcIdIdx: index('quests_quest_giver_npc_id_idx').on(table.questGiverNpcId),
  minLevelIdx: index('quests_min_level_idx').on(table.minLevel),
  maxLevelIdx: index('quests_max_level_idx').on(table.maxLevel),
}))

// =====================================================
// RELATIONS
// =====================================================

export const questsRelations = relations(quests, ({ one }) => ({
  project: one(projects, {
    fields: [quests.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [quests.ownerId],
    references: [users.id],
  }),
  questGiverNpc: one(npcs, {
    fields: [quests.questGiverNpcId],
    references: [npcs.id],
  }),
}))
