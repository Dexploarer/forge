import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, eq, desc, gte } from 'drizzle-orm'
import { assets, users } from '../database/schema'
import { ForbiddenError, NotFoundError } from '../utils/errors'

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get asset analytics (owner or admin only)
  fastify.get('/assets/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get analytics for a specific asset',
      summary: 'Asset analytics',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Asset ID')
      }),
      response: {
        200: z.object({
          analytics: z.object({
            assetId: z.string().uuid(),
            assetName: z.string(),
            type: z.enum(['model', 'texture', 'audio', 'image']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            visibility: z.enum(['private', 'public']),
            fileSize: z.number().nullable(),
            fileSizeFormatted: z.string(),
            createdAt: z.string().datetime(),
            publishedAt: z.string().datetime().nullable(),
            lastUpdated: z.string().datetime(),
            daysPublished: z.number().nullable(),
            tags: z.array(z.string()),
            owner: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
            })
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      }
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    // Check permissions (owner or admin)
    if (asset.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    // Calculate days published
    let daysPublished = null
    if (asset.publishedAt) {
      const diffTime = Date.now() - asset.publishedAt.getTime()
      daysPublished = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    }

    // Format file size
    const formatBytes = (bytes: number | null) => {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
    }

    return {
      analytics: {
        assetId: asset.id,
        assetName: asset.name,
        type: asset.type,
        status: asset.status,
        visibility: asset.visibility,
        fileSize: asset.fileSize,
        fileSizeFormatted: formatBytes(asset.fileSize),
        createdAt: asset.createdAt.toISOString(),
        publishedAt: asset.publishedAt?.toISOString() ?? null,
        lastUpdated: asset.updatedAt.toISOString(),
        daysPublished,
        tags: Array.isArray(asset.tags) ? asset.tags : [],
        owner: asset.owner,
      }
    }
  })

  // Get user's asset statistics
  fastify.get('/users/:id/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get asset statistics for a user',
      summary: 'User asset stats',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('User ID')
      }),
      response: {
        200: z.object({
          stats: z.object({
            userId: z.string().uuid(),
            displayName: z.string().nullable(),
            totalAssets: z.number(),
            assetsByType: z.object({
              model: z.number(),
              texture: z.number(),
              audio: z.number(),
              image: z.number(),
            }),
            assetsByStatus: z.object({
              draft: z.number(),
              processing: z.number(),
              published: z.number(),
              failed: z.number(),
            }),
            totalStorageBytes: z.number(),
            totalStorageFormatted: z.string(),
            memberSince: z.string().datetime(),
            lastActive: z.string().datetime().nullable(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    // Check permissions (own stats or admin)
    if (id !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
      }
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Get total assets
    const totalAssetsResult = await fastify.db
      .select({ totalAssets: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.ownerId, id))
    const totalAssets = Number(totalAssetsResult[0]?.totalAssets ?? 0)

    // Assets by type
    const typeResults = await fastify.db
      .select({
        type: assets.type,
        count: sql<number>`count(*)`
      })
      .from(assets)
      .where(eq(assets.ownerId, id))
      .groupBy(assets.type)

    const assetsByType = {
      model: 0,
      texture: 0,
      audio: 0,
      image: 0,
    }
    typeResults.forEach(row => {
      assetsByType[row.type] = Number(row.count)
    })

    // Assets by status
    const statusResults = await fastify.db
      .select({
        status: assets.status,
        count: sql<number>`count(*)`
      })
      .from(assets)
      .where(eq(assets.ownerId, id))
      .groupBy(assets.status)

    const assetsByStatus = {
      draft: 0,
      processing: 0,
      published: 0,
      failed: 0,
    }
    statusResults.forEach(row => {
      assetsByStatus[row.status] = Number(row.count)
    })

    // Total storage
    const totalStorageResult = await fastify.db
      .select({ totalStorage: sql<number>`coalesce(sum(${assets.fileSize}), 0)` })
      .from(assets)
      .where(eq(assets.ownerId, id))
    const totalStorage = totalStorageResult[0]?.totalStorage ?? 0

    const formatBytes = (bytes: number) => {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
    }

    return {
      stats: {
        userId: user.id,
        displayName: user.displayName,
        totalAssets,
        assetsByType,
        assetsByStatus,
        totalStorageBytes: Number(totalStorage),
        totalStorageFormatted: formatBytes(Number(totalStorage)),
        memberSince: user.createdAt.toISOString(),
        lastActive: user.lastLoginAt?.toISOString() ?? null,
      }
    }
  })

  // Get platform-wide analytics (admin only)
  fastify.get('/platform', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get platform-wide analytics (admin only)',
      summary: 'Platform analytics',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          analytics: z.object({
            overview: z.object({
              totalUsers: z.number(),
              totalAssets: z.number(),
              totalStorageBytes: z.number(),
              totalStorageFormatted: z.string(),
            }),
            trends: z.object({
              usersLast7Days: z.number(),
              usersLast30Days: z.number(),
              assetsLast7Days: z.number(),
              assetsLast30Days: z.number(),
            }),
            topAssetTypes: z.array(z.object({
              type: z.string(),
              count: z.number(),
              percentage: z.number(),
            })),
            topCreators: z.array(z.object({
              userId: z.string().uuid(),
              displayName: z.string().nullable(),
              assetCount: z.number(),
            })),
          })
        })
      }
    }
  }, async (request) => {
    // Admin only
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Overview stats
    const totalUsersResult = await fastify.db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(users)
    const totalUsers = Number(totalUsersResult[0]?.totalUsers ?? 0)

    const totalAssetsResult = await fastify.db
      .select({ totalAssets: sql<number>`count(*)` })
      .from(assets)
    const totalAssets = Number(totalAssetsResult[0]?.totalAssets ?? 0)

    const totalStorageResult = await fastify.db
      .select({ totalStorage: sql<number>`coalesce(sum(${assets.fileSize}), 0)` })
      .from(assets)
    const totalStorage = Number(totalStorageResult[0]?.totalStorage ?? 0)

    // Trends
    const usersLast7DaysResult = await fastify.db
      .select({ usersLast7Days: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo))
    const usersLast7Days = Number(usersLast7DaysResult[0]?.usersLast7Days ?? 0)

    const usersLast30DaysResult = await fastify.db
      .select({ usersLast30Days: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
    const usersLast30Days = Number(usersLast30DaysResult[0]?.usersLast30Days ?? 0)

    const assetsLast7DaysResult = await fastify.db
      .select({ assetsLast7Days: sql<number>`count(*)` })
      .from(assets)
      .where(gte(assets.createdAt, sevenDaysAgo))
    const assetsLast7Days = Number(assetsLast7DaysResult[0]?.assetsLast7Days ?? 0)

    const assetsLast30DaysResult = await fastify.db
      .select({ assetsLast30Days: sql<number>`count(*)` })
      .from(assets)
      .where(gte(assets.createdAt, thirtyDaysAgo))
    const assetsLast30Days = Number(assetsLast30DaysResult[0]?.assetsLast30Days ?? 0)

    // Top asset types
    const typeResults = await fastify.db
      .select({
        type: assets.type,
        count: sql<number>`count(*)`
      })
      .from(assets)
      .groupBy(assets.type)
      .orderBy(desc(sql`count(*)`))

    const total = totalAssets
    const topAssetTypes = typeResults.map(row => ({
      type: row.type,
      count: Number(row.count),
      percentage: total > 0 ? Math.round((Number(row.count) / total) * 100) : 0,
    }))

    // Top creators
    const creatorResults = await fastify.db
      .select({
        userId: assets.ownerId,
        count: sql<number>`count(*)`
      })
      .from(assets)
      .groupBy(assets.ownerId)
      .orderBy(desc(sql`count(*)`))
      .limit(10)

    const topCreators = await Promise.all(
      creatorResults.map(async (row) => {
        const user = await fastify.db.query.users.findFirst({
          where: eq(users.id, row.userId),
          columns: { id: true, displayName: true }
        })
        return {
          userId: row.userId,
          displayName: user?.displayName ?? 'Unknown',
          assetCount: Number(row.count),
        }
      })
    )

    const formatBytes = (bytes: number) => {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
    }

    return {
      analytics: {
        overview: {
          totalUsers,
          totalAssets,
          totalStorageBytes: totalStorage,
          totalStorageFormatted: formatBytes(totalStorage),
        },
        trends: {
          usersLast7Days,
          usersLast30Days,
          assetsLast7Days,
          assetsLast30Days,
        },
        topAssetTypes,
        topCreators,
      }
    }
  })
}

export default analyticsRoutes
