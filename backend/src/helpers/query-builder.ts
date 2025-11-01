/**
 * Query Builder Helpers
 * Build complex WHERE clauses with search and filter logic
 */

import { SQL, and, or, eq, ilike, gte, lte, isNull, isNotNull } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'

/**
 * Build search condition across multiple fields
 * Creates OR conditions with ILIKE for case-insensitive search
 *
 * @param searchTerm - Search string to match
 * @param fields - Array of columns to search in
 * @returns SQL condition or undefined if no search term
 *
 * @example
 * const searchCondition = buildSearchCondition(query.search, [
 *   projects.name,
 *   projects.description,
 *   projects.status
 * ])
 */
export function buildSearchCondition(
  searchTerm: string | undefined,
  fields: AnyColumn[]
): SQL | undefined {
  if (!searchTerm || fields.length === 0) {
    return undefined
  }

  const searchPattern = `%${searchTerm}%`
  const conditions = fields.map((field) => ilike(field, searchPattern))

  return or(...conditions)
}

/**
 * Build filter conditions from query parameters
 * Supports exact match, range queries, and null checks
 *
 * @param filters - Object mapping column to filter value/condition
 * @returns SQL condition or undefined
 *
 * @example
 * const filterCondition = buildFilterCondition({
 *   status: { column: projects.status, value: 'active' },
 *   createdAfter: { column: projects.createdAt, operator: 'gte', value: new Date('2025-01-01') },
 *   teamId: { column: projects.teamId, operator: 'isNull' }
 * })
 */
export function buildFilterCondition(filters: {
  [key: string]: FilterCondition
}): SQL | undefined {
  const conditions: SQL[] = []

  Object.values(filters).forEach((filter) => {
    if (!filter.column) return

    switch (filter.operator) {
      case 'eq':
        if (filter.value !== undefined) {
          conditions.push(eq(filter.column, filter.value))
        }
        break
      case 'gte':
        if (filter.value !== undefined) {
          conditions.push(gte(filter.column, filter.value))
        }
        break
      case 'lte':
        if (filter.value !== undefined) {
          conditions.push(lte(filter.column, filter.value))
        }
        break
      case 'isNull':
        conditions.push(isNull(filter.column))
        break
      case 'isNotNull':
        conditions.push(isNotNull(filter.column))
        break
      default:
        // Default to exact match
        if (filter.value !== undefined) {
          conditions.push(eq(filter.column, filter.value))
        }
    }
  })

  if (conditions.length === 0) return undefined
  return and(...conditions)
}

/**
 * Combine multiple WHERE conditions with AND
 * Filters out undefined conditions automatically
 *
 * @param conditions - Array of SQL conditions (can include undefined)
 * @returns Combined SQL condition or undefined
 *
 * @example
 * const whereClause = combineConditions([
 *   eq(projects.ownerId, userId),
 *   buildSearchCondition(search, [projects.name]),
 *   eq(projects.status, 'active')
 * ])
 */
export function combineConditions(
  conditions: (SQL | undefined)[]
): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== undefined)

  if (validConditions.length === 0) return undefined
  if (validConditions.length === 1) return validConditions[0]

  return and(...validConditions)
}

/**
 * Build soft delete filter (excludes archived/deleted records)
 * Checks for null archivedAt, deletedAt, or revokedAt timestamps
 *
 * @param column - Column to check (typically archivedAt or deletedAt)
 * @returns SQL condition checking for null
 *
 * @example
 * const activeOnly = buildSoftDeleteFilter(projects.archivedAt)
 */
export function buildSoftDeleteFilter(column: AnyColumn): SQL {
  return isNull(column)
}

/**
 * Build ownership filter (user owns resource or is admin)
 * For use in queries where ownership determines access
 *
 * @param ownerColumn - Column containing owner ID
 * @param userId - ID of current user
 * @param userRole - Role of current user
 * @returns SQL condition or undefined if admin
 *
 * @example
 * const ownershipFilter = buildOwnershipFilter(projects.ownerId, user.id, user.role)
 */
export function buildOwnershipFilter(
  ownerColumn: AnyColumn,
  userId: string,
  userRole: string
): SQL | undefined {
  // Admins see everything
  if (userRole === 'admin') {
    return undefined
  }

  // Non-admins only see their own resources
  return eq(ownerColumn, userId)
}

/**
 * Build date range filter
 * Filter records between start and end dates
 *
 * @param column - Date column to filter
 * @param start - Start date (optional)
 * @param end - End date (optional)
 * @returns SQL condition or undefined
 *
 * @example
 * const dateFilter = buildDateRangeFilter(
 *   projects.createdAt,
 *   new Date('2025-01-01'),
 *   new Date('2025-12-31')
 * )
 */
export function buildDateRangeFilter(
  column: AnyColumn,
  start?: Date,
  end?: Date
): SQL | undefined {
  const conditions: SQL[] = []

  if (start) {
    conditions.push(gte(column, start))
  }

  if (end) {
    conditions.push(lte(column, end))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]

  return and(...conditions)
}

// Type definitions
export interface FilterCondition {
  column: AnyColumn
  value?: any
  operator?: 'eq' | 'gte' | 'lte' | 'isNull' | 'isNotNull'
}

export interface QueryFilters {
  search?: string
  searchFields?: AnyColumn[]
  filters?: { [key: string]: FilterCondition }
  softDeleteColumn?: AnyColumn
  ownerColumn?: AnyColumn
  userId?: string
  userRole?: string
}

/**
 * Build complete WHERE clause from query parameters
 * Combines search, filters, soft delete, and ownership checks
 *
 * @param options - Query filter options
 * @returns Combined SQL condition or undefined
 *
 * @example
 * const whereClause = buildWhereClause({
 *   search: query.search,
 *   searchFields: [projects.name, projects.description],
 *   filters: {
 *     status: { column: projects.status, value: 'active' }
 *   },
 *   softDeleteColumn: projects.archivedAt,
 *   ownerColumn: projects.ownerId,
 *   userId: request.user!.id,
 *   userRole: request.user!.role
 * })
 */
export function buildWhereClause(options: QueryFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = []

  // Add search condition
  if (options.search && options.searchFields) {
    conditions.push(buildSearchCondition(options.search, options.searchFields))
  }

  // Add custom filters
  if (options.filters) {
    conditions.push(buildFilterCondition(options.filters))
  }

  // Add soft delete filter
  if (options.softDeleteColumn) {
    conditions.push(buildSoftDeleteFilter(options.softDeleteColumn))
  }

  // Add ownership filter
  if (options.ownerColumn && options.userId && options.userRole) {
    conditions.push(
      buildOwnershipFilter(options.ownerColumn, options.userId, options.userRole)
    )
  }

  return combineConditions(conditions)
}
