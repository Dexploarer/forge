import type { Database } from '../database/db'
import { notifications } from '../database/schema/system'

/**
 * Notification Service
 * Helper functions for creating and managing notifications
 */

/**
 * Create a notification for a user
 */
export async function createNotification(
  db: Database,
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    link: link || null,
    metadata: metadata || {},
    isRead: false,
  })
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
  db: Database,
  userIds: string[],
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const values = userIds.map(userId => ({
    userId,
    type,
    title,
    message,
    link: link || null,
    metadata: metadata || {},
    isRead: false,
  }))

  await db.insert(notifications).values(values)
}

/**
 * Notification types for type safety
 */
export const NotificationTypes = {
  SYSTEM: 'system',
  TEAM_INVITE: 'team_invite',
  PROJECT_SHARE: 'project_share',
  ASSET_READY: 'asset_ready',
  PAYMENT: 'payment',
  SECURITY: 'security',
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]
