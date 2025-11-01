import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { projects } from './projects'

// =====================================================
// MUSIC TRACKS TABLE - Background music, combat music, etc.
// =====================================================

export const musicTracks = pgTable('music_tracks', {
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
  duration: integer('duration'), // seconds
  fileSize: integer('file_size'), // bytes
  format: varchar('format', { length: 20 }), // 'mp3' | 'wav' | 'ogg'

  // Music Metadata
  bpm: integer('bpm'), // 20-300
  key: varchar('key', { length: 10 }), // e.g., 'C Major', 'A Minor'
  genre: varchar('genre', { length: 100 }),
  mood: varchar('mood', { length: 100 }), // 'epic' | 'calm' | 'tense' | 'joyful'
  instruments: jsonb('instruments').$type<string[]>().default([]).notNull(),

  // Generation Info
  generationType: varchar('generation_type', { length: 50 }), // 'ai' | 'upload' | 'manual'
  generationPrompt: text('generation_prompt'),
  generationParams: jsonb('generation_params'),
  generationService: varchar('generation_service', { length: 100 }), // 'suno' | 'elevenlabs' | 'custom'

  // Usage
  usageContext: varchar('usage_context', { length: 100 }), // 'background' | 'combat' | 'menu' | 'cutscene'
  loopable: boolean('loopable').default(false).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),

  // Metadata
  metadata: jsonb('metadata').default({}).notNull(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'processing' | 'published' | 'failed'

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Single column indexes
  ownerIdx: index('idx_music_owner').on(table.ownerId),
  projectIdx: index('idx_music_project').on(table.projectId),
  genreIdx: index('idx_music_genre').on(table.genre),
  moodIdx: index('idx_music_mood').on(table.mood),
  statusIdx: index('idx_music_status').on(table.status),

  // Composite indexes
  ownerStatusIdx: index('idx_music_owner_status').on(table.ownerId, table.status),
  projectStatusIdx: index('idx_music_project_status').on(table.projectId, table.status),
}))

// =====================================================
// RELATIONS
// =====================================================

export const musicTracksRelations = relations(musicTracks, ({ one }) => ({
  owner: one(users, {
    fields: [musicTracks.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [musicTracks.projectId],
    references: [projects.id],
  }),
}))
