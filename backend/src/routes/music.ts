import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { musicTracks } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { minioStorageService } from '../services/minio.service'
import { audioProcessorService } from '../services/audio-processor.service'
import { MusicService } from '../services/music.service'
import { serializeAllTimestamps } from '../helpers/serialization'

const musicRoutes: FastifyPluginAsync = async (fastify) => {
  // List music tracks
  fastify.get('/', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'List music tracks with optional filters',
      tags: ['music'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        genre: z.string().optional(),
        mood: z.string().optional(),
        bpm: z.coerce.number().int().min(20).max(300).optional(),
        key: z.string().optional(),
        projectId: z.string().uuid().optional(),
        status: z.enum(['draft', 'processing', 'published', 'failed']).optional(),
      }),
      response: {
        200: z.object({
          tracks: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            genre: z.string().nullable(),
            mood: z.string().nullable(),
            bpm: z.number().nullable(),
            key: z.string().nullable(),
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
    const { page, limit, genre, mood, bpm, key, projectId, status } = request.query as {
      page: number
      limit: number
      genre?: string
      mood?: string
      bpm?: number
      key?: string
      projectId?: string
      status?: 'draft' | 'processing' | 'published' | 'failed'
    }
    const offset = (page - 1) * limit

    const conditions = []

    // Access control
    if (!request.user) {
      conditions.push(eq(musicTracks.status, 'published'))
    } else {
      conditions.push(
        or(
          eq(musicTracks.ownerId, request.user.id),
          eq(musicTracks.status, 'published')
        )
      )
    }

    if (genre) conditions.push(eq(musicTracks.genre, genre))
    if (mood) conditions.push(eq(musicTracks.mood, mood))
    if (bpm) conditions.push(eq(musicTracks.bpm, bpm))
    if (key) conditions.push(eq(musicTracks.key, key))
    if (projectId) conditions.push(eq(musicTracks.projectId, projectId))
    if (status) conditions.push(eq(musicTracks.status, status))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const tracks = await fastify.db.query.musicTracks.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(musicTracks.createdAt)],
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(musicTracks)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      tracks: tracks.map(track => serializeAllTimestamps(track)),
      pagination: { page, limit, total }
    }
  })

  // Get single music track
  fastify.get('/:id', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Get music track by ID',
      tags: ['music'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          track: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            audioUrl: z.string().nullable(),
            duration: z.number().nullable(),
            fileSize: z.number().nullable(),
            format: z.string().nullable(),
            bpm: z.number().nullable(),
            key: z.string().nullable(),
            genre: z.string().nullable(),
            mood: z.string().nullable(),
            instruments: z.array(z.string()),
            generationType: z.string().nullable(),
            generationPrompt: z.string().nullable(),
            usageContext: z.string().nullable(),
            loopable: z.boolean(),
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

    const track = await fastify.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      }
    })

    if (!track) {
      throw new NotFoundError('Music track not found')
    }

    // Check access
    if (track.status !== 'published') {
      if (!request.user || track.ownerId !== request.user.id) {
        throw new ForbiddenError('Access denied')
      }
    }

    return { track: serializeAllTimestamps(track) }
  })

  // Create music track
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create new music track',
      tags: ['music'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        genre: z.string().max(100).optional(),
        mood: z.string().max(100).optional(),
        bpm: z.number().int().min(20).max(300).optional(),
        key: z.string().max(10).optional(),
        instruments: z.array(z.string()).default([]).optional(),
        usageContext: z.string().max(100).optional(),
        loopable: z.boolean().default(false).optional(),
        tags: z.array(z.string()).default([]).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        201: z.object({
          track: z.object({
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
      genre?: string
      mood?: string
      bpm?: number
      key?: string
      instruments?: string[]
      usageContext?: string
      loopable?: boolean
      tags?: string[]
      metadata?: Record<string, any>
    }

    const [track] = await fastify.db.insert(musicTracks).values({
      ...data,
      ownerId: request.user!.id,
      status: 'draft',
      instruments: data.instruments || [],
      tags: data.tags || [],
      metadata: data.metadata || {},
    }).returning()

    reply.code(201).send({ track: serializeAllTimestamps(track!) })
  })

  // Update music track
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update music track (owner only)',
      tags: ['music'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        genre: z.string().max(100).optional(),
        mood: z.string().max(100).optional(),
        bpm: z.number().int().min(20).max(300).optional(),
        key: z.string().max(10).optional(),
        instruments: z.array(z.string()).optional(),
        usageContext: z.string().max(100).optional(),
        loopable: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        200: z.object({
          track: z.object({
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

    const track = await fastify.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, id)
    })

    if (!track) {
      throw new NotFoundError('Music track not found')
    }

    if (track.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can update this track')
    }

    const [updatedTrack] = await fastify.db
      .update(musicTracks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(musicTracks.id, id))
      .returning()

    return { track: serializeAllTimestamps(updatedTrack!) }
  })

  // Upload music file
  fastify.post('/:id/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Upload music file to track',
      tags: ['music'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          track: z.object({
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

    const track = await fastify.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, id)
    })

    if (!track) {
      throw new NotFoundError('Music track not found')
    }

    if (track.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can upload files')
    }

    const data = await request.file()

    if (!data) {
      throw new ValidationError('No file uploaded')
    }

    if (!minioStorageService.validateFileType(data.mimetype, ['audio', 'mp3', 'wav', 'ogg'])) {
      throw new ValidationError('Invalid file type for music')
    }

    const maxSize = 100 * 1024 * 1024 // 100MB
    const buffer = await data.toBuffer()

    if (!minioStorageService.validateFileSize(buffer.length, maxSize)) {
      throw new ValidationError('File too large (max 100MB)')
    }

    // Delete old file if exists
    if (track.audioUrl) {
      const metadata = track.metadata as Record<string, any>
      if (metadata?.minioPath) {
        await minioStorageService.deleteFileByPath(metadata.minioPath)
      }
    }

    // Upload to MinIO
    const minioData = await minioStorageService.uploadFile(
      buffer,
      data.mimetype,
      data.filename
    )

    // Extract metadata
    const metadata = await audioProcessorService.extractMetadata(buffer)

    const [updatedTrack] = await fastify.db
      .update(musicTracks)
      .set({
        audioUrl: minioData.url,
        fileSize: buffer.length,
        format: data.filename.split('.').pop() || 'mp3',
        duration: metadata.duration,
        generationType: 'upload',
        status: 'published',
        updatedAt: new Date(),
        metadata: {
          minioBucket: minioData.bucket,
          minioPath: minioData.path,
          minioUrl: minioData.url,
          storageMode: 'minio',
        }
      })
      .where(eq(musicTracks.id, id))
      .returning()

    return { track: serializeAllTimestamps(updatedTrack!) }
  })

  // Generate AI music
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate music using AI',
      tags: ['music'],
      body: z.object({
        name: z.string().min(1).max(255),
        prompt: z.string().min(1),
        projectId: z.string().uuid().optional(),
        bpm: z.number().int().min(20).max(300).optional(),
        key: z.string().max(10).optional(),
        genre: z.string().max(100).optional(),
        mood: z.string().max(100).optional(),
        duration: z.number().int().min(1).optional(),
        instruments: z.array(z.string()).default([]).optional(),
      }),
      response: {
        201: z.object({
          track: z.object({
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
      bpm?: number
      key?: string
      genre?: string
      mood?: string
      duration?: number
      instruments?: string[]
    }

    try {
      // Generate music using ElevenLabs Music API
      const musicService = new MusicService()

      if (!musicService.isAvailable()) {
        throw new ValidationError('Music generation service not available - API key not configured')
      }

      fastify.log.info({ name: data.name, prompt: data.prompt }, '[Music] Generating music with ElevenLabs')

      const audioBuffer = await musicService.generateMusic({
        prompt: data.prompt,
        musicLengthMs: data.duration ? data.duration * 1000 : undefined,
        modelId: undefined,
        forceInstrumental: true,
        respectSectionsDurations: undefined,
        storeForInpainting: undefined,
        compositionPlan: undefined,
        outputFormat: undefined,
      })

      // Upload to MinIO
      const minioData = await minioStorageService.uploadFile(
        audioBuffer,
        'audio/mpeg',
        `music-${Date.now()}.mp3`
      )

      // Extract metadata
      const metadata = await audioProcessorService.extractMetadata(audioBuffer)

      // Create track with complete data
      const [track] = await fastify.db.insert(musicTracks).values({
        name: data.name,
        ownerId: request.user!.id,
        projectId: data.projectId,
        bpm: data.bpm,
        key: data.key,
        genre: data.genre,
        mood: data.mood,
        instruments: data.instruments || [],
        generationType: 'ai',
        generationPrompt: data.prompt,
        generationService: 'elevenlabs',
        generationParams: data,
        audioUrl: minioData.url,
        fileSize: audioBuffer.length,
        format: 'mp3',
        duration: metadata.duration,
        status: 'published',
        tags: [],
        metadata: {
          minioBucket: minioData.bucket,
          minioPath: minioData.path,
          minioUrl: minioData.url,
          storageMode: 'minio',
        },
      }).returning()

      if (!track) {
        throw new Error('Failed to create music track')
      }

      fastify.log.info({ trackId: track.id, size: audioBuffer.length }, '[Music] Music generated successfully')

      reply.code(201).send({ track: serializeAllTimestamps(track) })
    } catch (error) {
      fastify.log.error({ error, name: data.name }, '[Music] Music generation failed')

      // Create track in failed state
      const [track] = await fastify.db.insert(musicTracks).values({
        name: data.name,
        ownerId: request.user!.id,
        projectId: data.projectId,
        bpm: data.bpm,
        key: data.key,
        genre: data.genre,
        mood: data.mood,
        instruments: data.instruments || [],
        generationType: 'ai',
        generationPrompt: data.prompt,
        generationService: 'elevenlabs',
        generationParams: data,
        status: 'failed',
        tags: [],
        metadata: { error: (error as Error).message },
      }).returning()

      reply.code(201).send({ track: serializeAllTimestamps(track!) })
    }
  })

  // Download music file
  fastify.get('/download/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Download music file',
      tags: ['music'],
      params: z.object({
        id: z.string().uuid()
      }),
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const track = await fastify.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, id)
    })

    if (!track) {
      throw new NotFoundError('Music track not found')
    }

    if (!track.audioUrl) {
      throw new NotFoundError('No audio file available')
    }

    // Check access
    if (track.status !== 'published' && track.ownerId !== request.user!.id) {
      throw new ForbiddenError('Access denied')
    }

    // Redirect to file URL
    reply.redirect(track.audioUrl)
  })

  // Delete music track
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete music track (owner only)',
      tags: ['music'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const track = await fastify.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, id)
    })

    if (!track) {
      throw new NotFoundError('Music track not found')
    }

    if (track.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner or admin can delete this track')
    }

    // Delete audio file from MinIO if exists
    if (track.audioUrl) {
      const metadata = track.metadata as Record<string, any>
      if (metadata?.minioPath) {
        await minioStorageService.deleteFileByPath(metadata.minioPath)
      }
    }

    await fastify.db.delete(musicTracks).where(eq(musicTracks.id, id))

    reply.code(204).send()
  })
}

export default musicRoutes
