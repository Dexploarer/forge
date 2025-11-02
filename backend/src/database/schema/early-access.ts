import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'

// =====================================================
// EARLY ACCESS TABLE - Email Collection
// =====================================================

export const earlyAccess = pgTable('early_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('idx_early_access_email').on(table.email),
}))
