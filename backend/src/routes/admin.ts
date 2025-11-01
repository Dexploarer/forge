import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, gte } from 'drizzle-orm'
import { users, assets } from '../database/schema'
import { ForbiddenError, NotFoundError } from '../utils/errors'

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware to check admin role
  const requireAdmin = async (request: any) => {
    if (!request.user || request.user.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
  }

  // Dashboard statistics
  fastify.get('/stats', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Get admin dashboard statistics',
      summary: 'Dashboard stats',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          stats: z.object({
            totalUsers: z.number().describe('Total number of users'),
            totalAssets: z.number().describe('Total number of assets'),
            publishedAssets: z.number().describe('Published assets count'),
            draftAssets: z.number().describe('Draft assets count'),
            totalStorageBytes: z.number().describe('Total file storage in bytes'),
            newUsersToday: z.number().describe('New users registered today'),
            newAssetsToday: z.number().describe('New assets created today'),
            assetsByType: z.record(z.string(), z.number()).describe('Asset counts by type'),
          })
        })
      }
    }
  }, async (_request) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get total users
    const totalUsersResult = await fastify.db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(users)
    const totalUsers = totalUsersResult[0]?.totalUsers ?? 0

    // Get total assets
    const totalAssetsResult = await fastify.db
      .select({ totalAssets: sql<number>`count(*)` })
      .from(assets)
    const totalAssets = totalAssetsResult[0]?.totalAssets ?? 0

    // Get published assets
    const publishedAssetsResult = await fastify.db
      .select({ publishedAssets: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.status, 'published'))
    const publishedAssets = publishedAssetsResult[0]?.publishedAssets ?? 0

    // Get draft assets
    const draftAssetsResult = await fastify.db
      .select({ draftAssets: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.status, 'draft'))
    const draftAssets = draftAssetsResult[0]?.draftAssets ?? 0

    // Get total storage
    const totalStorageResult = await fastify.db
      .select({ totalStorage: sql<number>`coalesce(sum(${assets.fileSize}), 0)` })
      .from(assets)
    const totalStorage = totalStorageResult[0]?.totalStorage ?? 0

    // New users today
    const newUsersTodayResult = await fastify.db
      .select({ newUsersToday: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, today))
    const newUsersToday = newUsersTodayResult[0]?.newUsersToday ?? 0

    // New assets today
    const newAssetsTodayResult = await fastify.db
      .select({ newAssetsToday: sql<number>`count(*)` })
      .from(assets)
      .where(gte(assets.createdAt, today))
    const newAssetsToday = newAssetsTodayResult[0]?.newAssetsToday ?? 0

    // Assets by type
    const assetTypeResults = await fastify.db
      .select({
        type: assets.type,
        count: sql<number>`count(*)`
      })
      .from(assets)
      .groupBy(assets.type)

    const assetsByType = assetTypeResults.reduce((acc, row) => {
      acc[row.type] = row.count
      return acc
    }, {} as Record<string, number>)

    return {
      stats: {
        totalUsers: Number(totalUsers),
        totalAssets: Number(totalAssets),
        publishedAssets: Number(publishedAssets),
        draftAssets: Number(draftAssets),
        totalStorageBytes: Number(totalStorage),
        newUsersToday: Number(newUsersToday),
        newAssetsToday: Number(newAssetsToday),
        assetsByType: Object.fromEntries(
          Object.entries(assetsByType).map(([k, v]) => [k, Number(v)])
        ),
      }
    }
  })

  // Manage user roles
  fastify.patch('/users/:id/role', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Update user role (admin only)',
      summary: 'Update user role',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('User ID')
      }),
      body: z.object({
        role: z.enum(['admin', 'member', 'guest']).describe('New role to assign')
      }),
      response: {
        200: z.object({
          user: z.object({
            id: z.string().uuid(),
            displayName: z.string().nullable(),
            email: z.string().email().nullable(),
            role: z.enum(['admin', 'member', 'guest']),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { role } = request.body as { role: 'admin' | 'member' | 'guest' }

    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    const [updatedUser] = await fastify.db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
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

  // Delete user (admin only)
  fastify.delete('/users/:id', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Delete user and all their assets (admin only)',
      summary: 'Delete user',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('User ID to delete')
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Prevent admin from deleting themselves
    if (id === request.user!.id) {
      throw new ForbiddenError('Cannot delete your own account')
    }

    // Delete user (assets will cascade delete due to onDelete: 'cascade')
    await fastify.db.delete(users).where(eq(users.id, id))

    reply.code(204).send()
  })

  // Bulk asset status update
  fastify.patch('/assets/bulk-status', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Update status for multiple assets (admin only)',
      summary: 'Bulk update asset status',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        assetIds: z.array(z.string().uuid()).min(1).max(100).describe('Asset IDs to update'),
        status: z.enum(['draft', 'processing', 'published', 'failed']).describe('New status')
      }),
      response: {
        200: z.object({
          updated: z.number().describe('Number of assets updated'),
          assetIds: z.array(z.string().uuid())
        })
      }
    }
  }, async (request) => {
    const { assetIds, status } = request.body as {
      assetIds: string[]
      status: 'draft' | 'processing' | 'published' | 'failed'
    }

    await fastify.db
      .update(assets)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(sql`${assets.id} = ANY(${sql.raw(`ARRAY[${assetIds.map(id => `'${id}'::uuid`).join(',')}]`)})`)

    return {
      updated: assetIds.length,
      assetIds,
    }
  })

  // Get recent activity
  fastify.get('/activity', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Get recent platform activity (admin only)',
      summary: 'Recent activity',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50).describe('Number of records')
      }),
      response: {
        200: z.object({
          activity: z.array(z.object({
            type: z.enum(['user_created', 'asset_created', 'asset_published']),
            timestamp: z.string().datetime(),
            userId: z.string().uuid().nullable(),
            assetId: z.string().uuid().nullable(),
            details: z.record(z.string(), z.any()),
          }))
        })
      }
    }
  }, async (request) => {
    const { limit } = request.query as { limit: number }

    // Get recent users
    const recentUsers = await fastify.db.query.users.findMany({
      limit: Math.floor(limit / 2),
      orderBy: [desc(users.createdAt)],
      columns: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
      }
    })

    // Get recent assets
    const recentAssets = await fastify.db.query.assets.findMany({
      limit: Math.floor(limit / 2),
      orderBy: [desc(assets.createdAt)],
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      }
    })

    const activity = [
      ...recentUsers.map(user => ({
        type: 'user_created' as const,
        timestamp: user.createdAt.toISOString(),
        userId: user.id,
        assetId: null,
        details: {
          displayName: user.displayName,
          email: user.email,
        }
      })),
      ...recentAssets.map(asset => ({
        type: asset.status === 'published' ? 'asset_published' as const : 'asset_created' as const,
        timestamp: asset.createdAt.toISOString(),
        userId: asset.ownerId,
        assetId: asset.id,
        details: {
          name: asset.name,
          type: asset.type,
          owner: asset.owner.displayName,
        }
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return { activity }
  })
}

export default adminRoutes
