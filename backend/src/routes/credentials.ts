import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { userCredentials } from '../database/schema/system'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'
import { encryptApiKey, decryptApiKey } from '../helpers/encryption'

const credentialsRoutes: FastifyPluginAsync = async (fastify) => {
  // List user's service credentials
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List user service credentials (keys not exposed)',
      summary: 'List credentials',
      tags: ['credentials'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        service: z.enum(['openai', 'anthropic', 'meshy', 'elevenlabs']).optional().describe('Filter by service'),
      }),
      response: {
        200: z.object({
          credentials: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            service: z.string(),
            keyPrefix: z.string().nullable(),
            isActive: z.boolean(),
            lastUsedAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }))
        }).describe('Credentials list retrieved successfully')
      }
    }
  }, async (request) => {
    const { service } = request.query as { service?: string }
    const userId = request.user!.id

    const whereClause = service
      ? and(eq(userCredentials.userId, userId), eq(userCredentials.service, service))
      : eq(userCredentials.userId, userId)

    const credentialsList = await fastify.db.query.userCredentials.findMany({
      where: whereClause,
      orderBy: [desc(userCredentials.createdAt)],
      columns: {
        id: true,
        userId: true,
        service: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        // NEVER expose encryptedApiKey
      }
    })

    return {
      credentials: serializeAllTimestamps(credentialsList) as any,
    }
  })

  // Add service credential
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add service credential (API key will be encrypted)',
      summary: 'Add credential',
      tags: ['credentials'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        service: z.enum(['openai', 'anthropic', 'meshy', 'elevenlabs']).describe('Service name'),
        apiKey: z.string().min(1).describe('Service API key'),
      }),
      response: {
        201: z.object({
          credential: z.object({
            id: z.string().uuid(),
            service: z.string(),
            keyPrefix: z.string().nullable(),
            createdAt: z.string().datetime(),
          })
        }).describe('Credential added successfully'),
        400: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Bad request - Credential already exists for this service')
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      service: string
      apiKey: string
    }
    const userId = request.user!.id

    // Check if credential already exists for this service
    const existing = await fastify.db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.service, data.service)
      ),
    })

    if (existing) {
      throw new ValidationError(`Credential for ${data.service} already exists. Use update instead.`)
    }

    // Extract key prefix for display
    const keyPrefix = data.apiKey.substring(0, Math.min(12, data.apiKey.length))

    // Encrypt API key
    const encrypted = encryptApiKey(data.apiKey)

    const [credential] = await fastify.db.insert(userCredentials).values({
      userId,
      service: data.service,
      encryptedApiKey: encrypted,
      keyPrefix,
      isActive: true,
    }).returning({
      id: userCredentials.id,
      service: userCredentials.service,
      keyPrefix: userCredentials.keyPrefix,
      createdAt: userCredentials.createdAt,
    })

    if (!credential) {
      throw new ValidationError('Failed to add credential')
    }

    reply.code(201).send({
      credential: serializeAllTimestamps(credential) as any,
    })
  })

  // Update credential
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update service credential',
      summary: 'Update credential',
      tags: ['credentials'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Credential ID'),
      }),
      body: z.object({
        apiKey: z.string().min(1).describe('New API key'),
        isActive: z.boolean().optional().describe('Active status'),
      }),
      response: {
        200: z.object({
          credential: z.object({
            id: z.string().uuid(),
            service: z.string(),
            keyPrefix: z.string().nullable(),
            updatedAt: z.string().datetime(),
          })
        }).describe('Credential updated successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Can only update own credentials'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Credential not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const data = request.body as {
      apiKey: string
      isActive?: boolean
    }

    // Verify ownership
    const credential = await fastify.db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, id),
    })

    if (!credential) {
      throw new NotFoundError('Credential not found')
    }

    if (credential.userId !== request.user!.id) {
      throw new ForbiddenError('Can only update your own credentials')
    }

    // Extract new key prefix
    const keyPrefix = data.apiKey.substring(0, Math.min(12, data.apiKey.length))

    // Encrypt new API key
    const encrypted = encryptApiKey(data.apiKey)

    const [updated] = await fastify.db
      .update(userCredentials)
      .set({
        encryptedApiKey: encrypted,
        keyPrefix,
        isActive: data.isActive ?? credential.isActive,
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.id, id))
      .returning({
        id: userCredentials.id,
        service: userCredentials.service,
        keyPrefix: userCredentials.keyPrefix,
        updatedAt: userCredentials.updatedAt,
      })

    return {
      credential: serializeAllTimestamps(updated!) as any,
    }
  })

  // Delete credential
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete service credential',
      summary: 'Delete credential',
      tags: ['credentials'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Credential ID'),
      }),
      response: {
        204: z.null().describe('Credential deleted successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Can only delete own credentials'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Credential not found')
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verify ownership
    const credential = await fastify.db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, id),
    })

    if (!credential) {
      throw new NotFoundError('Credential not found')
    }

    if (credential.userId !== request.user!.id) {
      throw new ForbiddenError('Can only delete your own credentials')
    }

    await fastify.db.delete(userCredentials).where(eq(userCredentials.id, id))

    reply.code(204).send()
  })

  // Test credential validity
  fastify.post('/:id/test', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Test credential by decrypting and checking format',
      summary: 'Test credential',
      tags: ['credentials'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Credential ID'),
      }),
      response: {
        200: z.object({
          valid: z.boolean().describe('Whether credential is valid'),
          service: z.string().describe('Service name'),
          keyPrefix: z.string().nullable().describe('Key prefix for verification'),
        }).describe('Credential test result'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Can only test own credentials'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Credential not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    // Verify ownership
    const credential = await fastify.db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, id),
    })

    if (!credential) {
      throw new NotFoundError('Credential not found')
    }

    if (credential.userId !== request.user!.id) {
      throw new ForbiddenError('Can only test your own credentials')
    }

    // Test decryption
    let valid = false
    try {
      const decrypted = decryptApiKey(credential.encryptedApiKey)
      valid = decrypted.length > 0
    } catch (error) {
      valid = false
    }

    return {
      valid,
      service: credential.service,
      keyPrefix: credential.keyPrefix,
    }
  })
}

export default credentialsRoutes
