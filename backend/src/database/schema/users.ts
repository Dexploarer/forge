import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userRole } from './enums'

// =====================================================
// USERS TABLE - Authentication & Profiles
// =====================================================

export const users = pgTable('users', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull().unique(),

  // Basic Profile
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),

  // Web3 Identity
  walletAddress: varchar('wallet_address', { length: 255 }),

  // Farcaster Integration
  farcasterFid: integer('farcaster_fid').unique(),
  farcasterUsername: varchar('farcaster_username', { length: 255 }),
  farcasterVerified: boolean('farcaster_verified').default(false),
  farcasterProfile: jsonb('farcaster_profile'),

  // Authorization
  role: userRole('role').default('member').notNull(),

  // Metadata
  settings: jsonb('settings').default({}).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  // Indexes for fast lookups
  privyIdIdx: index('idx_users_privy_id').on(table.privyUserId),
  emailIdx: index('idx_users_email').on(table.email),
  walletIdx: index('idx_users_wallet').on(table.walletAddress),
  farcasterFidIdx: index('idx_users_farcaster_fid').on(table.farcasterFid),
  roleIdx: index('idx_users_role').on(table.role),
}))

// =====================================================
// RELATIONS
// =====================================================

export const usersRelations = relations(users, ({ many }) => ({
  assets: many('assets' as any), // Will be defined in assets.ts
}))
