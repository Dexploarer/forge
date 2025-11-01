/**
 * Serialization Helpers
 * Convert database types to API-friendly formats
 */

/**
 * Convert Date fields to ISO strings for API responses
 * Handles both single objects and arrays
 *
 * @example
 * const serialized = serializeTimestamps(team, ['createdAt', 'updatedAt'])
 * const serializedArray = serializeTimestamps(teams, ['createdAt', 'updatedAt'])
 */
export function serializeTimestamps<T extends Record<string, any>>(
  data: T | T[],
  timestampFields: (keyof T)[] = ['createdAt', 'updatedAt'] as (keyof T)[]
): T | T[] {
  const isArray = Array.isArray(data)
  const items = isArray ? data : [data]

  const convert = (obj: T): T => {
    const result = { ...obj }
    timestampFields.forEach((field) => {
      const value = result[field]
      if (value !== null && value !== undefined && typeof value === 'object' && 'toISOString' in value) {
        result[field] = (value as Date).toISOString() as any
      }
    })
    return result
  }

  const converted = items.map(convert)
  return isArray ? converted : converted[0]!
}

/**
 * Serialize all common timestamp fields found in the database
 * Use this when you want to automatically convert all timestamp fields
 *
 * @example
 * const serialized = serializeAllTimestamps(team)
 */
export function serializeAllTimestamps<T extends Record<string, any>>(
  data: T | T[]
): T | T[] {
  const commonTimestampFields = [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'publishedAt',
    'joinedAt',
    'respondedAt',
    'expiresAt',
    'addedAt',
    'lastLoginAt',
    'lastUsedAt',
    'readAt',
    'revokedAt',
    'startedAt',
    'completedAt',
  ]

  return serializeTimestamps(data, commonTimestampFields as any)
}
