/**
 * Models API Routes (User-Facing)
 *
 * Provides endpoints for users to discover and select AI models.
 * Only returns models that admins have enabled.
 *
 * NOTE: This is a simplified version working with modelConfigurations table.
 * Future enhancement: Create enabled_models view with richer metadata.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { modelConfigurations } from '../database/schema'
import { eq } from 'drizzle-orm'
import { AppError } from '../utils/errors'

// =====================================================
// SCHEMAS
// =====================================================

const ModelSchema = z.object({
  id: z.string(),
  taskType: z.string(),
  provider: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  temperature: z.number().nullable(),
  maxTokens: z.number().nullable(),
  pricing: z.object({
    input: z.number(),
    output: z.number(),
    currency: z.string(),
  }).nullable(),
  isActive: z.boolean(),
})

const ModelsListSchema = z.object({
  count: z.number(),
  models: z.array(ModelSchema),
})

const ModelsByTaskSchema = z.object({
  taskType: z.string(),
  count: z.number(),
  models: z.array(ModelSchema),
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Transform database model configuration to API response format
 */
function transformModel(row: typeof modelConfigurations.$inferSelect) {
  return {
    id: row.modelId,
    taskType: row.taskType,
    provider: row.provider,
    displayName: row.displayName,
    description: row.description,
    temperature: row.temperature ? parseFloat(row.temperature) : null,
    maxTokens: row.maxTokens,
    pricing: row.pricingInput && row.pricingOutput ? {
      input: parseFloat(row.pricingInput),
      output: parseFloat(row.pricingOutput),
      currency: 'USD',
    } : null,
    isActive: row.isActive || false,
  }
}

// =====================================================
// MODELS ROUTES
// =====================================================

export default async function modelsRoutes(server: FastifyInstance) {
  /**
   * GET /api/models
   * Get all enabled models
   */
  server.get('/', {
    schema: {
      tags: ['models'],
      description: 'Get all enabled models',
      response: {
        200: ModelsListSchema,
        500: z.object({
          error: z.string(),
          code: z.string(),
          message: z.string(),
          timestamp: z.string(),
        }),
      },
    },
  }, async () => {
    const startTime = Date.now()

    try {
      server.log.info('[Models] Fetching all enabled models')

      const results = await server.db
        .select()
        .from(modelConfigurations)
        .where(eq(modelConfigurations.isActive, true))
        .orderBy(modelConfigurations.taskType, modelConfigurations.displayName)

      const models = results.map(transformModel)

      const duration = Date.now() - startTime
      server.log.info({ count: models.length, duration }, '[Models] Fetched all models')

      return {
        count: models.length,
        models,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({ error, duration }, '[Models] Failed to fetch models')

      throw new AppError(500, 'Failed to fetch AI models')
    }
  })

  /**
   * GET /api/models/:taskType
   * Get enabled models for a specific task type
   */
  server.get('/:taskType', {
    schema: {
      tags: ['models'],
      description: 'Get enabled models for a specific task type',
      params: z.object({
        taskType: z.string(),
      }),
      response: {
        200: ModelsByTaskSchema,
        500: z.object({
          error: z.string(),
          code: z.string(),
          taskType: z.string(),
          message: z.string(),
          timestamp: z.string(),
        }),
      },
    },
  }, async (request) => {
    const startTime = Date.now()
    const { taskType } = request.params as { taskType: string }

    try {
      server.log.info({ taskType }, '[Models] Fetching models for task type')

      const results = await server.db
        .select()
        .from(modelConfigurations)
        .where(eq(modelConfigurations.taskType, taskType))
        .orderBy(modelConfigurations.displayName)

      const models = results.map(transformModel)

      const duration = Date.now() - startTime
      server.log.info({ taskType, count: models.length, duration }, '[Models] Fetched models for task type')

      return {
        taskType,
        count: models.length,
        models,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({ error, taskType, duration }, '[Models] Failed to fetch models')

      throw new AppError(500, 'Failed to fetch models for task type')
    }
  })
}
