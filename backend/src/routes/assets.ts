import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { assets } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { fileStorageService } from '../services/file.service'
import { fileServerClient } from '../services/file-server-client.service'
import { processImageGeneration } from '../services/image-generation.processor'

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
        type: z.enum(['model', 'texture', 'audio']).optional(),
        status: z.enum(['draft', 'processing', 'published', 'failed']).optional(),
        ownerId: z.string().uuid().optional(),
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
      type?: 'model' | 'texture' | 'audio'
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
      assets: assetsList.map(asset => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
      })),
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
            type: z.enum(['model', 'texture', 'audio']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            visibility: z.enum(['private', 'public']),
            fileUrl: z.string().nullable(),
            fileSize: z.number().nullable(),
            mimeType: z.string().nullable(),
            metadata: z.record(z.string(), z.any()),
            tags: z.array(z.string()).default([]),
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

    return { asset }
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
        type: z.enum(['model', 'texture', 'audio']),
        visibility: z.enum(['private', 'public']).default('private'),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).default([]).optional(),
      }),
      response: {
        201: z.object({
          asset: z.object({
            id: z.string().uuid(),
            name: z.string(),
            type: z.enum(['model', 'texture', 'audio']),
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
      type: 'model' | 'texture' | 'audio'
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

    if (!fileStorageService.validateFileSize(buffer.length, maxSize)) {
      throw new ValidationError('File too large (max 50MB)')
    }

    if (asset.fileUrl) {
      await fileStorageService.deleteFile(asset.fileUrl)
    }

    // Save to local storage
    const fileData = await fileStorageService.saveFile(
      buffer,
      data.mimetype,
      data.filename
    )

    // Try to upload to file server (optional)
    let uploadResult: { url: string } | null = null
    try {
      uploadResult = await fileServerClient.uploadFile({
        buffer,
        filename: data.filename,
        mimeType: data.mimetype
      })
    } catch (uploadError) {
      fastify.log.warn({ error: uploadError }, '[Assets] File server upload failed, using local storage only')
    }

    const [updatedAsset] = await fastify.db
      .update(assets)
      .set({
        fileUrl: uploadResult?.url || fileData.url,
        fileSize: buffer.length,
        mimeType: data.mimetype,
        status: 'published',
        updatedAt: new Date(),
        publishedAt: new Date(),
        metadata: {
          localPath: fileData.path,
          localUrl: fileData.url,
          remoteUrl: uploadResult?.url || null,
          storageMode: uploadResult ? 'dual' : 'local-only',
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

    if (asset.fileUrl) {
      await fileStorageService.deleteFile(asset.fileUrl)
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
      type: 'texture',
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
