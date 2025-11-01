import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'

// =====================================================
// LORE ENTRIES TABLE
// =====================================================
// Game world lore, history, and narrative content

export const loreEntries = pgTable('lore_entries', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  summary: text('summary'),

  // Ownership & Project
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Categorization
  category: varchar('category', { length: 100 }),
  tags: text('tags').array().default([]).notNull(),

  // Timeline & Context
  era: varchar('era', { length: 255 }),
  region: varchar('region', { length: 255 }),
  timelinePosition: integer('timeline_position'),
  importanceLevel: integer('importance_level').notNull().default(5), // 1-10

  // Related Content (UUID arrays)
  relatedCharacters: jsonb('related_characters').$type<string[]>().default([]).notNull(),
  relatedLocations: jsonb('related_locations').$type<string[]>().default([]).notNull(),
  relatedEvents: jsonb('related_events').$type<string[]>().default([]).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'published' | 'archived'

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdIdx: index('lore_entries_owner_id_idx').on(table.ownerId),
  projectIdIdx: index('lore_entries_project_id_idx').on(table.projectId),
  categoryIdx: index('lore_entries_category_idx').on(table.category),
  eraIdx: index('lore_entries_era_idx').on(table.era),
  regionIdx: index('lore_entries_region_idx').on(table.region),
  timelinePositionIdx: index('lore_entries_timeline_position_idx').on(table.timelinePosition),
}))

// =====================================================
// RELATIONS
// =====================================================

export const loreEntriesRelations = relations(loreEntries, ({ one }) => ({
  project: one(projects, {
    fields: [loreEntries.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [loreEntries.ownerId],
    references: [users.id],
  }),
}))
