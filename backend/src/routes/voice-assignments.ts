/**
 * Voice Assignments API Routes
 * Handles voice assignment persistence for NPCs and Mobs from game manifests
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { voiceManifests } from '../database/schema'
import { eq, desc } from 'drizzle-orm'
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../utils/errors'

// =====================================================
// SCHEMAS
// =====================================================

const VoiceAssignmentSchema = z.object({
  npcId: z.string(),
  voiceId: z.string(),
  voiceName: z.string(),
}).passthrough()

const VoiceManifestSchema = z.object({
  manifestId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  assignments: z.array(z.any()),
  version: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const CreateVoiceManifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  assignments: z.array(VoiceAssignmentSchema).min(1),
  projectId: z.string().uuid().optional(),
  ownerId: z.string().uuid(),
})

const UpdateVoiceManifestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  assignments: z.array(VoiceAssignmentSchema).optional(),
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Voice manifest serialization with voice-specific fields
 */
function serializeVoiceManifest(row: any) {
  return {
    manifestId: row.id,
    name: row.name,
    description: row.description,
    assignments: (row.voiceAssignments as any[]) || [],
    version: row.version || 1,
    isActive: row.isActive || true,
    createdAt: row.createdAt!.toISOString(),
    updatedAt: row.updatedAt!.toISOString(),
  }
}

// =====================================================
// VOICE ASSIGNMENTS ROUTES
// =====================================================

