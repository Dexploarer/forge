import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { voiceProfiles, voiceGenerations } from '../database/schema'
import { NotFoundError, ForbiddenError } from '../utils/errors'
import { fileStorageService } from '../services/file.service'
import { serializeAllTimestamps } from '../helpers/serialization'
import { processVoiceGeneration } from '../services/voice-generation.processor'

const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================
  // VOICE PROFILES
  // ===========================================

  // List voice profiles
  fastify.get('/profiles', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'List voice profiles',
      tags: ['voice'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid().optional(),
        provider: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
      }),
      response: {
        200: z.object({
          profiles: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            gender: z.string().nullable(),
            age: z.string().nullable(),
            accent: z.string().nullable(),
            tone: z.string().nullable(),
            serviceProvider: z.string().nullable(),
            sampleAudioUrl: z.string().nullable(),
            isActive: z.boolean(),
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
    const { page, limit, projectId, provider, isActive } = request.query as {
      page: number
      limit: number
      projectId?: string
      provider?: string
      isActive?: boolean
    }
    const offset = (page - 1) * limit

    const conditions = []

    if (!request.user) {
      conditions.push(eq(voiceProfiles.isActive, true))
    } else {
      conditions.push(
        or(
          eq(voiceProfiles.ownerId, request.user.id),
          eq(voiceProfiles.isActive, true)
        )
      )
    }

    if (projectId) conditions.push(eq(voiceProfiles.projectId, projectId))
    if (provider) conditions.push(eq(voiceProfiles.serviceProvider, provider))
    if (isActive !== undefined) conditions.push(eq(voiceProfiles.isActive, isActive))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const profiles = await fastify.db.query.voiceProfiles.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(voiceProfiles.createdAt)],
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(voiceProfiles)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      profiles: profiles.map(p => serializeAllTimestamps(p)),
      pagination: { page, limit, total }
    }
  })

  // Get single voice profile
  fastify.get('/profiles/:id', {
    preHandler: [fastify.optionalAuth],
    schema: {
      description: 'Get voice profile by ID',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          profile: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            gender: z.string().nullable(),
            age: z.string().nullable(),
            accent: z.string().nullable(),
            tone: z.string().nullable(),
            serviceProvider: z.string().nullable(),
            serviceVoiceId: z.string().nullable(),
            serviceSettings: z.record(z.string(), z.any()),
            characterIds: z.array(z.string()),
            sampleAudioUrl: z.string().nullable(),
            tags: z.array(z.string()),
            metadata: z.record(z.string(), z.any()),
            isActive: z.boolean(),
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

    const profile = await fastify.db.query.voiceProfiles.findFirst({
      where: eq(voiceProfiles.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      }
    })

    if (!profile) {
      throw new NotFoundError('Voice profile not found')
    }

    if (!profile.isActive && (!request.user || profile.ownerId !== request.user.id)) {
      throw new ForbiddenError('Access denied')
    }

    return { profile: serializeAllTimestamps(profile) }
  })

  // Create voice profile
  fastify.post('/profiles', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create new voice profile',
      tags: ['voice'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        gender: z.enum(['male', 'female', 'neutral']).optional(),
        age: z.enum(['child', 'young', 'adult', 'elderly']).optional(),
        accent: z.string().max(100).optional(),
        tone: z.string().max(100).optional(),
        serviceProvider: z.enum(['elevenlabs', 'openai', 'azure']).optional(),
        serviceVoiceId: z.string().max(255).optional(),
        serviceSettings: z.record(z.string(), z.any()).optional(),
        characterIds: z.array(z.string()).default([]).optional(),
        tags: z.array(z.string()).default([]).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        201: z.object({
          profile: z.object({
            id: z.string().uuid(),
            name: z.string(),
            serviceProvider: z.string().nullable(),
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
      gender?: 'male' | 'female' | 'neutral'
      age?: 'child' | 'young' | 'adult' | 'elderly'
      accent?: string
      tone?: string
      serviceProvider?: 'elevenlabs' | 'openai' | 'azure'
      serviceVoiceId?: string
      serviceSettings?: Record<string, any>
      characterIds?: string[]
      tags?: string[]
      metadata?: Record<string, any>
    }

    const [profile] = await fastify.db.insert(voiceProfiles).values({
      ...data,
      ownerId: request.user!.id,
      serviceSettings: data.serviceSettings || {},
      characterIds: data.characterIds || [],
      tags: data.tags || [],
      metadata: data.metadata || {},
      isActive: true,
    }).returning()

    reply.code(201).send({ profile: serializeAllTimestamps(profile!) })
  })

  // Update voice profile
  fastify.patch('/profiles/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update voice profile (owner only)',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        gender: z.enum(['male', 'female', 'neutral']).optional(),
        age: z.enum(['child', 'young', 'adult', 'elderly']).optional(),
        accent: z.string().max(100).optional(),
        tone: z.string().max(100).optional(),
        serviceProvider: z.enum(['elevenlabs', 'openai', 'azure']).optional(),
        serviceVoiceId: z.string().max(255).optional(),
        serviceSettings: z.record(z.string(), z.any()).optional(),
        characterIds: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        isActive: z.boolean().optional(),
      }),
      response: {
        200: z.object({
          profile: z.object({
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

    const profile = await fastify.db.query.voiceProfiles.findFirst({
      where: eq(voiceProfiles.id, id)
    })

    if (!profile) {
      throw new NotFoundError('Voice profile not found')
    }

    if (profile.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can update this profile')
    }

    const [updatedProfile] = await fastify.db
      .update(voiceProfiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, id))
      .returning()

    return { profile: serializeAllTimestamps(updatedProfile!) }
  })

  // Test voice profile
  fastify.post('/profiles/:id/test', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Test voice profile with sample text',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        text: z.string().min(1).max(500).default('Hello, this is a test of the voice profile.'),
      }),
      response: {
        201: z.object({
          generation: z.object({
            id: z.string().uuid(),
            text: z.string(),
            status: z.string(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { text } = request.body as { text: string }

    const profile = await fastify.db.query.voiceProfiles.findFirst({
      where: eq(voiceProfiles.id, id)
    })

    if (!profile) {
      throw new NotFoundError('Voice profile not found')
    }

    if (profile.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can test this profile')
    }

    // Create a generation for the test
    const [generation] = await fastify.db.insert(voiceGenerations).values({
      text,
      voiceProfileId: id,
      projectId: profile.projectId,
      ownerId: request.user!.id,
      context: 'dialog',
      emotion: 'neutral',
      serviceProvider: profile.serviceProvider,
      status: 'processing',
      metadata: { isTest: true },
    }).returning()

    if (!generation) {
      throw new Error('Failed to create voice generation')
    }

    // Start async generation (DON'T await - use setImmediate)
    const generationData = {
      text,
      voiceProfileId: id,
      projectId: profile.projectId,
      context: 'dialog' as const,
      emotion: 'neutral' as const,
    }
    setImmediate(() => processVoiceGeneration(generation.id, generationData, profile, fastify.db))

    reply.code(201).send({ generation: serializeAllTimestamps(generation) })
  })

  // Delete voice profile
  fastify.delete('/profiles/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete voice profile (owner only)',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const profile = await fastify.db.query.voiceProfiles.findFirst({
      where: eq(voiceProfiles.id, id)
    })

    if (!profile) {
      throw new NotFoundError('Voice profile not found')
    }

    if (profile.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner or admin can delete this profile')
    }

    await fastify.db.delete(voiceProfiles).where(eq(voiceProfiles.id, id))

    reply.code(204).send()
  })

  // ===========================================
  // VOICE GENERATIONS
  // ===========================================

  // List voice generations
  fastify.get('/generations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List voice generations',
      tags: ['voice'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid().optional(),
        voiceProfileId: z.string().uuid().optional(),
        npcId: z.string().uuid().optional(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      }),
      response: {
        200: z.object({
          generations: z.array(z.object({
            id: z.string().uuid(),
            text: z.string(),
            voiceProfileId: z.string().uuid(),
            audioUrl: z.string().nullable(),
            duration: z.number().nullable(),
            context: z.string().nullable(),
            emotion: z.string().nullable(),
            status: z.string(),
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
    const { page, limit, projectId, voiceProfileId, npcId, status } = request.query as {
      page: number
      limit: number
      projectId?: string
      voiceProfileId?: string
      npcId?: string
      status?: 'pending' | 'processing' | 'completed' | 'failed'
    }
    const offset = (page - 1) * limit

    const conditions = [eq(voiceGenerations.ownerId, request.user!.id)]

    if (projectId) conditions.push(eq(voiceGenerations.projectId, projectId))
    if (voiceProfileId) conditions.push(eq(voiceGenerations.voiceProfileId, voiceProfileId))
    if (npcId) conditions.push(eq(voiceGenerations.npcId, npcId))
    if (status) conditions.push(eq(voiceGenerations.status, status))

    const whereClause = and(...conditions)

    const generations = await fastify.db.query.voiceGenerations.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(voiceGenerations.createdAt)],
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(voiceGenerations)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      generations: generations.map(g => serializeAllTimestamps(g)),
      pagination: { page, limit, total }
    }
  })

  // Get single voice generation
  fastify.get('/generations/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get voice generation by ID',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          generation: z.object({
            id: z.string().uuid(),
            text: z.string(),
            voiceProfileId: z.string().uuid(),
            npcId: z.string().nullable(),
            audioUrl: z.string().nullable(),
            duration: z.number().nullable(),
            fileSize: z.number().nullable(),
            format: z.string().nullable(),
            speed: z.string().nullable(),
            pitch: z.number().nullable(),
            stability: z.string().nullable(),
            clarity: z.string().nullable(),
            serviceProvider: z.string().nullable(),
            cost: z.string().nullable(),
            context: z.string().nullable(),
            emotion: z.string().nullable(),
            metadata: z.record(z.string(), z.any()),
            status: z.string(),
            error: z.string().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const generation = await fastify.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, id),
    })

    if (!generation) {
      throw new NotFoundError('Voice generation not found')
    }

    if (generation.ownerId !== request.user!.id) {
      throw new ForbiddenError('Access denied')
    }

    return { generation: serializeAllTimestamps(generation) }
  })

  // Generate voice audio
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate voice audio from text',
      tags: ['voice'],
      body: z.object({
        text: z.string().min(1).max(5000),
        voiceProfileId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        npcId: z.string().uuid().optional(),
        speed: z.number().min(0.5).max(2.0).optional(),
        pitch: z.number().int().min(-12).max(12).optional(),
        stability: z.number().min(0.0).max(1.0).optional(),
        clarity: z.number().min(0.0).max(1.0).optional(),
        context: z.enum(['dialog', 'narration', 'combat_bark']).optional(),
        emotion: z.enum(['neutral', 'happy', 'sad', 'angry']).optional(),
      }),
      response: {
        202: z.object({
          generation: z.object({
            id: z.string().uuid(),
            text: z.string(),
            voiceProfileId: z.string().uuid(),
            status: z.string(),
            statusUrl: z.string(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      text: string
      voiceProfileId: string
      projectId?: string
      npcId?: string
      speed?: number
      pitch?: number
      stability?: number
      clarity?: number
      context?: 'dialog' | 'narration' | 'combat_bark'
      emotion?: 'neutral' | 'happy' | 'sad' | 'angry'
    }

    const profile = await fastify.db.query.voiceProfiles.findFirst({
      where: eq(voiceProfiles.id, data.voiceProfileId)
    })

    if (!profile) {
      throw new NotFoundError('Voice profile not found')
    }

    const [generation] = await fastify.db.insert(voiceGenerations).values({
      text: data.text,
      voiceProfileId: data.voiceProfileId,
      projectId: data.projectId,
      npcId: data.npcId,
      ownerId: request.user!.id,
      speed: data.speed?.toString() as any,
      pitch: data.pitch,
      stability: data.stability?.toString() as any,
      clarity: data.clarity?.toString() as any,
      context: data.context,
      emotion: data.emotion,
      serviceProvider: profile.serviceProvider,
      serviceParams: data,
      status: 'processing',
      metadata: {},
    }).returning()

    if (!generation) {
      throw new Error('Failed to create voice generation')
    }

    // Start async generation (DON'T await - use setImmediate)
    setImmediate(() => processVoiceGeneration(generation.id, data, profile, fastify.db))

    // Return 202 Accepted
    reply.code(202).send({
      generation: {
        ...serializeAllTimestamps(generation),
        statusUrl: `/api/voice/generations/${generation.id}`,
      }
    })
  })

  // Batch generate voice audio
  fastify.post('/batch-generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Batch generate voice audio for multiple lines',
      tags: ['voice'],
      body: z.object({
        lines: z.array(z.object({
          text: z.string().min(1).max(5000),
          voiceProfileId: z.string().uuid(),
          npcId: z.string().uuid().optional(),
          context: z.enum(['dialog', 'narration', 'combat_bark']).optional(),
          emotion: z.enum(['neutral', 'happy', 'sad', 'angry']).optional(),
        })).min(1).max(100),
        projectId: z.string().uuid().optional(),
      }),
      response: {
        201: z.object({
          generations: z.array(z.object({
            id: z.string().uuid(),
            text: z.string(),
            voiceProfileId: z.string().uuid(),
            status: z.string(),
          }))
        })
      }
    }
  }, async (request, reply) => {
    const { lines, projectId } = request.body as {
      lines: Array<{
        text: string
        voiceProfileId: string
        npcId?: string
        context?: 'dialog' | 'narration' | 'combat_bark'
        emotion?: 'neutral' | 'happy' | 'sad' | 'angry'
      }>
      projectId?: string
    }

    const generations = await Promise.all(
      lines.map(async (line) => {
        const profile = await fastify.db.query.voiceProfiles.findFirst({
          where: eq(voiceProfiles.id, line.voiceProfileId)
        })

        if (!profile) {
          throw new NotFoundError(`Voice profile ${line.voiceProfileId} not found`)
        }

        const [generation] = await fastify.db.insert(voiceGenerations).values({
          text: line.text,
          voiceProfileId: line.voiceProfileId,
          projectId,
          npcId: line.npcId,
          ownerId: request.user!.id,
          context: line.context,
          emotion: line.emotion,
          serviceProvider: profile.serviceProvider,
          status: 'processing',
          metadata: {},
        }).returning()

        if (!generation) {
          throw new Error('Failed to create voice generation')
        }

        // Start async generation for this line (DON'T await - use setImmediate)
        const generationData = {
          text: line.text,
          voiceProfileId: line.voiceProfileId,
          projectId,
          npcId: line.npcId,
          context: line.context,
          emotion: line.emotion,
        }
        setImmediate(() => processVoiceGeneration(generation.id, generationData, profile, fastify.db))

        return generation
      })
    )

    reply.code(201).send({ generations: generations.map(g => serializeAllTimestamps(g)) })
  })

  // Delete voice generation
  fastify.delete('/generations/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete voice generation (owner only)',
      tags: ['voice'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const generation = await fastify.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, id)
    })

    if (!generation) {
      throw new NotFoundError('Voice generation not found')
    }

    if (generation.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner or admin can delete this generation')
    }

    if (generation.audioUrl) {
      await fileStorageService.deleteFile(generation.audioUrl)
    }

    await fastify.db.delete(voiceGenerations).where(eq(voiceGenerations.id, id))

    reply.code(204).send()
  })
}

export default voiceRoutes
