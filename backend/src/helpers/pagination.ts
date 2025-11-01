/**
 * Pagination Helper
 * Build paginated responses with consistent structure
 */

import type { SQL } from 'drizzle-orm'
import { and, asc, desc, or, ilike, sql } from 'drizzle-orm'
import type { PaginationMetadata } from './responses'

export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: any // Allow additional query params
}

export interface PaginationOptions<T> {
  table: any
  db: any
  query: PaginationQuery
  baseFilters?: SQL[]
  searchFields?: string[]
  sortableFields?: Record<string, any>
  defaultSort?: string
  transform?: (item: T) => any
  maxLimit?: number
}

/**
 * Build paginated response with automatic count, offset, and sorting
 *
 * @example
 * const result = await buildPaginatedResponse({
 *   table: projects,
 *   db: server.db,
 *   query: request.query,
 *   baseFilters: [eq(projects.ownerId, request.user!.id)],
 *   searchFields: ['name', 'description'],
 *   sortableFields: {
 *     name: projects.name,
 *     createdAt: projects.createdAt,
 *     updatedAt: projects.updatedAt,
 *   },
 *   defaultSort: 'createdAt',
 *   transform: (p) => ({ ...p, createdAt: p.createdAt!.toISOString() }),
 * })
 */
export async function buildPaginatedResponse<T>(
  options: PaginationOptions<T>
): Promise<{ data: any[]; pagination: PaginationMetadata }> {
  const {
    table,
    db,
    query,
    baseFilters = [],
    searchFields = [],
    sortableFields = {},
    defaultSort = 'createdAt',
    transform,
    maxLimit = 100,
  } = options

  const page = Math.max(1, query.page || 1)
  const limit = Math.min(maxLimit, Math.max(1, query.limit || 20))
  const offset = (page - 1) * limit

  // Build where clause
  const whereClauses = [...baseFilters]

  if (query.search && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) =>
      ilike(table[field], `%${query.search}%`)
    )
    whereClauses.push(or(...searchConditions)!)
  }

  const whereClause = whereClauses.length > 1 ? and(...whereClauses) : whereClauses[0]

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(whereClause)

  const total = countResult?.count || 0

  // Build order by
  const sortBy = query.sortBy || defaultSort
  const sortColumn = sortableFields[sortBy] || table[sortBy] || table[defaultSort]
  const orderByClause =
    query.sortOrder === 'asc' ? [asc(sortColumn)] : [desc(sortColumn)]

  // Execute query
  const tableName = table._?.name || table._.name
  const results = await db.query[tableName].findMany({
    where: whereClause,
    orderBy: orderByClause,
    limit,
    offset,
  })

  const count = results.length
  const hasMore = offset + count < total

  return {
    data: transform ? results.map(transform) : results,
    pagination: {
      count,
      total,
      page,
      pageSize: limit,
      hasMore,
    },
  }
}

/**
 * Calculate pagination metadata without fetching data
 * Useful when you need just the pagination info
 */
export async function getPaginationMetadata(
  db: any,
  table: any,
  whereClause: SQL | undefined,
  query: PaginationQuery,
  maxLimit: number = 100
): Promise<PaginationMetadata> {
  const page = Math.max(1, query.page || 1)
  const limit = Math.min(maxLimit, Math.max(1, query.limit || 20))
  const offset = (page - 1) * limit

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(whereClause)

  const total = countResult?.count || 0
  const count = Math.min(limit, Math.max(0, total - offset))

  return {
    count,
    total,
    page,
    pageSize: limit,
    hasMore: offset + limit < total,
  }
}
