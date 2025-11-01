import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { users } from '../database/schema'
import { NotFoundError, ForbiddenError } from '../utils/errors'

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get public user profile by ID',
      summary: 'Get user by ID',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('User ID')
      }),
      response: {
        200: z.object({
          user: z.object({
            id: z.string().uuid().describe('User ID'),
            displayName: z.string().nullable().describe('Display name'),
            avatarUrl: z.string().url().nullable().describe('Avatar URL'),
            farcasterUsername: z.string().nullable().describe('Farcaster username'),
            createdAt: z.string().datetime().describe('Account creation date'),
          })
        }).describe('User profile retrieved successfully'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('User not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        farcasterUsername: true,
        createdAt: true,
      }
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      }
    }
  })

  // Update own profile
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update user profile (own profile only)',
      summary: 'Update user profile',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('User ID')
      }),
      body: z.object({
        displayName: z.string().min(1).max(255).optional().describe('Display name'),
        avatarUrl: z.string().url().optional().describe('Avatar URL'),
      }),
      response: {
        200: z.object({
          user: z.object({
            id: z.string().uuid().describe('User ID'),
            displayName: z.string().nullable().describe('Display name'),
            avatarUrl: z.string().url().nullable().describe('Avatar URL'),
            updatedAt: z.string().datetime().describe('Last update timestamp'),
          })
        }).describe('Profile updated successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Can only update own profile')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      displayName?: string
      avatarUrl?: string
    }

    // Check if user is updating their own profile
    if (request.user!.id !== id) {
      throw new ForbiddenError('You can only update your own profile')
    }

    const [updatedUser] = await fastify.db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        updatedAt: users.updatedAt,
      })

    if (!updatedUser) {
      throw new NotFoundError('User not found')
    }

    return {
      user: {
        ...updatedUser,
        updatedAt: updatedUser.updatedAt.toISOString(),
      }
    }
  })

  // List users (admin only)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List all users with pagination (admin only)',
      summary: 'List users',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page'),
      }),
      response: {
        200: z.object({
          users: z.array(z.object({
            id: z.string().uuid().describe('User ID'),
            displayName: z.string().nullable().describe('Display name'),
            avatarUrl: z.string().url().nullable().describe('Avatar URL'),
            role: z.enum(['admin', 'member', 'guest']).describe('User role'),
            createdAt: z.string().datetime().describe('Account creation date'),
          })),
          pagination: z.object({
            page: z.number().describe('Current page'),
            limit: z.number().describe('Items per page'),
            total: z.number().describe('Total number of users'),
          })
        }).describe('Users list retrieved successfully'),
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

    const { page, limit } = request.query as { page: number; limit: number }
    const offset = (page - 1) * limit

    const usersList = await fastify.db.query.users.findMany({
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
      limit,
      offset,
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(users)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      users: usersList.map(user => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
      }
    }
  })
}

export default userRoutes
