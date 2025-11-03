import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { teams } from './teams'
import { assets } from './assets'

// =====================================================
// PROJECTS TABLE
// =====================================================
// Team-based workspaces for organizing assets and collaboration

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Basic Information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Team relationship
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // Project owner (must be a team member)
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Project status
  status: varchar('status', { length: 50 }).default('active'),

  // Project settings (flexible JSON)
  settings: jsonb('settings').$type<{
    visibility?: 'private' | 'team' | 'public'
    allowComments?: boolean
    requireApproval?: boolean
    [key: string]: any
  }>().default({}).notNull(),

  // Metadata
  tags: text('tags').array().default([]).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  teamIdIdx: index('projects_team_id_idx').on(table.teamId),
  ownerIdIdx: index('projects_owner_id_idx').on(table.ownerId),
}))

// =====================================================
// PROJECT ASSETS TABLE (Junction)
// =====================================================
// Many-to-many relationship between projects and assets

export const projectAssets = pgTable('project_assets', {
  id: uuid('id').defaultRandom().primaryKey(),

  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),

  // Who added the asset to the project
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // When the asset was added
  addedAt: timestamp('added_at').defaultNow().notNull(),

  // Optional notes about why this asset is in the project
  notes: text('notes'),
}, (table) => ({
  projectIdIdx: index('project_assets_project_id_idx').on(table.projectId),
  assetIdIdx: index('project_assets_asset_id_idx').on(table.assetId),
}))

// =====================================================
// PROJECT MEMBERS TABLE
// =====================================================
// Users who have access to specific projects (must also be team members)

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),

  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Project-specific role
  role: varchar('role', { length: 50 }).notNull().default('member'), // owner, editor, viewer, member

  // Who added this member to the project
  invitedBy: uuid('invited_by').references(() => users.id),

  // Timestamps
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('project_members_project_id_idx').on(table.projectId),
  userIdIdx: index('project_members_user_id_idx').on(table.userId),
}))

// =====================================================
// RELATIONS
// =====================================================

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  projectAssets: many(projectAssets),
  projectMembers: many(projectMembers),
}))

export const projectAssetsRelations = relations(projectAssets, ({ one }) => ({
  project: one(projects, {
    fields: [projectAssets.projectId],
    references: [projects.id],
  }),
  asset: one(assets, {
    fields: [projectAssets.assetId],
    references: [assets.id],
  }),
  addedByUser: one(users, {
    fields: [projectAssets.addedBy],
    references: [users.id],
  }),
}))

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [projectMembers.invitedBy],
    references: [users.id],
  }),
}))
