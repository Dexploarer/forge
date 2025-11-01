/**
 * AI Gateway API Routes
 * Provides endpoints for AI Gateway features:
 * - Available models and pricing
 * - Credit balance and usage
 * - Model selection helpers
 * - Cost estimation
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AISDKService } from '../services/ai-sdk.service'
import { ValidationError, NotFoundError } from '../utils/errors'

// =====================================================
// SCHEMAS
// =====================================================

const StatusResponseSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
  message: z.string()
})

const ModelPricingSchema = z.object({
  input: z.number(),
  output: z.number(),
  cachedInput: z.number().optional(),
  cacheCreation: z.number().optional()
}).nullable()

const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pricing: ModelPricingSchema
})

const ModelsResponseSchema = z.object({
  count: z.number(),
  models: z.array(ModelSchema)
})

const ModelPricingResponseSchema = z.object({
  modelId: z.string(),
  pricing: ModelPricingSchema
})

const CreditsResponseSchema = z.object({
  balance: z.number(),
  totalUsed: z.number(),
  unit: z.string()
})

const ProvidersResponseSchema = z.object({
  count: z.number(),
  providers: z.array(z.string())
})

const EstimateRequestSchema = z.object({
  model: z.string(),
  inputTokens: z.number().positive(),
  outputTokens: z.number().positive()
})

const EstimateResponseSchema = z.object({
  model: z.string(),
  estimate: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    costs: z.object({
      input: z.string(),
      output: z.string(),
      total: z.string()
    }),
    unit: z.string()
  }),
  pricing: ModelPricingSchema
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if AI Gateway is enabled
 */
function checkGatewayEnabled(aiService: AISDKService) {
  if (!(aiService as any).useGateway) {
    throw new ValidationError(
      'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
    )
  }
}

/**
 * Calculate cost estimate
 */
function calculateCostEstimate(inputTokens: number, outputTokens: number, pricing: any) {
  const cost = {
    input: (inputTokens / 1000000) * pricing.input,
    output: (outputTokens / 1000000) * pricing.output,
    total: 0
  }
  cost.total = cost.input + cost.output

  return {
    inputTokens,
    outputTokens,
    costs: {
      input: cost.input.toFixed(6),
      output: cost.output.toFixed(6),
      total: cost.total.toFixed(6)
    },
    unit: 'USD'
  }
}

/**
 * Get mock models data (temporary until gateway integration)
 */
function getMockModels() {
  return [
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'Most capable OpenAI model for complex tasks',
      pricing: {
        input: 2.5,
        output: 10.0,
        cachedInput: 1.25,
        cacheCreation: 3.75
      }
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Fast and affordable model for simple tasks',
      pricing: {
        input: 0.15,
        output: 0.6,
        cachedInput: 0.075,
        cacheCreation: 0.225
      }
    },
    {
      id: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      description: 'Balanced performance and cost',
      pricing: {
        input: 3.0,
        output: 15.0,
        cachedInput: 0.3,
        cacheCreation: 3.75
      }
    },
    {
      id: 'anthropic/claude-opus-4',
      name: 'Claude Opus 4',
      description: 'Most capable Anthropic model',
      pricing: {
        input: 15.0,
        output: 75.0,
        cachedInput: 1.5,
        cacheCreation: 18.75
      }
    },
    {
      id: 'anthropic/claude-haiku-4',
      name: 'Claude Haiku 4',
      description: 'Fast and efficient model',
      pricing: {
        input: 0.8,
        output: 4.0,
        cachedInput: 0.08,
        cacheCreation: 1.0
      }
    }
  ]
}

// =====================================================
// ROUTE REGISTRATION
// =====================================================

