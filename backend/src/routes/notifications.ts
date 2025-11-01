import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, lt } from 'drizzle-orm'
import { notifications } from '../database/schema/system'
import { NotFoundError, ForbiddenError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // List user notifications (paginated)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List user notifications with pagination',
      summary: 'List notifications',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page'),
        type: z.string().optional().describe('Filter by notification type'),
      }),
      response: {
        200: z.object({
          notifications: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            type: z.string(),
            title: z.string(),
            message: z.string().nullable(),
            link: z.string().nullable(),
            metadata: z.record(z.string(), z.any()),
            isRead: z.boolean(),
            createdAt: z.string().datetime(),
            readAt: z.string().datetime().nullable(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        }).describe('Notifications list retrieved successfully')
      }
    }
  }, async (request) => {
    const { page, limit, type } = request.query as { page: number; limit: number; type?: string }
    const offset = (page - 1) * limit
    const userId = request.user!.id

    // Build where clause
    const whereClause = type
      ? and(eq(notifications.userId, userId), eq(notifications.type, type))
      : eq(notifications.userId, userId)

    // Get notifications
    const notificationsList = await fastify.db.query.notifications.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(notifications.createdAt)],
    })

    // Get total count
    const [countResult] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereClause!)

    const total = Number(countResult?.count ?? 0)

    return {
      notifications: serializeAllTimestamps(notificationsList) as any,
      pagination: { page, limit, total },
    }
  })

  // Get unread count
  fastify.get('/unread', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get count of unread notifications',
      summary: 'Get unread count',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          count: z.number().describe('Number of unread notifications')
        }).describe('Unread count retrieved successfully')
      }
    }
  }, async (request) => {
    const userId = request.user!.id

    const [result] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))

    return {
      count: Number(result?.count ?? 0),
    }
  })

  // Mark notification as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Mark notification as read',
      summary: 'Mark as read',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Notification ID'),
      }),
      response: {
        200: z.object({
          notification: z.object({
            id: z.string().uuid(),
            isRead: z.boolean(),
            readAt: z.string().datetime().nullable(),
          })
        }).describe('Notification marked as read'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Notification not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const userId = request.user!.id

    // Verify ownership
    const notification = await fastify.db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    })

    if (!notification) {
      throw new NotFoundError('Notification not found')
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError('Cannot mark another user\'s notification as read')
    }

    const [updated] = await fastify.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning({
        id: notifications.id,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
      })

    return {
      notification: serializeAllTimestamps(updated!) as any,
    }
  })

  // Mark all as read
  fastify.patch('/read-all', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Mark all user notifications as read',
      summary: 'Mark all as read',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          count: z.number().describe('Number of notifications marked as read')
        }).describe('All notifications marked as read')
      }
    }
  }, async (request) => {
    const userId = request.user!.id

    const result = await fastify.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning()

    return {
      count: result.length,
    }
  })

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete notification (own notifications only)',
      summary: 'Delete notification',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Notification ID'),
      }),
      response: {
        204: z.null().describe('Notification deleted successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Cannot delete another user\'s notification'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Notification not found')
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user!.id

    // Verify ownership
    const notification = await fastify.db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    })

    if (!notification) {
      throw new NotFoundError('Notification not found')
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError('Cannot delete another user\'s notification')
    }

    await fastify.db.delete(notifications).where(eq(notifications.id, id))

    reply.code(204).send()
  })

  // Create notification (admin/system only)
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create notification (admin only)',
      summary: 'Create notification',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        userId: z.string().uuid().describe('Target user ID'),
        type: z.string().min(1).max(100).describe('Notification type'),
        title: z.string().min(1).max(255).describe('Notification title'),
        message: z.string().optional().describe('Notification message'),
        link: z.string().optional().describe('Link URL'),
        metadata: z.record(z.string(), z.any()).optional().describe('Additional metadata'),
      }),
      response: {
        201: z.object({
          notification: z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            type: z.string(),
            title: z.string(),
            createdAt: z.string().datetime(),
          })
        }).describe('Notification created successfully'),
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
      userId: string
      type: string
      title: string
      message?: string
      link?: string
      metadata?: Record<string, any>
    }

    const [notification] = await fastify.db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message || null,
      link: data.link || null,
      metadata: data.metadata || {},
      isRead: false,
    }).returning()

    reply.code(201).send({
      notification: serializeAllTimestamps(notification!) as any,
    })
  })

  // Cleanup old notifications (admin only - system maintenance)
  fastify.delete('/cleanup', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete notifications older than specified days (admin only)',
      summary: 'Cleanup old notifications',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        days: z.coerce.number().int().min(1).default(30).describe('Delete notifications older than this many days'),
      }),
      response: {
        200: z.object({
          count: z.number().describe('Number of notifications deleted')
        }).describe('Old notifications cleaned up'),
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

    const { days } = request.query as { days: number }
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const result = await fastify.db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoffDate))
      .returning()

    return {
      count: result.length,
    }
  })
}

export default notificationRoutes
