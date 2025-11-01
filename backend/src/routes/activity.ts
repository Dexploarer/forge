import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm'
import { activityLog } from '../database/schema/system'
import { ForbiddenError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'

const activityRoutes: FastifyPluginAsync = async (fastify) => {
  // List all activity logs (admin only)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List all activity logs (admin only)',
      summary: 'List activity logs',
      tags: ['activity'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(50).describe('Items per page'),
        entityType: z.string().optional().describe('Filter by entity type'),
        action: z.string().optional().describe('Filter by action'),
        userId: z.string().uuid().optional().describe('Filter by user ID'),
        startDate: z.string().datetime().optional().describe('Filter by start date'),
        endDate: z.string().datetime().optional().describe('Filter by end date'),
      }),
      response: {
        200: z.object({
          activities: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            entityType: z.string(),
            entityId: z.string().uuid().nullable(),
            action: z.string(),
            details: z.record(z.string(), z.any()),
            ipAddress: z.string().nullable(),
            userAgent: z.string().nullable(),
            createdAt: z.string().datetime(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        }).describe('Activity logs retrieved successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Admin access required')
      }
    }
  }, async (request) => {
    // Check admin role
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const { page, limit, entityType, action, userId, startDate, endDate } = request.query as {
      page: number
      limit: number
      entityType?: string
      action?: string
      userId?: string
      startDate?: string
      endDate?: string
    }
    const offset = (page - 1) * limit

    // Build where clauses
    const whereClauses = []
    if (entityType) whereClauses.push(eq(activityLog.entityType, entityType))
    if (action) whereClauses.push(eq(activityLog.action, action))
    if (userId) whereClauses.push(eq(activityLog.userId, userId))
    if (startDate) whereClauses.push(gte(activityLog.createdAt, new Date(startDate)))
    if (endDate) whereClauses.push(lte(activityLog.createdAt, new Date(endDate)))

    const whereClause = whereClauses.length > 0 ? and(...whereClauses) : undefined

    // Get activity logs
    const activities = await fastify.db.query.activityLog.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(activityLog.createdAt)],
    })

    // Get total count
    const [countResult] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(whereClause)

    const total = Number(countResult?.count ?? 0)

    return {
      activities: serializeAllTimestamps(activities) as any,
      pagination: { page, limit, total },
    }
  })

  // Get user's activity (self or admin)
  fastify.get('/user/:userId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get user activity (own activity or admin)',
      summary: 'Get user activity',
      tags: ['activity'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        userId: z.string().uuid().describe('User ID'),
      }),
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(50).describe('Items per page'),
        entityType: z.string().optional().describe('Filter by entity type'),
        action: z.string().optional().describe('Filter by action'),
      }),
      response: {
        200: z.object({
          activities: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            entityType: z.string(),
            entityId: z.string().uuid().nullable(),
            action: z.string(),
            details: z.record(z.string(), z.any()),
            createdAt: z.string().datetime(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        }).describe('User activity retrieved successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Can only view own activity or admin required')
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string }

    // Check if user is viewing their own activity or is admin
    if (request.user!.id !== userId && request.user!.role !== 'admin') {
      throw new ForbiddenError('You can only view your own activity')
    }

    const { page, limit, entityType, action } = request.query as {
      page: number
      limit: number
      entityType?: string
      action?: string
    }
    const offset = (page - 1) * limit

    // Build where clauses
    const whereClauses = [eq(activityLog.userId, userId)]
    if (entityType) whereClauses.push(eq(activityLog.entityType, entityType))
    if (action) whereClauses.push(eq(activityLog.action, action))

    const whereClause = and(...whereClauses)

    // Get activity logs (without IP/UserAgent for privacy)
    const activities = await fastify.db.query.activityLog.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(activityLog.createdAt)],
      columns: {
        id: true,
        userId: true,
        entityType: true,
        entityId: true,
        action: true,
        details: true,
        createdAt: true,
        // Exclude ipAddress and userAgent for non-admin users
      }
    })

    // Get total count
    const [countResult] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(whereClause)

    const total = Number(countResult?.count ?? 0)

    return {
      activities: serializeAllTimestamps(activities) as any,
      pagination: { page, limit, total },
    }
  })

  // Create activity log entry (internal/system use)
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create activity log entry (admin/system only)',
      summary: 'Create activity log',
      tags: ['activity'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        userId: z.string().uuid().nullable().optional().describe('User ID'),
        entityType: z.string().min(1).max(100).describe('Entity type'),
        entityId: z.string().uuid().nullable().optional().describe('Entity ID'),
        action: z.string().min(1).max(100).describe('Action performed'),
        details: z.record(z.string(), z.any()).optional().describe('Additional details'),
      }),
      response: {
        201: z.object({
          activity: z.object({
            id: z.string().uuid(),
            entityType: z.string(),
            action: z.string(),
            createdAt: z.string().datetime(),
          })
        }).describe('Activity log created successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Admin access required')
      }
    }
  }, async (request, reply) => {
    // Check admin role
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const data = request.body as {
      userId?: string | null
      entityType: string
      entityId?: string | null
      action: string
      details?: Record<string, any>
    }

    const [activity] = await fastify.db.insert(activityLog).values({
      userId: data.userId || null,
      entityType: data.entityType,
      entityId: data.entityId || null,
      action: data.action,
      details: data.details || {},
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] || null,
    }).returning()

    reply.code(201).send({
      activity: serializeAllTimestamps(activity!) as any,
    })
  })
}

export default activityRoutes
