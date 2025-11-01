import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { soundEffects } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { minioStorageService } from '../services/minio.service'
import { audioProcessorService } from '../services/audio-processor.service'
import { SoundEffectsService } from '../services/sound-effects.service'
import { serializeAllTimestamps } from '../helpers/serialization'

const soundEffectsRoutes: FastifyPluginAsync = async (fastify) => {
  // List sound effects
  fastify.get('/', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'List sound effects with optional filters',
      tags: ['sfx'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        category: z.string().optional(),
        subcategory: z.string().optional(),
        projectId: z.string().uuid().optional(),
        status: z.enum(['draft', 'processing', 'published', 'failed']).optional(),
      }),
      response: {
        200: z.object({
          sfx: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string().nullable(),
            subcategory: z.string().nullable(),
            duration: z.number().nullable(),
            status: z.string(),
            audioUrl: z.string().nullable(),
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
    const { page, limit, category, subcategory, projectId, status } = request.query as {
      page: number
      limit: number
      category?: string
      subcategory?: string
      projectId?: string
      status?: 'draft' | 'processing' | 'published' | 'failed'
    }
    const offset = (page - 1) * limit

    const conditions = []

    // Access control
    if (!request.user) {
      conditions.push(eq(soundEffects.status, 'published'))
    } else {
      conditions.push(
        or(
          eq(soundEffects.ownerId, request.user.id),
          eq(soundEffects.status, 'published')
        )
      )
    }

    if (category) conditions.push(eq(soundEffects.category, category))
    if (subcategory) conditions.push(eq(soundEffects.subcategory, subcategory))
    if (projectId) conditions.push(eq(soundEffects.projectId, projectId))
    if (status) conditions.push(eq(soundEffects.status, status))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const sfx = await fastify.db.query.soundEffects.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(soundEffects.createdAt)],
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(soundEffects)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      sfx: sfx.map(s => serializeAllTimestamps(s)),
      pagination: { page, limit, total }
    }
  })

  // Get single sound effect
  fastify.get('/:id', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Get sound effect by ID',
      tags: ['sfx'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            audioUrl: z.string().nullable(),
            duration: z.number().nullable(),
            fileSize: z.number().nullable(),
            format: z.string().nullable(),
            category: z.string().nullable(),
            subcategory: z.string().nullable(),
            volume: z.number().nullable(),
            priority: z.number().nullable(),
            generationType: z.string().nullable(),
            generationPrompt: z.string().nullable(),
            variationGroup: z.string().nullable(),
            variationIndex: z.number().nullable(),
            triggers: z.array(z.string()),
            spatialAudio: z.boolean(),
            minDistance: z.number().nullable(),
            maxDistance: z.number().nullable(),
            tags: z.array(z.string()),
            metadata: z.record(z.string(), z.any()),
            status: z.string(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
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

    const sfx = await fastify.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      }
    })

    if (!sfx) {
      throw new NotFoundError('Sound effect not found')
    }

    // Check access
    if (sfx.status !== 'published') {
      if (!request.user || sfx.ownerId !== request.user.id) {
        throw new ForbiddenError('Access denied')
      }
    }

    return { sfx: serializeAllTimestamps(sfx) }
  })

  // Create sound effect
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create new sound effect',
      tags: ['sfx'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        category: z.string().max(100).optional(),
        subcategory: z.string().max(100).optional(),
        volume: z.number().int().min(0).max(100).optional(),
        priority: z.number().int().min(1).max(10).optional(),
        triggers: z.array(z.string()).default([]).optional(),
        spatialAudio: z.boolean().default(false).optional(),
        minDistance: z.number().int().optional(),
        maxDistance: z.number().int().optional(),
        tags: z.array(z.string()).default([]).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        201: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            name: z.string(),
            status: z.string(),
            createdAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      description?: string
      projectId?: string
      category?: string
      subcategory?: string
      volume?: number
      priority?: number
      triggers?: string[]
      spatialAudio?: boolean
      minDistance?: number
      maxDistance?: number
      tags?: string[]
      metadata?: Record<string, any>
    }

    const [sfx] = await fastify.db.insert(soundEffects).values({
      ...data,
      ownerId: request.user!.id,
      status: 'draft',
      triggers: data.triggers || [],
      tags: data.tags || [],
      metadata: data.metadata || {},
    }).returning()

    reply.code(201).send({ sfx: serializeAllTimestamps(sfx!) })
  })

  // Update sound effect
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update sound effect (owner only)',
      tags: ['sfx'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        category: z.string().max(100).optional(),
        subcategory: z.string().max(100).optional(),
        volume: z.number().int().min(0).max(100).optional(),
        priority: z.number().int().min(1).max(10).optional(),
        triggers: z.array(z.string()).optional(),
        spatialAudio: z.boolean().optional(),
        minDistance: z.number().int().optional(),
        maxDistance: z.number().int().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        200: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            name: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as Record<string, any>

    const sfx = await fastify.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, id)
    })

    if (!sfx) {
      throw new NotFoundError('Sound effect not found')
    }

    if (sfx.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can update this sound effect')
    }

    const [updatedSfx] = await fastify.db
      .update(soundEffects)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(soundEffects.id, id))
      .returning()

    return { sfx: serializeAllTimestamps(updatedSfx!) }
  })

  // Upload sound effect file
  fastify.post('/:id/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Upload sound effect file',
      tags: ['sfx'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            audioUrl: z.string(),
            fileSize: z.number(),
            format: z.string(),
            status: z.string(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const sfx = await fastify.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, id)
    })

    if (!sfx) {
      throw new NotFoundError('Sound effect not found')
    }

    if (sfx.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can upload files')
    }

    const data = await request.file()

    if (!data) {
      throw new ValidationError('No file uploaded')
    }

    if (!minioStorageService.validateFileType(data.mimetype, ['audio', 'mp3', 'wav', 'ogg'])) {
      throw new ValidationError('Invalid file type for sound effect')
    }

    const maxSize = 20 * 1024 * 1024 // 20MB
    const buffer = await data.toBuffer()

    if (!minioStorageService.validateFileSize(buffer.length, maxSize)) {
      throw new ValidationError('File too large (max 20MB)')
    }

    if (sfx.audioUrl) {
      await minioStorageService.deleteFile(sfx.audioUrl)
    }

    // Save to local storage
    const fileData = await minioStorageService.saveFile(
      buffer,
      data.mimetype,
      data.filename
    )

    // Try to upload to file server (optional)
    let uploadResult: { url: string } | null = null
    try {
      uploadResult = await minioStorageService.uploadFile({
        buffer,
        filename: data.filename,
        mimeType: data.mimetype
      })
    } catch (uploadError) {
      fastify.log.warn({ error: uploadError }, '[SFX] File server upload failed, using local storage only')
    }

    const metadata = await audioProcessorService.extractMetadata(buffer)

    const [updatedSfx] = await fastify.db
      .update(soundEffects)
      .set({
        audioUrl: uploadResult?.url || fileData.url,
        fileSize: buffer.length,
        format: data.filename.split('.').pop() || 'mp3',
        duration: metadata.duration * 1000, // Convert to milliseconds
        generationType: 'upload',
        status: 'published',
        updatedAt: new Date(),
        metadata: {
          localPath: fileData.path,
          localUrl: fileData.url,
          remoteUrl: uploadResult?.url || null,
          storageMode: uploadResult ? 'dual' : 'local-only',
        }
      })
      .where(eq(soundEffects.id, id))
      .returning()

    return { sfx: serializeAllTimestamps(updatedSfx!) }
  })

  // Generate AI sound effect
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate sound effect using AI',
      tags: ['sfx'],
      body: z.object({
        name: z.string().min(1).max(255),
        prompt: z.string().min(1),
        projectId: z.string().uuid().optional(),
        category: z.string().max(100).optional(),
        subcategory: z.string().max(100).optional(),
        duration: z.number().int().min(1).optional(),
      }),
      response: {
        201: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            name: z.string(),
            status: z.string(),
            generationPrompt: z.string().nullable(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      prompt: string
      projectId?: string
      category?: string
      subcategory?: string
      duration?: number
    }

    try {
      // Generate SFX using ElevenLabs Sound Effects API
      const sfxService = new SoundEffectsService()

      if (!sfxService.isAvailable()) {
        throw new ValidationError('Sound effects service not available - API key not configured')
      }

      fastify.log.info({ name: data.name, prompt: data.prompt }, '[SFX] Generating sound effect with ElevenLabs')

      const audioBuffer = await sfxService.generateSoundEffect({
        text: data.prompt,
        durationSeconds: data.duration || null,
        promptInfluence: 0.3,
      })

      // Save to local storage
      const localFile = await minioStorageService.saveFile(
        audioBuffer,
        'audio/mpeg',
        `sfx-${Date.now()}.mp3`
      )

      // Try to upload to file server (optional)
      let uploadResult: { url: string } | null = null
      try {
        uploadResult = await minioStorageService.uploadFile({
          buffer: audioBuffer,
          filename: `sfx-${Date.now()}.mp3`,
          mimeType: 'audio/mpeg'
        })
      } catch (uploadError) {
        fastify.log.warn({ error: uploadError }, '[SFX] File server upload failed, using local storage only')
      }

      // Extract metadata
      const metadata = await audioProcessorService.extractMetadata(audioBuffer)

      // Create SFX with complete data
      const [sfx] = await fastify.db.insert(soundEffects).values({
        name: data.name,
        ownerId: request.user!.id,
        projectId: data.projectId,
        category: data.category,
        subcategory: data.subcategory,
        generationType: 'ai',
        generationPrompt: data.prompt,
        generationService: 'elevenlabs',
        generationParams: data,
        audioUrl: uploadResult?.url || localFile.url,
        fileSize: audioBuffer.length,
        format: 'mp3',
        duration: metadata.duration * 1000, // Convert to milliseconds
        status: 'published',
        triggers: [],
        tags: [],
        metadata: {
          localPath: localFile.path,
          localUrl: localFile.url,
          remoteUrl: uploadResult?.url || null,
          storageMode: uploadResult ? 'dual' : 'local-only',
        },
      }).returning()

      if (!sfx) {
        throw new Error('Failed to create sound effect')
      }

      fastify.log.info({ sfxId: sfx.id, size: audioBuffer.length }, '[SFX] Sound effect generated successfully')

      reply.code(201).send({ sfx: serializeAllTimestamps(sfx) })
    } catch (error) {
      fastify.log.error({ error, name: data.name }, '[SFX] Sound effect generation failed')

      // Create SFX in failed state
      const [sfx] = await fastify.db.insert(soundEffects).values({
        name: data.name,
        ownerId: request.user!.id,
        projectId: data.projectId,
        category: data.category,
        subcategory: data.subcategory,
        generationType: 'ai',
        generationPrompt: data.prompt,
        generationService: 'elevenlabs',
        generationParams: data,
        status: 'failed',
        triggers: [],
        tags: [],
        metadata: { error: (error as Error).message },
      }).returning()

      reply.code(201).send({ sfx: serializeAllTimestamps(sfx!) })
    }
  })

  // Get variations of a sound effect
  fastify.get('/variations/:groupId', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Get all variations of a sound effect group',
      tags: ['sfx'],
      params: z.object({
        groupId: z.string().uuid()
      }),
      response: {
        200: z.object({
          variations: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            variationIndex: z.number().nullable(),
            audioUrl: z.string().nullable(),
            createdAt: z.string().datetime(),
          }))
        })
      }
    }
  }, async (request) => {
    const { groupId } = request.params as { groupId: string }

    const variations = await fastify.db.query.soundEffects.findMany({
      where: eq(soundEffects.variationGroup, groupId),
      orderBy: [desc(soundEffects.variationIndex)],
    })

    return {
      variations: variations.map(v => serializeAllTimestamps(v))
    }
  })

  // Duplicate sound effect as variation
  fastify.post('/:id/duplicate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a variation of a sound effect',
      tags: ['sfx'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
      }),
      response: {
        201: z.object({
          sfx: z.object({
            id: z.string().uuid(),
            name: z.string(),
            variationGroup: z.string().nullable(),
            variationIndex: z.number().nullable(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name } = request.body as { name?: string }

    const original = await fastify.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, id)
    })

    if (!original) {
      throw new NotFoundError('Sound effect not found')
    }

    if (original.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can duplicate this sound effect')
    }

    // Count existing variations
    const existingVariations = await fastify.db.query.soundEffects.findMany({
      where: eq(soundEffects.variationGroup, id),
    })

    const variationIndex = existingVariations.length + 1

    const [duplicate] = await fastify.db.insert(soundEffects).values({
      ...original,
      id: undefined as any, // Let DB generate new ID
      name: name || `${original.name} (Variation ${variationIndex})`,
      variationGroup: id,
      variationIndex,
      audioUrl: null, // Don't copy file, user will upload new one
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()

    reply.code(201).send({ sfx: serializeAllTimestamps(duplicate!) })
  })

  // Delete sound effect
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete sound effect (owner only)',
      tags: ['sfx'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const sfx = await fastify.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, id)
    })

    if (!sfx) {
      throw new NotFoundError('Sound effect not found')
    }

    if (sfx.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner or admin can delete this sound effect')
    }

    if (sfx.audioUrl) {
      await minioStorageService.deleteFile(sfx.audioUrl)
    }

    await fastify.db.delete(soundEffects).where(eq(soundEffects.id, id))

    reply.code(204).send()
  })
}

export default soundEffectsRoutes