const aiGatewayRoutes: FastifyPluginAsync = async (fastify) => {
  const aiService = new AISDKService()

  /**
   * GET /api/ai-gateway/status
   * Check if AI Gateway is enabled
   */
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['ai-gateway'],
        description: 'Check if AI Gateway is enabled',
        response: {
          200: StatusResponseSchema
        }
      }
    },
    async () => {
      return {
        enabled: (aiService as any).useGateway,
        provider: (aiService as any).useGateway ? 'ai-gateway' : 'direct',
        message: (aiService as any).useGateway
          ? 'Using Vercel AI Gateway for unified model access'
          : 'Using direct provider access (OpenAI, Anthropic)'
      }
    }
  )

  /**
   * GET /api/ai-gateway/models
   * Get all available models with pricing
   */
  fastify.get(
    '/models',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['ai-gateway'],
        description: 'Get all available models with pricing',
        security: [{ bearerAuth: [] }],
        response: {
          200: ModelsResponseSchema
        }
      }
    },
    async () => {
      try {
        checkGatewayEnabled(aiService)

        // TODO: Replace with real gateway integration when available
        // const models = await aiService.getAvailableModels()
        const models = getMockModels()

        return {
          count: models.length,
          models: models
        }
      } catch (error) {
        console.error('Failed to fetch models:', error)
        throw error
      }
    }
  )

  /**
   * GET /api/ai-gateway/models/:modelId/pricing
   * Get pricing for a specific model
   */
  fastify.get<{
    Params: { modelId: string }
  }>(
    '/models/:modelId/pricing',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['ai-gateway'],
        description: 'Get pricing for a specific model',
        security: [{ bearerAuth: [] }],
        params: z.object({
          modelId: z.string()
        }),
        response: {
          200: ModelPricingResponseSchema
        }
      }
    },
    async (request) => {
      try {
        checkGatewayEnabled(aiService)

        // Replace - with / in model ID (URL encoding)
        const modelId = request.params.modelId.replace('-', '/')

        // TODO: Replace with real gateway integration when available
        // const pricing = await aiService.getModelPricing(modelId)
        const models = getMockModels()
        const model = models.find((m) => m.id === modelId)

        if (!model) {
          throw new NotFoundError(`Model ${modelId} not found`)
        }

        return {
          modelId: modelId,
          pricing: model.pricing
        }
      } catch (error) {
        console.error('Failed to fetch model pricing:', error)
        throw error
      }
    }
  )

  /**
   * GET /api/ai-gateway/credits
   * Get team credit balance and usage
   */
  fastify.get(
    '/credits',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['ai-gateway'],
        description: 'Get team credit balance and usage (gateway only)',
        security: [{ bearerAuth: [] }],
        response: {
          200: CreditsResponseSchema
        }
      }
    },
    async () => {
      try {
        checkGatewayEnabled(aiService)

        // TODO: Replace with real gateway integration when available
        // const credits = await aiService.getCredits()
        const credits = {
          balance: 100.0,
          totalUsed: 25.5
        }

        return {
          balance: credits.balance,
          totalUsed: credits.totalUsed,
          unit: 'USD'
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
        throw error
      }
    }
  )

  /**
   * GET /api/ai-gateway/providers
   * Get list of supported providers
   */
  fastify.get(
    '/providers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['ai-gateway'],
        description: 'Get list of supported providers',
        security: [{ bearerAuth: [] }],
        response: {
          200: ProvidersResponseSchema
        }
      }
    },
    async () => {
      try {
        checkGatewayEnabled(aiService)

        // TODO: Replace with real gateway integration when available
        // const models = await aiService.getAvailableModels()
        const models = getMockModels()

        // Extract unique providers
        const providers = [...new Set(models.map((m) => m.id.split('/')[0]))]

        return {
          count: providers.length,
          providers: providers.sort()
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error)
        throw error
      }
    }
  )

  /**
   * POST /api/ai-gateway/estimate
   * Estimate cost for a generation request
   */
  fastify.post<{
    Body: z.infer<typeof EstimateRequestSchema>
  }>(
    '/estimate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['ai-gateway'],
        description: 'Estimate cost for a generation request',
        security: [{ bearerAuth: [] }],
        body: EstimateRequestSchema,
        response: {
          200: EstimateResponseSchema
        }
      }
    },
    async (request) => {
      try {
        checkGatewayEnabled(aiService)

        const { model, inputTokens, outputTokens } = request.body

        // TODO: Replace with real gateway integration when available
        // const pricing = await aiService.getModelPricing(model)
        const models = getMockModels()
        const modelData = models.find((m) => m.id === model)

        if (!modelData || !modelData.pricing) {
          throw new NotFoundError(`Pricing not available for model: ${model}`)
        }

        const estimate = calculateCostEstimate(inputTokens, outputTokens, modelData.pricing)

        return {
          model: model,
          estimate,
          pricing: modelData.pricing
        }
      } catch (error) {
        console.error('Failed to estimate cost:', error)
        throw error
      }
    }
  )
}

export default aiGatewayRoutes
