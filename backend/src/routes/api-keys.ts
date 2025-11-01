import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { apiKeys } from '../database/schema/system'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'
import { generateApiKey } from '../helpers/api-key-generator'

const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
  // List user/team API keys
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List user or team API keys',
      summary: 'List API keys',
      tags: ['api-keys'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        teamId: z.string().uuid().optional().describe('Filter by team ID'),
      }),
      response: {
        200: z.object({
          apiKeys: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            teamId: z.string().uuid().nullable(),
            name: z.string(),
            keyPrefix: z.string(),
            permissions: z.array(z.string()),
            lastUsedAt: z.string().datetime().nullable(),
            expiresAt: z.string().datetime().nullable(),
            isActive: z.boolean(),
            createdAt: z.string().datetime(),
          }))
        }).describe('API keys list retrieved successfully')
      }
    }
  }, async (request) => {
    const { teamId } = request.query as { teamId?: string }
    const userId = request.user!.id

    // Build where clause
    const whereClause = teamId
      ? and(eq(apiKeys.teamId, teamId), eq(apiKeys.isActive, true))
      : and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))

    const keysList = await fastify.db.query.apiKeys.findMany({
      where: whereClause,
      orderBy: [desc(apiKeys.createdAt)],
      columns: {
        id: true,
        userId: true,
        teamId: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        // Exclude keyHash for security
      }
    })

    return {
      apiKeys: serializeAllTimestamps(keysList) as any,
    }
  })

  // Create new API key
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create new API key',
      summary: 'Create API key',
      tags: ['api-keys'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        name: z.string().min(1).max(255).describe('API key name'),
        teamId: z.string().uuid().optional().describe('Team ID (optional)'),
        permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read']).describe('API key permissions'),
        expiresAt: z.string().datetime().optional().describe('Expiration date'),
      }),
      response: {
        201: z.object({
          apiKey: z.object({
            id: z.string().uuid(),
            name: z.string(),
            key: z.string().describe('Full API key - shown only once!'),
            keyPrefix: z.string(),
            permissions: z.array(z.string()),
            expiresAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
          })
        }).describe('API key created successfully')
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      teamId?: string
      permissions: string[]
      expiresAt?: string
    }

    // Generate API key
    const { key, hash, prefix } = generateApiKey()

    // Create key in database
    const [newKey] = await fastify.db.insert(apiKeys).values({
      userId: data.teamId ? null : request.user!.id,
      teamId: data.teamId || null,
      name: data.name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: data.permissions,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    }).returning()

    if (!newKey) {
      throw new ValidationError('Failed to create API key')
    }

    reply.code(201).send({
      apiKey: {
        ...serializeAllTimestamps(newKey) as any,
        key, // Return the full key only once
      },
    })
  })

  // Update API key (name, permissions)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update API key name or permissions',
      summary: 'Update API key',
      tags: ['api-keys'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('API key ID'),
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional().describe('API key name'),
        permissions: z.array(z.enum(['read', 'write', 'admin'])).optional().describe('API key permissions'),
      }),
      response: {
        200: z.object({
          apiKey: z.object({
            id: z.string().uuid(),
            name: z.string(),
            permissions: z.array(z.string()),
          })
        }).describe('API key updated successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Cannot update another user\'s API key'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('API key not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      permissions?: string[]
    }

    // Verify ownership
    const key = await fastify.db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    })

    if (!key) {
      throw new NotFoundError('API key not found')
    }

    if (key.userId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Cannot update another user\'s API key')
    }

    const [updated] = await fastify.db
      .update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        permissions: apiKeys.permissions,
      })

    return {
      apiKey: updated!,
    }
  })

  // Revoke API key
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Revoke API key',
      summary: 'Revoke API key',
      tags: ['api-keys'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('API key ID'),
      }),
      response: {
        204: z.null().describe('API key revoked successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Cannot revoke another user\'s API key'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('API key not found')
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verify ownership
    const key = await fastify.db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    })

    if (!key) {
      throw new NotFoundError('API key not found')
    }

    if (key.userId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Cannot revoke another user\'s API key')
    }

    // Soft delete - mark as inactive and set revoked date
    await fastify.db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))

    reply.code(204).send()
  })

  // Rotate API key
  fastify.post('/:id/rotate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Rotate API key (generates new key, invalidates old)',
      summary: 'Rotate API key',
      tags: ['api-keys'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('API key ID'),
      }),
      response: {
        200: z.object({
          apiKey: z.object({
            id: z.string().uuid(),
            name: z.string(),
            key: z.string().describe('New API key - shown only once!'),
            keyPrefix: z.string(),
            createdAt: z.string().datetime(),
          })
        }).describe('API key rotated successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Cannot rotate another user\'s API key'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('API key not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    // Verify ownership
    const oldKey = await fastify.db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    })

    if (!oldKey) {
      throw new NotFoundError('API key not found')
    }

    if (oldKey.userId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Cannot rotate another user\'s API key')
    }

    // Generate new API key
    const { key, hash, prefix } = generateApiKey()

    // Update key in database
    const [rotated] = await fastify.db
      .update(apiKeys)
      .set({
        keyHash: hash,
        keyPrefix: prefix,
        lastUsedAt: null, // Reset last used
      })
      .where(eq(apiKeys.id, id))
      .returning()

    return {
      apiKey: {
        ...serializeAllTimestamps(rotated!) as any,
        key, // Return the new full key only once
      },
    }
  })
}

export default apiKeyRoutes
