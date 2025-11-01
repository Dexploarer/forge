/**
 * Bulk Operations Helpers
 * Handle bulk delete, update, and archive operations efficiently
 */

import type { FastifyInstance } from 'fastify'
import { SQL, and, eq, inArray } from 'drizzle-orm'

/**
 * Bulk soft delete (archive) resources
 * Sets archivedAt timestamp for multiple resources
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs to archive
 * @param archiveColumn - Name of archive timestamp column (default: 'archivedAt')
 * @param additionalFilters - Additional WHERE conditions
 * @returns Number of resources archived
 *
 * @example
 * const count = await bulkSoftDelete(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   'archivedAt',
 *   eq(projects.ownerId, userId)
 * )
 */
export async function bulkSoftDelete(
  server: FastifyInstance,
  table: any,
  ids: string[],
  archiveColumn: string = 'archivedAt',
  additionalFilters?: SQL
): Promise<number> {
  if (ids.length === 0) {
    return 0
  }

  const whereConditions: SQL[] = [inArray(table.id, ids)]
  if (additionalFilters) {
    whereConditions.push(additionalFilters)
  }

  const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

  const result = await server.db
    .update(table)
    .set({ [archiveColumn]: new Date() })
    .where(whereClause)
    .returning()

  return result.length
}

/**
 * Bulk hard delete resources
 * Permanently deletes records from database
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs to delete
 * @param additionalFilters - Additional WHERE conditions
 * @returns Number of resources deleted
 *
 * @example
 * const count = await bulkHardDelete(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   eq(projects.ownerId, userId)
 * )
 */
export async function bulkHardDelete(
  server: FastifyInstance,
  table: any,
  ids: string[],
  additionalFilters?: SQL
): Promise<number> {
  if (ids.length === 0) {
    return 0
  }

  const whereConditions: SQL[] = [inArray(table.id, ids)]
  if (additionalFilters) {
    whereConditions.push(additionalFilters)
  }

  const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

  const result = await server.db.delete(table).where(whereClause).returning()

  return result.length
}

/**
 * Bulk update resources
 * Updates multiple resources with same values
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs to update
 * @param updates - Object with fields to update
 * @param additionalFilters - Additional WHERE conditions
 * @returns Number of resources updated
 *
 * @example
 * const count = await bulkUpdate(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   { status: 'archived', updatedAt: new Date() },
 *   eq(projects.ownerId, userId)
 * )
 */
export async function bulkUpdate(
  server: FastifyInstance,
  table: any,
  ids: string[],
  updates: Record<string, any>,
  additionalFilters?: SQL
): Promise<number> {
  if (ids.length === 0) {
    return 0
  }

  const whereConditions: SQL[] = [inArray(table.id, ids)]
  if (additionalFilters) {
    whereConditions.push(additionalFilters)
  }

  const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

  const result = await server.db.update(table).set(updates).where(whereClause).returning()

  return result.length
}

/**
 * Bulk restore (unarchive) resources
 * Sets archivedAt to null for multiple resources
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs to restore
 * @param archiveColumn - Name of archive timestamp column (default: 'archivedAt')
 * @param additionalFilters - Additional WHERE conditions
 * @returns Number of resources restored
 *
 * @example
 * const count = await bulkRestore(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   'archivedAt',
 *   eq(projects.ownerId, userId)
 * )
 */
export async function bulkRestore(
  server: FastifyInstance,
  table: any,
  ids: string[],
  archiveColumn: string = 'archivedAt',
  additionalFilters?: SQL
): Promise<number> {
  if (ids.length === 0) {
    return 0
  }

  const whereConditions: SQL[] = [inArray(table.id, ids)]
  if (additionalFilters) {
    whereConditions.push(additionalFilters)
  }

  const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

  const result = await server.db
    .update(table)
    .set({ [archiveColumn]: null })
    .where(whereClause)
    .returning()

  return result.length
}

/**
 * Validate ownership for bulk operations
 * Ensures user owns all resources before performing bulk operation
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs
 * @param userId - ID of user performing operation
 * @param ownerColumn - Name of owner ID column (default: 'ownerId')
 * @returns True if user owns all resources, false otherwise
 *
 * @example
 * const canProceed = await validateBulkOwnership(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   userId,
 *   'ownerId'
 * )
 * if (!canProceed) {
 *   throw server.httpErrors.forbidden('You do not own all selected resources')
 * }
 */