export default async function voiceAssignmentsRoutes(server: FastifyInstance) {
  /**
   * GET /api/voice-assignments/by-owner/:ownerId
   * Get all voice assignment manifests for a specific owner
   */
  server.get('/by-owner/:ownerId', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Get all voice assignment manifests for a specific owner',
      params: z.object({ ownerId: z.string().uuid() }),
      response: {
        200: z.object({ count: z.number(), manifests: z.array(VoiceManifestSchema) }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request) => {
    const { ownerId } = request.params as { ownerId: string }
    const startTime = Date.now()

    try {
      server.log.info({ ownerId }, '[VoiceAssignments] Fetching manifests by owner')

      const results = await server.db
        .select()
        .from(voiceManifests)
        .where(eq(voiceManifests.ownerId, ownerId))
        .orderBy(desc(voiceManifests.updatedAt))

      const manifests = results.map(serializeVoiceManifest)
      server.log.info({ count: manifests.length, duration: Date.now() - startTime }, '[VoiceAssignments] Owner manifests fetched')

      return { count: manifests.length, manifests }
    } catch (error: any) {
      server.log.error({ error, ownerId, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to fetch owner manifests')
      throw new AppError(500, 'Failed to retrieve voice assignments')
    }
  })

  /**
   * GET /api/voice-assignments/by-project/:projectId
   * Get all voice assignment manifests for a specific project
   */
  server.get('/by-project/:projectId', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Get all voice assignment manifests for a specific project',
      params: z.object({ projectId: z.string().uuid() }),
      response: {
        200: z.object({ count: z.number(), manifests: z.array(VoiceManifestSchema) }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request) => {
    const { projectId } = request.params as { projectId: string }
    const startTime = Date.now()

    try {
      server.log.info({ projectId }, '[VoiceAssignments] Fetching manifests by project')

      const results = await server.db
        .select()
        .from(voiceManifests)
        .where(eq(voiceManifests.projectId, projectId))
        .orderBy(desc(voiceManifests.updatedAt))

      const manifests = results.map(serializeVoiceManifest)
      server.log.info({ count: manifests.length, duration: Date.now() - startTime }, '[VoiceAssignments] Project manifests fetched')

      return { count: manifests.length, manifests }
    } catch (error: any) {
      server.log.error({ error, projectId, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to fetch project manifests')
      throw new AppError(500, 'Failed to retrieve voice assignments')
    }
  })

  /**
   * GET /api/voice-assignments/:manifestId
   * Get voice assignments for a specific manifest
   */
  server.get('/:manifestId', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Get voice assignments for a specific manifest',
      params: z.object({ manifestId: z.string().uuid() }),
      response: {
        200: VoiceManifestSchema,
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request) => {
    const { manifestId } = request.params as { manifestId: string }
    const startTime = Date.now()

    try {
      server.log.info({ manifestId }, '[VoiceAssignments] Fetching manifest')

      const [manifest] = await server.db
        .select()
        .from(voiceManifests)
        .where(eq(voiceManifests.id, manifestId))

      if (!manifest) {
        throw new NotFoundError(`Voice manifest '${manifestId}' not found`)
      }

      server.log.info({ manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Manifest fetched')
      return serializeVoiceManifest(manifest)
    } catch (error: any) {
      if (error.statusCode) throw error
      server.log.error({ error, manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to fetch manifest')
      throw new AppError(500, 'Failed to retrieve voice assignments')
    }
  })

  /**
   * POST /api/voice-assignments
   * Create new voice assignments manifest
   */
  server.post('/', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Create new voice assignments manifest',
      body: CreateVoiceManifestSchema,
      response: {
        201: z.object({
          success: z.boolean(),
          message: z.string(),
          manifestId: z.string(),
          assignments: z.array(z.any()),
          createdAt: z.string(),
        }),
        400: z.object({ error: z.string() }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request, reply) => {
    const { name, description, assignments, projectId, ownerId } = request.body as any
    const startTime = Date.now()

    try {
      server.log.info({ name, assignmentsCount: assignments.length, ownerId }, '[VoiceAssignments] Creating manifest')

      const [manifest] = await server.db
        .insert(voiceManifests)
        .values({
          name,
          description: description || null,
          voiceAssignments: assignments,
          projectId: projectId || null,
          ownerId,
        })
        .returning()

      if (!manifest) {
        throw new Error('Failed to create voice manifest')
      }

      server.log.info({ manifestId: manifest.id, duration: Date.now() - startTime }, '[VoiceAssignments] Manifest created')

      reply.code(201)
      return {
        success: true,
        message: 'Voice assignments created successfully',
        manifestId: manifest.id,
        assignments: (manifest.voiceAssignments as any[]) || [],
        createdAt: manifest.createdAt!.toISOString(),
      }
    } catch (error: any) {
      server.log.error({ error, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to create manifest')
      throw new AppError(500, 'Failed to create voice assignments')
    }
  })

  /**
   * PUT /api/voice-assignments/:manifestId
   * Update existing voice assignments with versioning
   */
  server.put('/:manifestId', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Update existing voice assignments',
      params: z.object({ manifestId: z.string().uuid() }),
      body: UpdateVoiceManifestSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          manifestId: z.string(),
          assignments: z.array(z.any()),
          version: z.number(),
          updatedAt: z.string(),
        }),
        400: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request) => {
    const { manifestId } = request.params as { manifestId: string }
    const { name, description, assignments } = request.body as any
    const userId = request.user!.id
    const startTime = Date.now()

    try {
      server.log.info({ manifestId, userId }, '[VoiceAssignments] Updating manifest')

      const [existing] = await server.db
        .select()
        .from(voiceManifests)
        .where(eq(voiceManifests.id, manifestId))

      if (!existing) {
        throw new NotFoundError(`Voice manifest '${manifestId}' not found`)
      }

      // Check ownership
      if (existing.ownerId !== userId) {
        throw new ForbiddenError('Only the owner can update this voice manifest')
      }

      if (name === undefined && description === undefined && assignments === undefined) {
        throw new ValidationError('No valid fields to update')
      }

      // Voice manifest versioning logic
      const updates: any = {
        updatedAt: new Date(),
        version: (existing.version || 1) + 1,
      }
      if (name !== undefined) updates.name = name
      if (description !== undefined) updates.description = description
      if (assignments !== undefined) updates.voiceAssignments = assignments

      const [manifest] = await server.db
        .update(voiceManifests)
        .set(updates)
        .where(eq(voiceManifests.id, manifestId))
        .returning()

      server.log.info({ manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Manifest updated')

      return {
        success: true,
        message: 'Voice assignments updated successfully',
        manifestId: manifest!.id,
        assignments: (manifest!.voiceAssignments as any[]) || [],
        version: manifest!.version || 1,
        updatedAt: manifest!.updatedAt!.toISOString(),
      }
    } catch (error: any) {
      if (error.statusCode) throw error
      server.log.error({ error, manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to update manifest')
      throw new AppError(500, 'Failed to update voice assignments')
    }
  })

  /**
   * DELETE /api/voice-assignments/:manifestId
   * Delete voice assignments manifest
   */
  server.delete('/:manifestId', {
    onRequest: [server.authenticate],
    schema: {
      tags: ['voice-assignments'],
      description: 'Delete voice assignments manifest',
      params: z.object({ manifestId: z.string().uuid() }),
      response: {
        200: z.object({ success: z.boolean(), message: z.string(), manifestId: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request) => {
    const { manifestId } = request.params as { manifestId: string }
    const userId = request.user!.id
    const startTime = Date.now()

    try {
      server.log.info({ manifestId, userId }, '[VoiceAssignments] Deleting manifest')

      // Check if manifest exists and verify ownership
      const [existing] = await server.db
        .select()
        .from(voiceManifests)
        .where(eq(voiceManifests.id, manifestId))

      if (!existing) {
        throw new NotFoundError(`Voice manifest '${manifestId}' not found`)
      }

      // Check ownership
      if (existing.ownerId !== userId) {
        throw new ForbiddenError('Only the owner can delete this voice manifest')
      }

      const [deleted] = await server.db
        .delete(voiceManifests)
        .where(eq(voiceManifests.id, manifestId))
        .returning({ id: voiceManifests.id })

      if (!deleted) {
        throw new NotFoundError(`Voice manifest '${manifestId}' not found`)
      }

      server.log.info({ manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Manifest deleted')

      return {
        success: true,
        message: 'Voice assignments deleted successfully',
        manifestId,
      }
    } catch (error: any) {
      if (error.statusCode) throw error
      server.log.error({ error, manifestId, duration: Date.now() - startTime }, '[VoiceAssignments] Failed to delete manifest')
      throw new AppError(500, 'Failed to delete voice assignments')
    }
  })
}
