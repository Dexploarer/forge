import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { teams } from './teams'

// =====================================================
// ENTITY RELATIONSHIPS
// =====================================================

export const entityRelationships = pgTable('entity_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityAType: varchar('entity_a_type', { length: 100 }).notNull(),
  entityAId: uuid('entity_a_id').notNull(),
  entityBType: varchar('entity_b_type', { length: 100 }).notNull(),
  entityBId: uuid('entity_b_id').notNull(),
  relationshipType: varchar('relationship_type', { length: 100 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  aIdx: index('idx_relationships_a').on(table.entityAType, table.entityAId),
  bIdx: index('idx_relationships_b').on(table.entityBType, table.entityBId),
  typeIdx: index('idx_relationships_type').on(table.relationshipType),
}))

// =====================================================
// ACTIVITY LOG (Audit Trail)
// =====================================================

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  action: varchar('action', { length: 100 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_activity_user').on(table.userId),
  entityIdx: index('idx_activity_entity').on(table.entityType, table.entityId),
  actionIdx: index('idx_activity_action').on(table.action),
  createdIdx: index('idx_activity_created').on(table.createdAt),
}))

// =====================================================
// NOTIFICATIONS
// =====================================================

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message'),
  link: text('link'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('idx_notifications_user').on(table.userId),
  unreadIdx: index('idx_notifications_unread').on(table.userId, table.isRead, table.createdAt),
}))

// =====================================================
// API KEYS & INTEGRATIONS
// =====================================================

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('idx_api_keys_user').on(table.userId),
  teamIdx: index('idx_api_keys_team').on(table.teamId),
  hashIdx: index('idx_api_keys_hash').on(table.keyHash),
}))

// =====================================================
// MODEL CONFIGURATIONS (AI Models)
// =====================================================

export const modelConfigurations = pgTable('model_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskType: varchar('task_type', { length: 100 }).notNull().unique(),
  modelId: varchar('model_id', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  temperature: varchar('temperature', { length: 10 }).default('0.70'),
  maxTokens: integer('max_tokens'),
  displayName: varchar('display_name', { length: 255 }),
  description: text('description'),
  pricingInput: varchar('pricing_input', { length: 20 }),
  pricingOutput: varchar('pricing_output', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskTypeIdx: index('idx_model_configurations_task_type').on(table.taskType),
  isActiveIdx: index('idx_model_configurations_is_active').on(table.isActive),
}))

// =====================================================
// USER AI SERVICE CREDENTIALS
// =====================================================

export const userCredentials = pgTable('user_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: varchar('service', { length: 100 }).notNull(), // 'openai', 'anthropic', 'meshy', 'elevenlabs'
  encryptedApiKey: text('encrypted_api_key').notNull(),
  keyPrefix: varchar('key_prefix', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userServiceIdx: index('idx_user_credentials_user_service').on(table.userId, table.service),
  userIdx: index('idx_user_credentials_user').on(table.userId),
  serviceIdx: index('idx_user_credentials_service').on(table.service),
}))

// =====================================================
// SYSTEM SETTINGS
// =====================================================

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  settingKey: varchar('setting_key', { length: 255 }).notNull().unique(),
  settingValue: jsonb('setting_value').$type<Record<string, unknown>>().notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  keyIdx: index('idx_system_settings_key').on(table.settingKey),
}))

// =====================================================
// RELATIONS
// =====================================================

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [apiKeys.teamId],
    references: [teams.id],
  }),
}))

export const userCredentialsRelations = relations(userCredentials, ({ one }) => ({
  user: one(users, {
    fields: [userCredentials.userId],
    references: [users.id],
  }),
}))

export const modelConfigurationsRelations = relations(modelConfigurations, ({ one }) => ({
  updater: one(users, {
    fields: [modelConfigurations.updatedBy],
    references: [users.id],
  }),
}))

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}))

// =====================================================
// AI SERVICE CALLS (Cost Tracking)
// =====================================================

export const aiServiceCalls = pgTable('ai_service_calls', {
  id: uuid('id').primaryKey().defaultRandom(),

  // User/Request
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: varchar('service', { length: 100 }).notNull(), // 'openai' | 'anthropic' | 'meshy' | 'elevenlabs'
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  model: varchar('model', { length: 100 }),

  // Request/Response
  requestData: jsonb('request_data').$type<Record<string, unknown>>().default({}),
  responseData: jsonb('response_data').$type<Record<string, unknown>>().default({}),
  tokensUsed: integer('tokens_used'),
  cost: integer('cost'), // Cost in cents (USD)

  // Timing
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  // Status
  status: varchar('status', { length: 50 }).notNull(), // 'success' | 'error' | 'timeout'
  error: text('error'),
}, (table) => ({
  userIdx: index('idx_ai_calls_user').on(table.userId),
  serviceIdx: index('idx_ai_calls_service').on(table.service),
  createdIdx: index('idx_ai_calls_created').on(table.createdAt),
  userServiceIdx: index('idx_ai_calls_user_service').on(table.userId, table.service),
}))

export const aiServiceCallsRelations = relations(aiServiceCalls, ({ one }) => ({
  user: one(users, {
    fields: [aiServiceCalls.userId],
    references: [users.id],
  }),
}))