export async function validateBulkOwnership(
  server: FastifyInstance,
  table: any,
  ids: string[],
  userId: string,
  ownerColumn: string = 'ownerId'
): Promise<boolean> {
  if (ids.length === 0) {
    return true
  }

  const tableName = table._?.name || table._.name

  const resources = await (server.db.query as Record<string, any>)[tableName].findMany({
    where: inArray(table.id, ids),
    columns: {
      id: true,
      [ownerColumn]: true,
    },
  })

  // Check if we found all resources
  if (resources.length !== ids.length) {
    return false
  }

  // Check if user owns all resources
  return resources.every((resource: Record<string, string>) => resource[ownerColumn] === userId)
}

/**
 * Bulk transfer ownership
 * Changes owner of multiple resources
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs
 * @param currentOwnerId - Current owner's user ID
 * @param newOwnerId - New owner's user ID
 * @param ownerColumn - Name of owner ID column (default: 'ownerId')
 * @returns Number of resources transferred
 *
 * @example
 * const count = await bulkTransferOwnership(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   currentUserId,
 *   newUserId,
 *   'ownerId'
 * )
 */
export async function bulkTransferOwnership(
  server: FastifyInstance,
  table: any,
  ids: string[],
  currentOwnerId: string,
  newOwnerId: string,
  ownerColumn: string = 'ownerId'
): Promise<number> {
  if (ids.length === 0) {
    return 0
  }

  const whereClause = and(inArray(table.id, ids), eq(table[ownerColumn], currentOwnerId))

  const result = await server.db
    .update(table)
    .set({
      [ownerColumn]: newOwnerId,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning()

  return result.length
}

/**
 * Batch process resources in chunks
 * Processes large arrays in smaller batches to avoid memory issues
 *
 * @param items - Array of items to process
 * @param batchSize - Size of each batch (default: 100)
 * @param processor - Async function to process each batch
 * @returns Array of results from each batch
 *
 * @example
 * const results = await batchProcess(
 *   projectIds,
 *   50,
 *   async (batch) => {
 *     return await bulkSoftDelete(server, projects, batch)
 *   }
 * )
 * const totalDeleted = results.reduce((sum, count) => sum + count, 0)
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number = 100,
  processor: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const result = await processor(batch)
    results.push(result)
  }

  return results
}

/**
 * Count resources by filter
 * Get count before performing bulk operation
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param whereClause - WHERE condition
 * @returns Number of matching resources
 *
 * @example
 * const affectedCount = await countResources(
 *   server,
 *   projects,
 *   and(eq(projects.status, 'draft'), eq(projects.ownerId, userId))
 * )
 */
export async function countResources(
  server: FastifyInstance,
  table: any,
  whereClause?: SQL
): Promise<number> {
  const tableName = table._?.name || table._.name

  if (!whereClause) {
    const result = await (server.db.query as Record<string, any>)[tableName].findMany()
    return result.length
  }

  const results = await (server.db.query as Record<string, any>)[tableName].findMany({
    where: whereClause,
  })

  return results.length
}

// Type definitions
export interface BulkOperationResult {
  success: boolean
  count: number
  message: string
  errors?: string[]
}

/**
 * Execute bulk operation with validation
 * Wrapper that adds ownership validation and error handling
 *
 * @param server - Fastify instance
 * @param table - Database table
 * @param ids - Array of resource IDs
 * @param userId - ID of user performing operation
 * @param userRole - Role of user performing operation
 * @param operation - Bulk operation to perform
 * @param requireOwnership - Whether to validate ownership (default: true)
 * @returns Operation result with success status and count
 *
 * @example
 * const result = await executeBulkOperation(
 *   server,
 *   projects,
 *   ['id1', 'id2', 'id3'],
 *   userId,
 *   userRole,
 *   async (ids) => await bulkSoftDelete(server, projects, ids),
 *   true
 * )
 */
export async function executeBulkOperation(
  server: FastifyInstance,
  table: any,
  ids: string[],
  userId: string,
  userRole: string,
  operation: (ids: string[]) => Promise<number>,
  requireOwnership: boolean = true
): Promise<BulkOperationResult> {
  if (ids.length === 0) {
    return {
      success: false,
      count: 0,
      message: 'No resources specified',
    }
  }

  // Admins bypass ownership check
  if (requireOwnership && userRole !== 'admin') {
    const isOwner = await validateBulkOwnership(server, table, ids, userId)
    if (!isOwner) {
      return {
        success: false,
        count: 0,
        message: 'You do not have permission to modify some of the selected resources',
      }
    }
  }

  try {
    const count = await operation(ids)
    return {
      success: true,
      count,
      message: `Successfully processed ${count} resource(s)`,
    }
  } catch (error) {
    server.log.error({ error, ids, userId }, 'Bulk operation failed')
    return {
      success: false,
      count: 0,
      message: 'Bulk operation failed',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
