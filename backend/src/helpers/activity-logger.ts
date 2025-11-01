import type { Database } from '../database/db'
import type { FastifyRequest } from 'fastify'
import { activityLog } from '../database/schema/system'

/**
 * Activity Logger
 * Helper functions for logging user activities to audit trail
 */

/**
 * Log an activity to the activity_log table
 */
export async function logActivity(
  db: Database,
  userId: string | null,
  entityType: string,
  entityId: string | null,
  action: string,
  details: Record<string, unknown>,
  request?: FastifyRequest
): Promise<void> {
  const ipAddress = request?.ip || null
  const userAgent = request?.headers['user-agent'] || null

  await db.insert(activityLog).values({
    userId,
    entityType,
    entityId,
    action,
    details,
    ipAddress,
    userAgent,
  })
}

/**
 * Activity action types for consistency
 */
export const ActivityActions = {
  // Generic CRUD
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',

  // Specific actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  INVITE: 'invite',
  JOIN: 'join',
  LEAVE: 'leave',
  SHARE: 'share',
  REVOKE: 'revoke',

  // Admin actions
  ADMIN_ACTION: 'admin_action',
  SETTINGS_CHANGE: 'settings_change',
} as const

export type ActivityAction = typeof ActivityActions[keyof typeof ActivityActions]

/**
 * Entity types for activity logging
 */
export const EntityTypes = {
  USER: 'user',
  TEAM: 'team',
  PROJECT: 'project',
  ASSET: 'asset',
  API_KEY: 'api_key',
  CREDENTIAL: 'credential',
  NOTIFICATION: 'notification',
  SYSTEM_SETTING: 'system_setting',
} as const

export type EntityType = typeof EntityTypes[keyof typeof EntityTypes]
