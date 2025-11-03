import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, gte } from 'drizzle-orm'
import { users, assets } from '../database/schema'
import { ForbiddenError, NotFoundError } from '../utils/errors'

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Debug endpoint to check auth status
  fastify.get('/debug-auth', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Debug endpoint to check authentication and admin status',
      summary: 'Debug auth',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
    }
  }, async (request) => {
    return {
      authenticated: !!request.user,
      privyUserId: request.user?.privyUserId,
      walletAddress: request.user?.walletAddress,
      email: request.user?.email,
      isAdmin: request.user?.isAdmin,
      fullUser: request.user
    }
  })

  // Middleware to check admin access
  const requireAdmin = async (request: any) => {
    if (!request.user) {
      fastify.log.warn('Admin access denied: No authenticated user')
      throw new ForbiddenError('Admin access required')
    }

    if (!request.user.isAdmin) {
      fastify.log.warn({
        userId: request.user.id,
        isAdmin: request.user.isAdmin
      }, 'Admin access denied: Not an admin')
      throw new ForbiddenError('Admin access required')
    }

    fastify.log.info({
      userId: request.user.id
    }, 'Admin access granted')
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

  // List all users
  fastify.get('/users', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Get all users (admin only)',
      summary: 'List users',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          users: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            email: z.string().nullable(),
            role: z.enum(['admin', 'member', 'guest']),
            walletAddress: z.string().nullable(),
            createdAt: z.string().datetime(),
            lastLoginAt: z.string().datetime().nullable(),
          }))
        })
      }
    }
  }, async (_request) => {
    const allUsers = await fastify.db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      columns: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        walletAddress: true,
        createdAt: true,
        lastLoginAt: true,
      }
    })

    return {
      users: allUsers.map(user => ({
        id: user.id,
        name: user.displayName || user.email || user.walletAddress || 'Unknown User',
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }))
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

  // Test MinIO connection
  fastify.get('/test-minio', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Test MinIO connection and configuration',
      summary: 'Test MinIO',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
    }
  }, async (_request) => {
    try {
      const { minioStorageService } = await import('../services/minio.service')

      const testResult: any = {
        isAvailable: minioStorageService.isAvailable(),
        envVars: {
          MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
          MINIO_PORT: process.env.MINIO_PORT,
          MINIO_USE_SSL: process.env.MINIO_USE_SSL,
          MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ? 'SET (hidden)' : 'NOT SET',
          MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ? 'SET (hidden)' : 'NOT SET',
          MINIO_PUBLIC_HOST: process.env.MINIO_PUBLIC_HOST,
        }
      }

      if (minioStorageService.isAvailable()) {
        try {
          // Try to list a single file from the assets bucket
          testResult.testListAssets = await minioStorageService.listFiles('assets')
          testResult.assetsCount = testResult.testListAssets.length
        } catch (err: any) {
          testResult.listError = err.message
          testResult.listErrorStack = err.stack
        }
      }

      return testResult
    } catch (error: any) {
      return {
        error: error.message,
        stack: error.stack
      }
    }
  })

  // List MinIO buckets and files
  fastify.get('/minio-buckets', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'List all MinIO buckets and their contents (admin only)',
      summary: 'List MinIO buckets',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          success: z.boolean(),
          buckets: z.array(z.object({
            name: z.string(),
            fileCount: z.number(),
            files: z.array(z.string()),
          }))
        })
      }
    }
  }, async (_request) => {
    try {
      const { minioStorageService } = await import('../services/minio.service')

      if (!minioStorageService.isAvailable()) {
        return {
          success: false,
          buckets: []
        }
      }

      // Try all possible bucket names
      const possibleBuckets = [
        'assets', 'uploads', 'audio', '3d-models', 'images',
        'forge-assets', 'hyperscape-assets', 'game-assets',
      ]

      const buckets: Array<{ name: string; fileCount: number; files: string[] }> = []

      for (const bucketName of possibleBuckets) {
        try {
          const files = await minioStorageService.listFiles(bucketName)
          if (files.length > 0 || true) { // Include even empty buckets
            buckets.push({
              name: bucketName,
              fileCount: files.length,
              files: files.slice(0, 10), // First 10 files as preview
            })
          }
        } catch (error) {
          // Bucket doesn't exist or can't be accessed
          fastify.log.debug(`Bucket ${bucketName} not accessible`)
        }
      }

      return {
        success: true,
        buckets
      }
    } catch (error: any) {
      fastify.log.error('Failed to list MinIO buckets:', error)
      return {
        success: false,
        buckets: []
      }
    }
  })

  // Sync MinIO assets to database
  fastify.post('/sync-minio-assets', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Sync assets from MinIO buckets to database (admin only)',
      summary: 'Sync MinIO to DB',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          created: z.number(),
          skipped: z.number(),
          total: z.number(),
        })
      }
    }
  }, async (request) => {
    const debugInfo: string[] = []

    try {
      debugInfo.push('🔄 Admin triggered MinIO to DB sync')
      fastify.log.info('🔄 Admin triggered MinIO to DB sync')

      const { minioStorageService } = await import('../services/minio.service')

      const isAvailable = minioStorageService.isAvailable()
      debugInfo.push(`MinIO available: ${isAvailable}`)

      if (!isAvailable) {
        const envVars = {
          MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'NOT SET',
          MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ? 'SET' : 'NOT SET',
          MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ? 'SET' : 'NOT SET',
          MINIO_PORT: process.env.MINIO_PORT || 'NOT SET',
        }
        debugInfo.push(`Env vars: ${JSON.stringify(envVars)}`)

        return {
          success: false,
          message: `MinIO service not available. Debug: ${debugInfo.join('; ')}`,
          created: 0,
          skipped: 0,
          total: 0,
        }
      }

      const MINIO_PUBLIC_HOST = process.env.MINIO_PUBLIC_HOST || 'bucket-staging-4c7a.up.railway.app'
      debugInfo.push(`Public host: ${MINIO_PUBLIC_HOST}`)

      // Scan all MinIO buckets
      const buckets = ['assets', 'uploads', 'audio', '3d-models', 'images']
      debugInfo.push(`Scanning buckets: ${buckets.join(', ')}`)

      let created = 0
      let skipped = 0
      let totalFiles = 0

      for (const bucket of buckets) {
        try {
          debugInfo.push(`Listing files in bucket: ${bucket}`)
          const files = await minioStorageService.listFiles(bucket)
          totalFiles += files.length

          debugInfo.push(`Found ${files.length} files in bucket: ${bucket}`)
          fastify.log.info(`Found ${files.length} files in bucket: ${bucket}`)

          for (const filename of files) {
            // Check if asset with this MinIO key already exists
            const existing = await fastify.db.query.assets.findFirst({
              where: sql`${assets.metadata}->>'minioKey' = ${filename}`,
              columns: { id: true }
            })

            if (existing) {
              skipped++
              continue
            }

            // Determine type from extension
            const ext = filename.split('.').pop()?.toLowerCase()
            let type: 'model' | 'texture' | 'audio' | null = null
            if (['glb', 'gltf', 'obj', 'fbx'].includes(ext || '')) type = 'model'
            else if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) type = 'texture'
            else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) type = 'audio'

            if (!type) {
              fastify.log.debug(`Skipping unsupported file type: ${filename}`)
              skipped++
              continue
            }

            const name = filename.split('/').pop() || filename
            const fileUrl = `https://${MINIO_PUBLIC_HOST}/${bucket}/${filename}`

            const mimeTypes: Record<string, string> = {
              glb: 'model/gltf-binary',
              gltf: 'model/gltf+json',
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              mp3: 'audio/mpeg',
              wav: 'audio/wav',
              ogg: 'audio/ogg',
            }

            // Get file stats for size
            let fileSize = 0
            try {
              const stats = await minioStorageService.getFileStats(bucket, filename)
              fileSize = stats.size
            } catch (err) {
              fastify.log.warn(`Could not get file size for ${filename}`)
            }

            await fastify.db.insert(assets).values({
              name: name.replace(/\.[^/.]+$/, ''),
              description: `Synced from MinIO: ${bucket}/${filename}`,
              type,
              status: 'published',
              visibility: 'public',
              fileUrl,
              thumbnailUrl: type === 'texture' ? fileUrl : null,
              fileSize,
              mimeType: mimeTypes[ext || ''] || 'application/octet-stream',
              metadata: {
                minioKey: filename,
                minioBucket: bucket,
                storageMode: 'minio',
                syncedAt: new Date().toISOString(),
              },
              ownerId: request.user!.id,
            })

            created++
            fastify.log.info(`Created asset: ${name} (${bucket})`)
          }
        } catch (bucketError: any) {
          debugInfo.push(`Bucket error for ${bucket}: ${bucketError.message}`)
          fastify.log.warn(`Failed to process bucket ${bucket}:`, bucketError.message)
        }
      }

      const message = `Synced ${created} new assets, skipped ${skipped} existing from ${totalFiles} total files. Debug: ${debugInfo.join('; ')}`
      fastify.log.info(`✅ Sync complete`)

      return {
        success: true,
        message,
        created,
        skipped,
        total: totalFiles,
      }
    } catch (error: any) {
      debugInfo.push(`Fatal error: ${error.message}`)
      fastify.log.error('Failed to sync MinIO assets:', error)
      return {
        success: false,
        message: `${error.message || 'Failed to sync MinIO assets'}. Debug: ${debugInfo.join('; ')}`,
        created: 0,
        skipped: 0,
        total: 0,
      }
    }
  })

  // One-time Qdrant setup endpoint
  fastify.post('/setup-qdrant', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      description: 'Initialize Qdrant collections and embed manifest data (run once)',
      summary: 'Setup Qdrant',
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          collections: z.number(),
          itemsEmbedded: z.number(),
        })
      }
    }
  }, async (_request) => {
    try {
      fastify.log.info('🔵 Admin triggered Qdrant setup')

      const { qdrantService } = await import('../services/qdrant.service')
      const { db } = await import('../database/db')
      const { previewManifests } = await import('../database/schema')
      const { isNull } = await import('drizzle-orm')
      const { ContentEmbedderService } = await import('../services/content-embedder.service')
      const { CONTENT_TYPES } = await import('../services/qdrant.service')

      const contentEmbedder = new ContentEmbedderService()

      // Initialize Qdrant collections
      fastify.log.info('Initializing Qdrant collections...')
      await qdrantService.initializeCollections()

      const stats = await qdrantService.getAllStats()
      const collectionCount = Object.keys(stats).length
      fastify.log.info(`Created ${collectionCount} collections`)

      // Load and embed manifests
      fastify.log.info('Loading manifests from database...')
      const manifests = await db.query.previewManifests.findMany({
        where: isNull(previewManifests.userId),
      })

      fastify.log.info(`Found ${manifests.length} manifests to embed`)

      let totalEmbedded = 0

      for (const manifest of manifests) {
        const manifestType = manifest.manifestType
        const items = Array.isArray(manifest.content) ? manifest.content : [manifest.content]

        if (items.length === 0) continue

        // Map manifest types to content types
        const typeMap: Record<string, string> = {
          items: 'ITEM',
          npcs: 'NPC',
          music: 'MANIFEST',
          biomes: 'MANIFEST',
          zones: 'MANIFEST',
          world: 'MANIFEST',
          banks: 'MANIFEST',
          stores: 'MANIFEST',
          avatars: 'CHARACTER',
          asset_requirements: 'MANIFEST',
          generation_configs: 'MANIFEST',
          resources: 'ITEM',
          buildings: 'MANIFEST',
        }

        const contentType = typeMap[manifestType]
        if (!contentType) continue

        const batchItems = items.map((item: any, index: number) => ({
          id: item.id || item.name || `${manifestType}_${index}`,
          data: item,
          metadata: {
            manifestType,
            name: item.name,
            type: item.type || item.category,
            id: item.id,
          },
        }))

        await contentEmbedder.embedBatch(
          (CONTENT_TYPES as any)[contentType],
          batchItems
        )

        totalEmbedded += items.length
        fastify.log.info(`Embedded ${items.length} ${manifestType} items`)
      }

      fastify.log.info(`✅ Qdrant setup complete: ${collectionCount} collections, ${totalEmbedded} items embedded`)

      return {
        success: true,
        message: 'Qdrant setup complete',
        collections: collectionCount,
        itemsEmbedded: totalEmbedded,
      }
    } catch (error: any) {
      fastify.log.error('Failed to setup Qdrant:', error)
      // Return error response with 200 status but success: false
      // This matches the schema better than throwing
      return {
        success: false,
        message: error.message || 'Failed to setup Qdrant',
        collections: 0,
        itemsEmbedded: 0,
      }
    }
  })
}

export default adminRoutes
