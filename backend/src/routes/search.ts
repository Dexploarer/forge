import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, and, or, eq, like, gte, lte } from 'drizzle-orm'
import { assets, users } from '../database/schema'

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Advanced asset search
  fastify.get('/assets', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Advanced asset search with multiple filters',
      summary: 'Search assets',
      tags: ['search'],
      querystring: z.object({
        q: z.string().optional().describe('Search query (name, description)'),
        type: z.enum(['model', 'texture', 'audio']).optional().describe('Asset type filter'),
        status: z.enum(['draft', 'processing', 'published', 'failed']).optional().describe('Status filter'),
        visibility: z.enum(['private', 'public']).optional().describe('Visibility filter'),
        tags: z.string().optional().describe('Comma-separated tags'),
        ownerId: z.string().uuid().optional().describe('Filter by owner'),
        minSize: z.coerce.number().optional().describe('Minimum file size in bytes'),
        maxSize: z.coerce.number().optional().describe('Maximum file size in bytes'),
        createdAfter: z.coerce.date().optional().describe('Created after date'),
        createdBefore: z.coerce.date().optional().describe('Created before date'),
        sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'fileSize']).default('createdAt').describe('Sort field'),
        sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(20).describe('Results per page'),
      }),
      response: {
        200: z.object({
          assets: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.enum(['model', 'texture', 'audio']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            visibility: z.enum(['private', 'public']),
            fileUrl: z.string().nullable(),
            fileSize: z.number().nullable(),
            tags: z.array(z.string()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            owner: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              avatarUrl: z.string().url().nullable(),
            })
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
          filters: z.object({
            applied: z.record(z.string(), z.any()),
          })
        })
      }
    }
  }, async (request) => {
    const {
      q,
      type,
      status,
      visibility,
      tags,
      ownerId,
      minSize,
      maxSize,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
      page,
      limit
    } = request.query as any

    const offset = (page - 1) * limit
    const conditions = []

    // Visibility check (same as assets route)
    if (!request.user) {
      conditions.push(eq(assets.visibility, 'public'))
      conditions.push(eq(assets.status, 'published'))
    } else {
      conditions.push(
        or(
          eq(assets.ownerId, request.user.id),
          and(
            eq(assets.visibility, 'public'),
            eq(assets.status, 'published')
          )
        )
      )
    }

    // Text search on name and description
    if (q) {
      conditions.push(
        or(
          like(assets.name, `%${q}%`),
          like(assets.description, `%${q}%`)
        )
      )
    }

    // Type filter
    if (type) {
      conditions.push(eq(assets.type, type))
    }

    // Status filter
    if (status) {
      conditions.push(eq(assets.status, status))
    }

    // Visibility filter
    if (visibility) {
      conditions.push(eq(assets.visibility, visibility))
    }

    // Owner filter
    if (ownerId) {
      conditions.push(eq(assets.ownerId, ownerId))
    }

    // File size filters
    if (minSize !== undefined) {
      conditions.push(gte(assets.fileSize, minSize))
    }
    if (maxSize !== undefined) {
      conditions.push(lte(assets.fileSize, maxSize))
    }

    // Date filters
    if (createdAfter) {
      conditions.push(gte(assets.createdAt, createdAfter))
    }
    if (createdBefore) {
      conditions.push(lte(assets.createdAt, createdBefore))
    }

    // Tags filter (if tags are stored as JSONB array)
    if (tags) {
      const tagArray = tags.split(',').map((t: string) => t.trim())
      conditions.push(
        sql`${assets.tags}::jsonb ?| array[${tagArray.join(',')}]`
      )
    }

    // Build orderBy
    let orderByClause
    const sortDirection = sortOrder === 'asc' ? sql`asc` : sql`desc`

    switch (sortBy) {
      case 'name':
        orderByClause = [sql`${assets.name} ${sortDirection}`]
        break
      case 'updatedAt':
        orderByClause = [sql`${assets.updatedAt} ${sortDirection}`]
        break
      case 'fileSize':
        orderByClause = [sql`${assets.fileSize} ${sortDirection}`]
        break
      default:
        orderByClause = [sql`${assets.createdAt} ${sortDirection}`]
    }

    // Execute query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const assetsList = await fastify.db.query.assets.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: orderByClause,
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          }
        }
      }
    })

    // Get total count
    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)
    const totalPages = Math.ceil(total / limit)

    return {
      assets: assetsList.map(asset => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        owner: asset.owner ? {
          id: asset.owner.id,
          displayName: asset.owner.displayName,
          avatarUrl: asset.owner.avatarUrl,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        applied: { q, type, status, visibility, tags, ownerId, minSize, maxSize, createdAfter, createdBefore }
      }
    }
  })

  // Search users
  fastify.get('/users', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Search users by display name or Farcaster username',
      summary: 'Search users',
      tags: ['search'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        q: z.string().min(1).describe('Search query'),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
      response: {
        200: z.object({
          users: z.array(z.object({
            id: z.string().uuid(),
            displayName: z.string().nullable(),
            avatarUrl: z.string().url().nullable(),
            farcasterUsername: z.string().nullable(),
            role: z.enum(['admin', 'member', 'guest']),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        })
      }
    }
  }, async (request) => {
    const { q, page, limit } = request.query as { q: string; page: number; limit: number }
    const offset = (page - 1) * limit

    const usersList = await fastify.db.query.users.findMany({
      where: or(
        like(users.displayName, `%${q}%`),
        like(users.farcasterUsername, `%${q}%`),
        like(users.email, `%${q}%`)
      ),
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        farcasterUsername: true,
        role: true,
      },
      limit,
      offset,
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        or(
          like(users.displayName, `%${q}%`),
          like(users.farcasterUsername, `%${q}%`),
          like(users.email, `%${q}%`)
        )
      )

    const total = Number(countResult[0]?.count ?? 0)

    return {
      users: usersList,
      pagination: { page, limit, total }
    }
  })
}

export default searchRoutes
