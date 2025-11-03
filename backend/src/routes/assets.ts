import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { assets } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { fileStorageService } from '../services/file.service'
import { fileServerClient } from '../services/file-server-client.service'
import { minioStorageService } from '../services/minio.service'
import { processImageGeneration } from '../services/image-generation.processor'
import { imgproxyService } from '../services/imgproxy.service'
import { getImageVariants, getThumbnailUrl, getOptimizedUrl } from '../utils/image-url'

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  // List assets
  fastify.get('/', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'List assets with optional filters',
      tags: ['assets'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        type: z.enum(['model', 'texture', 'audio', 'image']).optional(),
        status: z.enum(['draft', 'processing', 'published', 'failed']).optional(),
        ownerId: z.string().uuid().optional(),
      }),
      response: {
        200: z.object({
          assets: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.enum(['model', 'texture', 'audio', 'image']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            visibility: z.enum(['private', 'public']),
            fileUrl: z.string().nullable(),
            thumbnailUrl: z.string().optional(),
            optimizedUrl: z.string().optional(),
            createdAt: z.string().datetime(),
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
    const { page, limit, type, status, ownerId } = request.query as {
      page: number
      limit: number
      type?: 'model' | 'texture' | 'audio' | 'image'
      status?: 'draft' | 'processing' | 'published' | 'failed'
      ownerId?: string
    }
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = []

    // Visibility filter (show only public assets if not authenticated)
    if (!request.user) {
      conditions.push(eq(assets.visibility, 'public'))
      conditions.push(eq(assets.status, 'published'))
    } else {
      // Authenticated users see their own assets + public assets
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

    if (type) conditions.push(eq(assets.type, type))
    if (status) conditions.push(eq(assets.status, status))
    if (ownerId) conditions.push(eq(assets.ownerId, ownerId))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const assetsList = await fastify.db.query.assets.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(assets.createdAt)],
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      assets: assetsList.map(asset => {
        const metadata = asset.metadata as Record<string, any>
        const imgproxyData = metadata?.imgproxy

        return {
          ...asset,
          createdAt: asset.createdAt.toISOString(),
          thumbnailUrl: imgproxyData?.thumbnailUrl,
          optimizedUrl: imgproxyData?.optimizedUrl,
        }
      }),
      pagination: { page, limit, total }
    }
  })

  // Get single asset
  fastify.get('/:id', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Get asset by ID',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          asset: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.enum(['model', 'texture', 'audio', 'image']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            visibility: z.enum(['private', 'public']),
            fileUrl: z.string().nullable(),
            fileSize: z.number().nullable(),
            mimeType: z.string().nullable(),
            metadata: z.record(z.string(), z.any()),
            tags: z.array(z.string()).default([]),
            thumbnailUrl: z.string().optional(),
            optimizedUrl: z.string().optional(),
            variants: z.object({
              small: z.string(),
              medium: z.string(),
              large: z.string(),
              webp: z.string().optional(),
              avif: z.string().optional(),
            }).optional(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            owner: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              avatarUrl: z.string().url().nullable(),
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
            avatarUrl: true,
          }
        }
      }
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    // Check visibility
    if (asset.visibility === 'private') {
      if (!request.user || asset.ownerId !== request.user.id) {
        throw new ForbiddenError('Access denied')
      }
    }

    // Add imgproxy data if available
    const metadata = asset.metadata as Record<string, any>
    const imgproxyData = metadata?.imgproxy

    return {
      asset: {
        ...asset,
        thumbnailUrl: imgproxyData?.thumbnailUrl,
        optimizedUrl: imgproxyData?.optimizedUrl,
        variants: imgproxyData?.variants,
      }
    }
  })

  // Create asset
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create new asset',
      tags: ['assets'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        type: z.enum(['model', 'texture', 'audio', 'image']),
        visibility: z.enum(['private', 'public']).default('private'),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).default([]).optional(),
      }),
      response: {
        201: z.object({
          asset: z.object({
            id: z.string().uuid(),
            name: z.string(),
            type: z.enum(['model', 'texture', 'audio', 'image']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            createdAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      description?: string
      type: 'model' | 'texture' | 'audio' | 'image'
      visibility?: 'private' | 'public'
      metadata?: Record<string, any>
      tags?: string[]
    }

    const [asset] = await fastify.db.insert(assets).values({
      ...data,
      ownerId: request.user!.id,
      status: 'draft',
      metadata: data.metadata || {},
      tags: data.tags || [],
    }).returning()

    reply.code(201).send({ asset })
  })

  // Update asset
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update asset (owner only)',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        visibility: z.enum(['private', 'public']).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).default([]).optional(),
      }),
      response: {
        200: z.object({
          asset: z.object({
            id: z.string().uuid(),
            name: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      description?: string
      visibility?: 'private' | 'public'
      metadata?: Record<string, any>
      tags?: string[]
    }

    // Check ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, id)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can update this asset')
    }

    const [updatedAsset] = await fastify.db
      .update(assets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
      .returning()

    return { asset: updatedAsset }
  })

  // Upload file to asset
  fastify.post('/:id/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Upload file to asset',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          asset: z.object({
            id: z.string().uuid(),
            fileUrl: z.string(),
            fileSize: z.number(),
            mimeType: z.string(),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, id)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can upload files')
    }

    const data = await request.file()

    if (!data) {
      throw new ValidationError('No file uploaded')
    }

    const allowedTypes: Record<string, string[]> = {
      model: ['model', 'gltf', 'glb'],
      audio: ['audio', 'mp3', 'wav'],
      texture: ['image', 'png', 'jpg', 'jpeg'],
      image: ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif'],
    }

    const allowedFileTypes = allowedTypes[asset.type] || []

    if (!fileStorageService.validateFileType(
      data.mimetype,
      allowedFileTypes
    )) {
      throw new ValidationError(`Invalid file type for ${asset.type} asset`)
    }

    const maxSize = 50 * 1024 * 1024
    const buffer = await data.toBuffer()

    if (!minioStorageService.validateFileSize(buffer.length, maxSize)) {
      throw new ValidationError('File too large (max 50MB)')
    }

    // Delete old file if exists
    if (asset.fileUrl) {
      // Try to delete from MinIO first (if path looks like bucket/filename)
      if (asset.fileUrl.includes('/') && !asset.fileUrl.startsWith('http')) {
        try {
          await minioStorageService.deleteFileByPath(asset.fileUrl)
        } catch (error) {
          fastify.log.warn({ error }, 'Failed to delete old file from MinIO')
        }
      }
    }

    // Upload to MinIO (primary storage)
    let minioData: { path: string; url: string; filename: string; bucket: string } | null = null
    if (minioStorageService.isAvailable()) {
      try {
        minioData = await minioStorageService.uploadFile(
          buffer,
          data.mimetype,
          data.filename
        )
      } catch (minioError) {
        fastify.log.error({ error: minioError }, '[Assets] MinIO upload failed')
        throw new ValidationError('Failed to upload file to storage')
      }
    }

    // Fallback to local storage if MinIO not available
    let localFileData: { path: string; url: string; filename: string } | null = null
    if (!minioData) {
      localFileData = await fileStorageService.saveFile(
        buffer,
        data.mimetype,
        data.filename
      )
    }

    // Generate imgproxy URLs for image assets
    const isImage = data.mimetype.startsWith('image/')
    const sourceUrl = minioData?.url || localFileData?.url || ''
    const imgproxyMetadata: Record<string, any> = {}

    if (isImage && imgproxyService.isAvailable()) {
      const variants = getImageVariants(sourceUrl)
      if (variants) {
        imgproxyMetadata.imgproxy = {
          thumbnailUrl: variants.thumbnail,
          optimizedUrl: getOptimizedUrl(sourceUrl, data.mimetype) || sourceUrl,
          variants: {
            small: variants.small,
            medium: variants.medium,
            large: variants.large,
            webp: variants.webp,
            avif: variants.avif,
          },
        }
      }
    }

    const [updatedAsset] = await fastify.db
      .update(assets)
      .set({
        fileUrl: sourceUrl,
        fileSize: buffer.length,
        mimeType: data.mimetype,
        status: 'published',
        updatedAt: new Date(),
        publishedAt: new Date(),
        metadata: {
          ...(minioData && {
            minioBucket: minioData.bucket,
            minioPath: minioData.path,
            minioUrl: minioData.url,
          }),
          ...(localFileData && {
            localPath: localFileData.path,
            localUrl: localFileData.url,
          }),
          storageMode: minioData ? 'minio' : 'local',
          ...imgproxyMetadata,
        }
      })
      .where(eq(assets.id, id))
      .returning()

    return { asset: updatedAsset }
  })

  // Delete asset
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete asset (owner only)',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, id)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner or admin can delete this asset')
    }

    // Delete file from storage
    if (asset.fileUrl) {
      const metadata = asset.metadata as Record<string, any>

      // Delete from MinIO if stored there
      if (metadata?.minioBucket && metadata?.minioPath) {
        try {
          await minioStorageService.deleteFileByPath(metadata.minioPath)
        } catch (error) {
          fastify.log.warn({ error }, 'Failed to delete file from MinIO')
        }
      }

      // Delete from local storage if it exists
      if (metadata?.localPath) {
        try {
          await fileStorageService.deleteFile(metadata.localPath)
        } catch (error) {
          fastify.log.warn({ error }, 'Failed to delete local file')
        }
      }
    }

    await fastify.db.delete(assets).where(eq(assets.id, id))

    reply.code(204).send()
  })

  // Generate image with DALL-E (async)
  fastify.post('/generate-image', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate image with DALL-E (async)',
      tags: ['assets'],
      body: z.object({
        prompt: z.string().min(1).max(1000),
        name: z.string().min(1).max(255),
        size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
        quality: z.enum(['standard', 'hd']).default('standard'),
        style: z.enum(['vivid', 'natural']).default('vivid'),
      }),
      response: {
        202: z.object({
          taskId: z.string().uuid(),
          status: z.literal('processing'),
          statusUrl: z.string(),
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      prompt: string
      name: string
      size?: '1024x1024' | '1792x1024' | '1024x1792'
      quality?: 'standard' | 'hd'
      style?: 'vivid' | 'natural'
    }

    // Create asset immediately
    const [asset] = await fastify.db.insert(assets).values({
      name: data.name,
      description: `AI-generated image: ${data.prompt}`,
      type: 'image',
      status: 'processing',
      ownerId: request.user!.id,
      visibility: 'private',
      prompt: data.prompt,
      generationParams: {
        size: data.size,
        quality: data.quality,
        style: data.style,
      },
      metadata: {},
    }).returning()

    if (!asset) {
      throw new Error('Failed to create asset')
    }

    // Start async generation
    setImmediate(() => processImageGeneration(asset.id, data, fastify.db))

    reply.code(202).send({
      taskId: asset.id,
      status: 'processing',
      statusUrl: `/api/assets/${asset.id}/status`,
    })
  })

  // Status endpoint (for async generation)
  fastify.get('/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get asset generation status',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          taskId: z.string().uuid(),
          status: z.enum(['processing', 'completed', 'failed']),
          result: z.object({
            assetId: z.string().uuid(),
            fileUrl: z.string().nullable(),
          }).optional(),
          error: z.string().optional(),
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, id),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Access denied')
    }

    const metadata = asset.metadata as Record<string, any>
    return {
      taskId: asset.id,
      status: asset.status === 'published' ? 'completed' : asset.status,
      result: asset.status === 'published' ? {
        assetId: asset.id,
        fileUrl: asset.fileUrl || null,
      } : undefined,
      error: metadata?.error || undefined,
    }
  })
}

export default assetRoutes
