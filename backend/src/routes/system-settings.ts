import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { systemSettings } from '../database/schema/system'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'

const systemSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all settings (admin only)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all system settings (admin only)',
      summary: 'Get all settings',
      tags: ['system-settings'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          settings: z.array(z.object({
            id: z.string().uuid(),
            settingKey: z.string(),
            settingValue: z.record(z.string(), z.any()),
            description: z.string().nullable(),
            updatedBy: z.string().uuid().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }))
        }).describe('All system settings retrieved successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Admin access required')
      }
    }
  }, async (request) => {
    // Check admin role
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const settingsList = await fastify.db.query.systemSettings.findMany({})

    return {
      settings: serializeAllTimestamps(settingsList) as any,
    }
  })

  // Get specific setting
  fastify.get('/:key', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get specific system setting',
      summary: 'Get setting',
      tags: ['system-settings'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        key: z.string().describe('Setting key'),
      }),
      response: {
        200: z.object({
          setting: z.object({
            id: z.string().uuid(),
            settingKey: z.string(),
            settingValue: z.record(z.string(), z.any()),
            description: z.string().nullable(),
            updatedBy: z.string().uuid().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })
        }).describe('Setting retrieved successfully'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Setting not found')
      }
    }
  }, async (request) => {
    const { key } = request.params as { key: string }

    const setting = await fastify.db.query.systemSettings.findFirst({
      where: eq(systemSettings.settingKey, key),
    })

    if (!setting) {
      throw new NotFoundError(`Setting '${key}' not found`)
    }

    return {
      setting: serializeAllTimestamps(setting) as any,
    }
  })

  // Update or create setting (admin only)
  fastify.put('/:key', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update or create system setting (admin only)',
      summary: 'Update setting',
      tags: ['system-settings'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        key: z.string().describe('Setting key'),
      }),
      body: z.object({
        value: z.record(z.string(), z.any()).describe('Setting value (JSONB)'),
        description: z.string().optional().describe('Setting description'),
      }),
      response: {
        200: z.object({
          setting: z.object({
            id: z.string().uuid(),
            settingKey: z.string(),
            settingValue: z.record(z.string(), z.any()),
            description: z.string().nullable(),
            updatedBy: z.string().uuid().nullable(),
            updatedAt: z.string().datetime(),
          })
        }).describe('Setting updated successfully'),
        201: z.object({
          setting: z.object({
            id: z.string().uuid(),
            settingKey: z.string(),
            settingValue: z.record(z.string(), z.any()),
            description: z.string().nullable(),
            createdAt: z.string().datetime(),
          })
        }).describe('Setting created successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Admin access required')
      }
    }
  }, async (request, reply) => {
    // Check admin role
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const { key } = request.params as { key: string }
    const data = request.body as {
      value: Record<string, any>
      description?: string
    }

    // Check if setting exists
    const existing = await fastify.db.query.systemSettings.findFirst({
      where: eq(systemSettings.settingKey, key),
    })

    if (existing) {
      // Update existing setting
      const [updated] = await fastify.db
        .update(systemSettings)
        .set({
          settingValue: data.value,
          description: data.description || existing.description,
          updatedBy: request.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.settingKey, key))
        .returning()

      return {
        setting: serializeAllTimestamps(updated!) as any,
      }
    } else {
      // Create new setting
      const [created] = await fastify.db
        .insert(systemSettings)
        .values({
          settingKey: key,
          settingValue: data.value,
          description: data.description || null,
          updatedBy: request.user!.id,
        })
        .returning()

      if (!created) {
        throw new ValidationError('Failed to create setting')
      }

      reply.code(201).send({
        setting: serializeAllTimestamps(created) as any,
      })
    }
  })

  // Delete setting (admin only)
  fastify.delete('/:key', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete system setting (admin only)',
      summary: 'Delete setting',
      tags: ['system-settings'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        key: z.string().describe('Setting key'),
      }),
      response: {
        204: z.null().describe('Setting deleted successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Admin access required'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Setting not found')
      }
    }
  }, async (request, reply) => {
    // Check admin role
    if (request.user!.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    const { key } = request.params as { key: string }

    const existing = await fastify.db.query.systemSettings.findFirst({
      where: eq(systemSettings.settingKey, key),
    })

    if (!existing) {
      throw new NotFoundError(`Setting '${key}' not found`)
    }

    await fastify.db.delete(systemSettings).where(eq(systemSettings.settingKey, key))

    reply.code(204).send()
  })
}

export default systemSettingsRoutes
