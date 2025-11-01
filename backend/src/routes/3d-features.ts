import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import {
  riggingMetadata,
  fittingSessions,
  weaponDetection,
  assets,
} from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'
import { openaiService } from '../services/openai.service'
import { processGeneration3D } from '../services/3d-generation.processor'

const threeDFeaturesRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // 3D GENERATION ENDPOINTS (ASYNC)
  // =====================================================

  // Generate 3D model from text (async)
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate 3D model from text (async)',
      tags: ['3d-features'],
      body: z.object({
        prompt: z.string().min(1).max(500),
        name: z.string().min(1).max(255),
        projectId: z.string().uuid().optional(),
        artStyle: z.enum(['realistic', 'cartoon', 'low-poly']).default('realistic'),
        negativePrompt: z.string().max(500).optional(),
        aiModel: z.enum(['meshy-4', 'meshy-5']).default('meshy-5'),
        topology: z.enum(['quad', 'triangle']).default('triangle'),
        targetPolycount: z.number().int().min(1000).max(100000).default(30000),
      }),
      response: {
        202: z.object({
          taskId: z.string().uuid(),
          status: z.literal('processing'),
          statusUrl: z.string(),
          message: z.string(),
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      prompt: string
      name: string
      projectId?: string
      artStyle?: 'realistic' | 'cartoon' | 'low-poly'
      negativePrompt?: string
      aiModel?: 'meshy-4' | 'meshy-5'
      topology?: 'quad' | 'triangle'
      targetPolycount?: number
    }

    // Create asset record immediately with 'processing' status
    const [asset] = await fastify.db.insert(assets).values({
      name: data.name,
      description: `AI-generated 3D model: ${data.prompt}`,
      type: 'model',
      status: 'processing',
      ownerId: request.user!.id,
      visibility: 'private',
      prompt: data.prompt,
      generationParams: {
        artStyle: data.artStyle,
        negativePrompt: data.negativePrompt,
        aiModel: data.aiModel,
        topology: data.topology,
        targetPolycount: data.targetPolycount,
      },
      metadata: {
        generationStarted: new Date().toISOString(),
      },
    }).returning()

    if (!asset) {
      throw new Error('Failed to create asset')
    }

    // Start async generation (DON'T await - use setImmediate)
    setImmediate(() => processGeneration3D(asset.id, data, request.user!.id, fastify.db))

    // Return immediately with 202 Accepted
    reply.code(202).send({
      taskId: asset.id,
      status: 'processing',
      statusUrl: `/api/3d/generate/${asset.id}/status`,
      message: 'Generation started. Poll statusUrl for updates.',
    })
  })

  // Get generation status
  fastify.get('/generate/:taskId/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get generation status',
      tags: ['3d-features'],
      params: z.object({
        taskId: z.string().uuid()
      }),
      response: {
        200: z.object({
          taskId: z.string().uuid(),
          status: z.enum(['processing', 'completed', 'failed']),
          progress: z.number().min(0).max(100).optional(),
          result: z.object({
            assetId: z.string().uuid(),
            modelUrl: z.string().nullable(),
            thumbnailUrl: z.string().nullable(),
          }).optional(),
          error: z.string().optional(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime(),
        })
      }
    }
  }, async (request) => {
    const { taskId } = request.params as { taskId: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, taskId),
    })

    if (!asset) {
      throw new NotFoundError('Generation task not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Access denied')
    }

    const metadata = asset.metadata as Record<string, any>
    return {
      taskId: asset.id,
      status: asset.status === 'published' ? 'completed' : asset.status,
      progress: metadata?.progress || undefined,
      result: asset.status === 'published' ? {
        assetId: asset.id,
        modelUrl: asset.fileUrl || null,
        thumbnailUrl: metadata?.thumbnailUrl || null,
      } : undefined,
      error: metadata?.error || undefined,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    }
  })

  // =====================================================
  // RIGGING METADATA ENDPOINTS
  // =====================================================

  // Get rigging metadata for an asset
  fastify.get('/rigging/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get rigging metadata for an asset',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          rigging: z.object({
            id: z.string().uuid(),
            assetId: z.string().uuid(),
            projectId: z.string().uuid(),
            skeletonType: z.string(),
            boneCount: z.number(),
            bones: z.record(z.string(), z.any()),
            hasBlendShapes: z.boolean(),
            blendShapeCount: z.number(),
            hasIK: z.boolean(),
            ikChains: z.array(z.any()),
            supportedAnimations: z.array(z.string()),
            animationClips: z.array(z.any()),
            riggerNotes: z.string().nullable(),
            metadata: z.record(z.string(), z.any()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { assetId } = request.params as { assetId: string }

    const rigging = await fastify.db.query.riggingMetadata.findFirst({
      where: eq(riggingMetadata.assetId, assetId),
    })

    if (!rigging) {
      throw new NotFoundError('Rigging metadata not found')
    }

    // Verify asset ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    return { rigging: serializeAllTimestamps(rigging) }
  })

  // Add rigging metadata to an asset
  fastify.post('/rigging/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add rigging metadata to an asset',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      body: z.object({
        projectId: z.string().uuid(),
        skeletonType: z.enum(['humanoid', 'quadruped', 'custom']),
        boneCount: z.number().int().min(0),
        bones: z.record(z.string(), z.any()).default({}),
        hasBlendShapes: z.boolean().default(false),
        blendShapeCount: z.number().int().min(0).default(0),
        hasIK: z.boolean().default(false),
        ikChains: z.array(z.any()).default([]),
        supportedAnimations: z.array(z.string()).default([]),
        animationClips: z.array(z.any()).default([]),
        riggerNotes: z.string().optional(),
        metadata: z.record(z.string(), z.any()).default({}),
      }),
      response: {
        201: z.object({
          rigging: z.object({
            id: z.string().uuid(),
            assetId: z.string().uuid(),
            createdAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string }
    const data = request.body as {
      projectId: string
      skeletonType: string
      boneCount: number
      bones?: Record<string, unknown>
      hasBlendShapes?: boolean
      blendShapeCount?: number
      hasIK?: boolean
      ikChains?: unknown[]
      supportedAnimations?: string[]
      animationClips?: unknown[]
      riggerNotes?: string
      metadata?: Record<string, unknown>
    }

    // Verify asset exists and ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the asset owner can add rigging metadata')
    }

    if (asset.type !== 'model') {
      throw new ValidationError('Rigging metadata can only be added to 3D model assets')
    }

    // Check if rigging metadata already exists
    const existing = await fastify.db.query.riggingMetadata.findFirst({
      where: eq(riggingMetadata.assetId, assetId),
    })

    if (existing) {
      throw new ValidationError('Rigging metadata already exists for this asset')
    }

    const [rigging] = await fastify.db.insert(riggingMetadata).values({
      assetId,
      projectId: data.projectId,
      skeletonType: data.skeletonType,
      boneCount: data.boneCount,
      bones: data.bones || {},
      hasBlendShapes: data.hasBlendShapes || false,
      blendShapeCount: data.blendShapeCount || 0,
      hasIK: data.hasIK || false,
      ikChains: data.ikChains || [],
      supportedAnimations: data.supportedAnimations || [],
      animationClips: data.animationClips || [],
      riggerNotes: data.riggerNotes,
      metadata: data.metadata || {},
    }).returning()

    if (!rigging) {
      throw new Error('Failed to create rigging metadata')
    }

    reply.code(201).send({ rigging: serializeAllTimestamps(rigging) })
  })

  // Update rigging metadata
  fastify.patch('/rigging/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update rigging metadata',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      body: z.object({
        skeletonType: z.enum(['humanoid', 'quadruped', 'custom']).optional(),
        boneCount: z.number().int().min(0).optional(),
        bones: z.record(z.string(), z.any()).optional(),
        hasBlendShapes: z.boolean().optional(),
        blendShapeCount: z.number().int().min(0).optional(),
        hasIK: z.boolean().optional(),
        ikChains: z.array(z.any()).optional(),
        supportedAnimations: z.array(z.string()).optional(),
        animationClips: z.array(z.any()).optional(),
        riggerNotes: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
      response: {
        200: z.object({
          rigging: z.object({
            id: z.string().uuid(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { assetId } = request.params as { assetId: string }
    const updates = request.body

    // Verify ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the asset owner can update rigging metadata')
    }

    const [updated] = await fastify.db
      .update(riggingMetadata)
      .set({
        ...(updates as Record<string, unknown>),
        updatedAt: new Date(),
      })
      .where(eq(riggingMetadata.assetId, assetId))
      .returning()

    if (!updated) {
      throw new NotFoundError('Rigging metadata not found')
    }

    return { rigging: serializeAllTimestamps(updated) }
  })

  // Delete rigging metadata
  fastify.delete('/rigging/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete rigging metadata',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      response: {
        204: z.null(),
      },
    },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string }

    // Verify ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    await fastify.db.delete(riggingMetadata).where(eq(riggingMetadata.assetId, assetId))

    reply.code(204).send()
  })

  // =====================================================
  // FITTING SESSIONS ENDPOINTS
  // =====================================================

  // List fitting sessions
  fastify.get('/fitting', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List fitting sessions',
      tags: ['3d-features'],
      querystring: z.object({
        projectId: z.string().uuid().optional(),
        status: z.enum(['draft', 'processing', 'completed', 'failed']).optional(),
      }),
      response: {
        200: z.object({
          sessions: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            baseAssetId: z.string().uuid(),
            equipmentAssetId: z.string().uuid(),
            projectId: z.string().uuid(),
            status: z.string(),
            previewImageUrl: z.string().nullable(),
            createdAt: z.string().datetime(),
          })),
        }),
      },
    },
  }, async (request) => {
    const { projectId, status } = request.query as {
      projectId?: string
      status?: string
    }

    const conditions = [eq(fittingSessions.ownerId, request.user!.id)]

    if (projectId) {
      conditions.push(eq(fittingSessions.projectId, projectId))
    }

    if (status) {
      conditions.push(eq(fittingSessions.status, status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const sessions = await fastify.db.query.fittingSessions.findMany({
      where: whereClause,
      orderBy: [desc(fittingSessions.createdAt)],
    })

    return {
      sessions: sessions.map(s => serializeAllTimestamps(s)),
    }
  })

  // Create fitting session
  fastify.post('/fitting', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a fitting session',
      tags: ['3d-features'],
      body: z.object({
        name: z.string().min(1).max(255),
        baseAssetId: z.string().uuid(),
        equipmentAssetId: z.string().uuid(),
        projectId: z.string().uuid(),
        attachmentPoints: z.record(z.string(), z.any()).default({}),
        transforms: z.record(z.string(), z.any()).default({}),
        deformations: z.record(z.string(), z.any()).default({}),
        metadata: z.record(z.string(), z.any()).default({}),
      }),
      response: {
        201: z.object({
          session: z.object({
            id: z.string().uuid(),
            name: z.string(),
            status: z.string(),
            createdAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      baseAssetId: string
      equipmentAssetId: string
      projectId: string
      attachmentPoints?: Record<string, unknown>
      transforms?: Record<string, unknown>
      deformations?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }

    // Verify both assets exist
    const baseAsset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, data.baseAssetId),
    })

    const equipmentAsset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, data.equipmentAssetId),
    })

    if (!baseAsset || !equipmentAsset) {
      throw new NotFoundError('One or both assets not found')
    }

    if (baseAsset.type !== 'model' || equipmentAsset.type !== 'model') {
      throw new ValidationError('Both assets must be 3D models')
    }

    const [session] = await fastify.db.insert(fittingSessions).values({
      name: data.name,
      baseAssetId: data.baseAssetId,
      equipmentAssetId: data.equipmentAssetId,
      projectId: data.projectId,
      ownerId: request.user!.id,
      attachmentPoints: data.attachmentPoints || {},
      transforms: data.transforms || {},
      deformations: data.deformations || {},
      metadata: data.metadata || {},
      status: 'draft',
    }).returning()

    if (!session) {
      throw new Error('Failed to create fitting session')
    }

    reply.code(201).send({ session: serializeAllTimestamps(session) })
  })

  // Get fitting session details
  fastify.get('/fitting/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get fitting session details',
      tags: ['3d-features'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          session: z.object({
            id: z.string().uuid(),
            name: z.string(),
            baseAssetId: z.string().uuid(),
            equipmentAssetId: z.string().uuid(),
            projectId: z.string().uuid(),
            ownerId: z.string().uuid(),
            attachmentPoints: z.record(z.string(), z.any()),
            transforms: z.record(z.string(), z.any()),
            deformations: z.record(z.string(), z.any()),
            resultAssetId: z.string().uuid().nullable(),
            previewImageUrl: z.string().nullable(),
            status: z.string(),
            metadata: z.record(z.string(), z.any()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const session = await fastify.db.query.fittingSessions.findFirst({
      where: eq(fittingSessions.id, id),
    })

    if (!session) {
      throw new NotFoundError('Fitting session not found')
    }

    if (session.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    return { session: serializeAllTimestamps(session) }
  })

  // Process fitting
  fastify.post('/fitting/:id/process', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Process a fitting session',
      tags: ['3d-features'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          session: z.object({
            id: z.string().uuid(),
            status: z.string(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const session = await fastify.db.query.fittingSessions.findFirst({
      where: eq(fittingSessions.id, id),
    })

    if (!session) {
      throw new NotFoundError('Fitting session not found')
    }

    if (session.ownerId !== request.user!.id) {
      throw new ForbiddenError('Only the owner can process this fitting session')
    }

    // Update status to processing
    const [updated] = await fastify.db
      .update(fittingSessions)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(fittingSessions.id, id))
      .returning()

    // In a real implementation, you would:
    // 1. Queue a background job to process the fitting
    // 2. Apply transforms and deformations
    // 3. Generate a preview image
    // 4. Create a result asset
    // For now, we'll simulate completion
    setImmediate(async () => {
      await fastify.db
        .update(fittingSessions)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(fittingSessions.id, id))
    })

    return { session: serializeAllTimestamps(updated!) }
  })

  // Delete fitting session
  fastify.delete('/fitting/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete fitting session',
      tags: ['3d-features'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        204: z.null(),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const session = await fastify.db.query.fittingSessions.findFirst({
      where: eq(fittingSessions.id, id),
    })

    if (!session) {
      throw new NotFoundError('Fitting session not found')
    }

    if (session.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    await fastify.db.delete(fittingSessions).where(eq(fittingSessions.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // WEAPON DETECTION ENDPOINTS
  // =====================================================

  // Detect weapon in asset
  fastify.post('/detect-weapon/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Detect if asset is a weapon using AI',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          detection: z.object({
            id: z.string().uuid(),
            assetId: z.string().uuid(),
            isWeapon: z.boolean(),
            confidence: z.string(),
            weaponType: z.string().nullable(),
            weaponClass: z.string().nullable(),
            createdAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { assetId } = request.params as { assetId: string }

    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.type !== 'model') {
      throw new ValidationError('Weapon detection only works on 3D model assets')
    }

    // Use AI to detect weapon
    const startTime = Date.now()
    const prompt = `Analyze this 3D model file name and description to determine if it's a weapon.
Asset name: ${asset.name}
Asset description: ${asset.description || 'No description provided'}

Respond in JSON format with:
{
  "isWeapon": boolean,
  "confidence": number (0-1),
  "weaponType": string or null (e.g., "sword", "bow", "staff", "axe"),
  "weaponClass": string or null ("melee", "ranged", "magic"),
  "estimatedDamage": number or null,
  "estimatedRange": number or null,
  "handedness": string or null ("one-handed", "two-handed")
}`

    const response = await openaiService.chatCompletion([
      {
        role: 'system',
        content: 'You are an expert at analyzing 3D game assets and identifying weapons.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      model: 'gpt-4-turbo',
      temperature: 0.3,
      maxTokens: 500,
    })

    const processingTime = Date.now() - startTime

    // Parse AI response
    let analysisData: Record<string, unknown>
    try {
      analysisData = JSON.parse(response.content)
    } catch {
      throw new Error('Failed to parse AI response')
    }

    const [detection] = await fastify.db.insert(weaponDetection).values({
      assetId,
      isWeapon: (analysisData.isWeapon as boolean) || false,
      confidence: String(analysisData.confidence || 0),
      weaponType: (analysisData.weaponType as string) || null,
      weaponClass: (analysisData.weaponClass as string) || null,
      estimatedDamage: (analysisData.estimatedDamage as number) || null,
      estimatedRange: (analysisData.estimatedRange as number) || null,
      handedness: (analysisData.handedness as string) || null,
      gripPoints: [],
      aiModel: 'gpt-4-turbo',
      analysisData,
      processingTime,
      verified: false,
    }).returning()

    if (!detection) {
      throw new Error('Failed to create weapon detection')
    }

    return { detection: serializeAllTimestamps(detection) }
  })

  // Get weapon detection data
  fastify.get('/weapon/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get weapon detection data for an asset',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          detection: z.object({
            id: z.string().uuid(),
            assetId: z.string().uuid(),
            isWeapon: z.boolean(),
            confidence: z.string(),
            weaponType: z.string().nullable(),
            weaponClass: z.string().nullable(),
            estimatedDamage: z.number().nullable(),
            estimatedRange: z.number().nullable(),
            handedness: z.string().nullable(),
            gripPoints: z.array(z.any()),
            aiModel: z.string().nullable(),
            analysisData: z.record(z.string(), z.any()),
            processingTime: z.number().nullable(),
            verified: z.boolean(),
            verifiedBy: z.string().uuid().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { assetId } = request.params as { assetId: string }

    const detection = await fastify.db.query.weaponDetection.findFirst({
      where: eq(weaponDetection.assetId, assetId),
    })

    if (!detection) {
      throw new NotFoundError('Weapon detection not found')
    }

    return { detection: serializeAllTimestamps(detection) }
  })

  // Verify weapon detection
  fastify.patch('/weapon/:assetId/verify', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Verify or correct weapon detection',
      tags: ['3d-features'],
      params: z.object({
        assetId: z.string().uuid(),
      }),
      body: z.object({
        isWeapon: z.boolean().optional(),
        weaponType: z.string().optional(),
        weaponClass: z.string().optional(),
        estimatedDamage: z.number().optional(),
        estimatedRange: z.number().optional(),
        handedness: z.string().optional(),
      }),
      response: {
        200: z.object({
          detection: z.object({
            id: z.string().uuid(),
            verified: z.boolean(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { assetId } = request.params as { assetId: string }
    const updates = request.body

    // Verify asset ownership
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    if (asset.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    const [updated] = await fastify.db
      .update(weaponDetection)
      .set({
        ...(updates as Record<string, unknown>),
        verified: true,
        verifiedBy: request.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(weaponDetection.assetId, assetId))
      .returning()

    if (!updated) {
      throw new NotFoundError('Weapon detection not found')
    }

    return { detection: serializeAllTimestamps(updated) }
  })
}

export default threeDFeaturesRoutes
