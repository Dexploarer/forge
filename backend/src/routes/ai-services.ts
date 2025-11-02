import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { experimental_generateImage as generateImage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { aiServiceCalls } from '../database/schema'
import { ForbiddenError } from '../utils/errors'
import { serializeAllTimestamps } from '../helpers/serialization'
import { checkRateLimit, recordUsage, getUsageStats } from '../helpers/rate-limiter'
import { calculateOpenAICost, calculateMeshyCost, formatCost } from '../helpers/cost-calculator'
import { openaiService } from '../services/openai.service'
import { meshyService } from '../services/meshy.service'
import { embeddingsService } from '../services/embeddings.service'
import { env } from '../config/env'

const aiServicesRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // USAGE STATISTICS
  // =====================================================
  fastify.get('/usage', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get AI service usage statistics',
      tags: ['ai-services'],
      querystring: z.object({
        service: z.enum(['openai', 'anthropic', 'meshy', 'elevenlabs']).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
      response: {
        200: z.object({
          usage: z.object({
            totalCalls: z.number(),
            successfulCalls: z.number(),
            failedCalls: z.number(),
            totalTokens: z.number(),
            totalCost: z.number(),
            averageDuration: z.number(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { service, startDate, endDate } = request.query as {
      service?: string
      startDate?: Date
      endDate?: Date
    }

    const stats = await getUsageStats(
      fastify.db,
      request.user!.id,
      service,
      startDate,
      endDate
    )

    return { usage: stats }
  })

  // =====================================================
  // COST BREAKDOWN
  // =====================================================
  fastify.get('/usage/cost', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get cost breakdown by service',
      tags: ['ai-services'],
      querystring: z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
      response: {
        200: z.object({
          costs: z.array(z.object({
            service: z.string(),
            totalCalls: z.number(),
            totalCost: z.number(),
            totalCostFormatted: z.string(),
            totalTokens: z.number(),
          })),
          total: z.object({
            calls: z.number(),
            cost: z.number(),
            costFormatted: z.string(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { startDate, endDate } = request.query as {
      startDate?: Date
      endDate?: Date
    }

    const conditions = [eq(aiServiceCalls.userId, request.user!.id)]

    if (startDate) {
      conditions.push(gte(aiServiceCalls.createdAt, startDate))
    }

    if (endDate) {
      conditions.push(lte(aiServiceCalls.createdAt, endDate))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const costsByService = await fastify.db
      .select({
        service: aiServiceCalls.service,
        totalCalls: sql<number>`count(*)`,
        totalCost: sql<number>`COALESCE(SUM(${aiServiceCalls.cost}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${aiServiceCalls.tokensUsed}), 0)`,
      })
      .from(aiServiceCalls)
      .where(whereClause)
      .groupBy(aiServiceCalls.service)

    const costs = costsByService.map(row => ({
      service: row.service,
      totalCalls: Number(row.totalCalls),
      totalCost: Number(row.totalCost),
      totalCostFormatted: formatCost(Number(row.totalCost)),
      totalTokens: Number(row.totalTokens),
    }))

    const totalCalls = costs.reduce((sum, c) => sum + c.totalCalls, 0)
    const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0)

    return {
      costs,
      total: {
        calls: totalCalls,
        cost: totalCost,
        costFormatted: formatCost(totalCost),
      },
    }
  })

  // =====================================================
  // LIST AVAILABLE SERVICES
  // =====================================================
  fastify.get('/services', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List available AI services and their capabilities',
      tags: ['ai-services'],
      response: {
        200: z.object({
          services: z.array(z.object({
            name: z.string(),
            capabilities: z.array(z.string()),
            models: z.array(z.string()),
            status: z.string(),
          })),
        }),
      },
    },
  }, async () => {
    return {
      services: [
        {
          name: 'openai',
          capabilities: ['chat', 'embeddings', 'image-generation', 'moderation'],
          models: ['gpt-4-turbo', 'gpt-3.5-turbo', 'text-embedding-3-small', 'dall-e-3'],
          status: 'available',
        },
        {
          name: 'anthropic',
          capabilities: ['chat'],
          models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
          status: 'available',
        },
        {
          name: 'meshy',
          capabilities: ['text-to-3d', 'image-to-3d', 'model-refinement'],
          models: ['meshy-4'],
          status: 'available',
        },
        {
          name: 'elevenlabs',
          capabilities: ['text-to-speech'],
          models: ['standard', 'premium', 'turbo'],
          status: 'available',
        },
      ],
    }
  })

  // =====================================================
  // CHAT COMPLETION
  // =====================================================
  fastify.post('/chat', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Chat completion using OpenAI',
      tags: ['ai-services'],
      body: z.object({
        messages: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string(),
        })),
        model: z.string().default('gpt-3.5-turbo'),
        temperature: z.number().min(0).max(2).default(0.7),
        maxTokens: z.number().min(1).max(4000).default(1000),
      }),
      response: {
        200: z.object({
          response: z.object({
            content: z.string(),
            usage: z.object({
              promptTokens: z.number(),
              completionTokens: z.number(),
              totalTokens: z.number(),
            }),
            cost: z.number(),
            costFormatted: z.string(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { messages, model, temperature, maxTokens } = request.body as {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      model: string
      temperature: number
      maxTokens: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()
    let response
    let error: string | undefined

    try {
      response = await openaiService.chatCompletion(messages, {
        model,
        temperature,
        maxTokens,
      })

      // Calculate cost
      const cost = calculateOpenAICost(response.usage.totalTokens, model, 'combined')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions',
        model,
        requestData: { messages, model, temperature, maxTokens },
        responseData: { content: response.content, usage: response.usage },
        tokensUsed: response.usage.totalTokens,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        response: {
          content: response.content,
          usage: response.usage,
          cost,
          costFormatted: formatCost(cost),
        },
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error'

      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions',
        model,
        requestData: { messages, model, temperature, maxTokens },
        durationMs: Date.now() - startTime,
        status: 'error',
        error,
      })

      throw err
    }
  })

  // =====================================================
  // EMBEDDINGS
  // =====================================================
  fastify.post('/embed', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate text embeddings',
      tags: ['ai-services'],
      body: z.object({
        text: z.string().min(1),
        model: z.string().default('text-embedding-3-small'),
      }),
      response: {
        200: z.object({
          embedding: z.array(z.number()),
          usage: z.object({
            totalTokens: z.number(),
          }),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { text, model } = request.body as {
      text: string
      model: string
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const response = await openaiService.generateEmbeddings(text, model)

      // Calculate cost
      const cost = calculateOpenAICost(response.usage.totalTokens, model, 'input')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings',
        model,
        requestData: { text, model },
        responseData: { embeddingLength: response.embedding.length },
        tokensUsed: response.usage.totalTokens,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        embedding: response.embedding,
        usage: response.usage,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings',
        model,
        requestData: { text, model },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // IMAGE GENERATION
  // =====================================================
  fastify.post('/generate-image', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate image using DALL-E via AI Gateway',
      tags: ['ai-services'],
      body: z.object({
        prompt: z.string().min(1),
        size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
        quality: z.enum(['standard', 'hd']).default('standard'),
        style: z.enum(['vivid', 'natural']).default('vivid'),
      }),
      response: {
        200: z.object({
          imageUrl: z.string(),
          revisedPrompt: z.string().optional(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { prompt, size, quality, style } = request.body as {
      prompt: string
      size: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'
      quality: 'standard' | 'hd'
      style: 'vivid' | 'natural'
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      let imageUrl: string
      let revisedPrompt: string | undefined

      // Use Vercel AI SDK with AI Gateway if available, otherwise fall back to direct OpenAI
      if (env.AI_GATEWAY_API_KEY || env.VERCEL_ENV) {
        fastify.log.info('[Image Generation] Using Vercel AI SDK with AI Gateway for DALL-E')

        // Use experimental_generateImage from Vercel AI SDK
        // This automatically uses AI Gateway when AI_GATEWAY_API_KEY is set
        const result = await generateImage({
          model: openai.image('dall-e-3'),
          prompt,
          size,
          providerOptions: {
            openai: {
              style,
              quality,
            },
          },
        })

        // Convert base64 image to data URL
        const base64Image = result.image.base64
        imageUrl = `data:image/png;base64,${base64Image}`

        // Get revised prompt from provider metadata if available
        revisedPrompt = result.providerMetadata?.openai?.revisedPrompt
      } else {
        fastify.log.info('[Image Generation] Using direct OpenAI API (no AI Gateway key)')

        const response = await openaiService.generateImage(prompt, {
          size,
          quality,
          style,
        })

        imageUrl = response.url
        revisedPrompt = response.revisedPrompt
      }

      // Calculate cost (1 image = 1000 tokens equivalent for cost calculation)
      const cost = calculateOpenAICost(1000, 'dall-e-3', 'output')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/images/generations',
        model: 'dall-e-3',
        requestData: { prompt, size, quality, style },
        responseData: { imageUrl },
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        imageUrl,
        revisedPrompt,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/images/generations',
        model: 'dall-e-3',
        requestData: { prompt, size, quality, style },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // 3D MODEL GENERATION
  // =====================================================
  fastify.post('/generate-model', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate 3D model using Meshy',
      tags: ['ai-services'],
      body: z.object({
        prompt: z.string().min(1),
        artStyle: z.string().default('realistic'),
        negativePrompt: z.string().default(''),
        topology: z.enum(['quad', 'triangle']).default('quad'),
        targetPolycount: z.number().int().min(1000).max(100000).default(30000),
      }),
      response: {
        200: z.object({
          taskId: z.string(),
          status: z.string(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { prompt, artStyle, negativePrompt, topology, targetPolycount } = request.body as {
      prompt: string
      artStyle: string
      negativePrompt: string
      topology: 'quad' | 'triangle'
      targetPolycount: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'meshy')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const response = await meshyService.textToModel(prompt, {
        artStyle,
        negativePrompt,
        aiModel: undefined,
        topology,
        targetPolycount,
      })

      // Calculate cost
      const cost = calculateMeshyCost('text-to-3d')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'meshy', {
        endpoint: '/text-to-3d',
        model: 'meshy-4',
        requestData: { prompt, artStyle, negativePrompt, topology, targetPolycount },
        responseData: { taskId: response.id, status: response.status },
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        taskId: response.id,
        status: response.status,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'meshy', {
        endpoint: '/text-to-3d',
        model: 'meshy-4',
        requestData: { prompt, artStyle, negativePrompt, topology, targetPolycount },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // SEMANTIC SEARCH
  // =====================================================
  fastify.post('/search', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Semantic search across game content',
      tags: ['ai-services'],
      body: z.object({
        query: z.string().min(1),
        projectId: z.string().uuid(),
        threshold: z.number().min(0).max(1).default(0.7),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      response: {
        200: z.object({
          results: z.array(z.object({
            id: z.string(),
            type: z.string(),
            content: z.string(),
            similarity: z.number(),
            metadata: z.record(z.string(), z.any()).optional(),
          })),
        }),
      },
    },
  }, async (request) => {
    const { query, projectId, threshold, limit } = request.body as {
      query: string
      projectId: string
      threshold: number
      limit: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const results = await embeddingsService.findSimilar(
        fastify.db,
        query,
        projectId,
        threshold,
        limit
      )

      // Calculate cost (embedding generation)
      const cost = calculateOpenAICost(100, 'text-embedding-3-small', 'input') // Approximate token count

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings/search',
        model: 'text-embedding-3-small',
        requestData: { query, projectId, threshold, limit },
        responseData: { resultCount: results.length },
        tokensUsed: 100,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return { results }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings/search',
        model: 'text-embedding-3-small',
        requestData: { query, projectId, threshold, limit },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // VISION - ANALYZE SINGLE IMAGE
  // =====================================================
  fastify.post('/vision/analyze', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Analyze a single image with GPT-4 Vision',
      tags: ['ai-services'],
      body: z.object({
        imageUrl: z.string().url(),
        prompt: z.string().min(1),
        model: z.string().default('gpt-4-vision-preview'),
        maxTokens: z.number().int().min(1).max(4000).default(500),
        temperature: z.number().min(0).max(2).default(0.7),
        detail: z.enum(['auto', 'low', 'high']).default('auto'),
      }),
      response: {
        200: z.object({
          analysis: z.string(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { imageUrl, prompt, model, maxTokens, temperature, detail } = request.body as {
      imageUrl: string
      prompt: string
      model: string
      maxTokens: number
      temperature: number
      detail: 'auto' | 'low' | 'high'
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const analysis = await openaiService.analyzeImage(imageUrl, prompt, {
        model,
        maxTokens,
        temperature,
        detail,
      })

      // Calculate cost (vision API uses more tokens)
      const cost = calculateOpenAICost(maxTokens, model, 'combined')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions/vision',
        model,
        requestData: { imageUrl, prompt, maxTokens, temperature, detail },
        responseData: { analysisLength: analysis.length },
        tokensUsed: maxTokens,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        analysis,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions/vision',
        model,
        requestData: { imageUrl, prompt, maxTokens, temperature, detail },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // VISION - ANALYZE MULTIPLE IMAGES
  // =====================================================
  fastify.post('/vision/analyze-multiple', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Analyze multiple images with GPT-4 Vision',
      tags: ['ai-services'],
      body: z.object({
        images: z.array(z.object({
          url: z.string().url(),
          detail: z.enum(['auto', 'low', 'high']).optional(),
        })).min(1).max(10),
        prompt: z.string().min(1),
        model: z.string().default('gpt-4-vision-preview'),
        maxTokens: z.number().int().min(1).max(4000).default(1000),
        temperature: z.number().min(0).max(2).default(0.7),
      }),
      response: {
        200: z.object({
          analysis: z.string(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { images, prompt, model, maxTokens, temperature } = request.body as {
      images: Array<{ url: string; detail?: 'auto' | 'low' | 'high' }>
      prompt: string
      model: string
      maxTokens: number
      temperature: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const analysis = await openaiService.analyzeMultipleImages(images, prompt, {
        model,
        maxTokens,
        temperature,
      })

      // Calculate cost (multiply by number of images)
      const cost = calculateOpenAICost(maxTokens * images.length, model, 'combined')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions/vision',
        model,
        requestData: { imageCount: images.length, prompt, maxTokens, temperature },
        responseData: { analysisLength: analysis.length },
        tokensUsed: maxTokens * images.length,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        analysis,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/chat/completions/vision',
        model,
        requestData: { imageCount: images.length, prompt, maxTokens, temperature },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // AUDIO - TRANSCRIBE
  // =====================================================
  fastify.post('/audio/transcribe', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Transcribe audio using Whisper',
      tags: ['ai-services'],
      body: z.object({
        audioUrl: z.string().url(),
        model: z.string().default('whisper-1'),
        language: z.string().optional(),
        prompt: z.string().optional(),
        temperature: z.number().min(0).max(1).default(0),
      }),
      response: {
        200: z.object({
          text: z.string(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { audioUrl, model, language, prompt, temperature } = request.body as {
      audioUrl: string
      model: string
      language?: string
      prompt?: string
      temperature: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      // Fetch audio file
      const audioResponse = await fetch(audioUrl)
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio file')
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      const transcriptionOptions: any = {
        model: model as 'whisper-1',
        temperature,
      }

      if (language !== undefined) {
        transcriptionOptions.language = language
      }
      if (prompt !== undefined) {
        transcriptionOptions.prompt = prompt
      }

      const transcription = await openaiService.transcribeAudio(audioBuffer, transcriptionOptions)

      // Calculate cost (Whisper API pricing is per minute, estimate 1000 tokens per minute)
      const cost = calculateOpenAICost(1000, 'whisper-1', 'input')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/audio/transcriptions',
        model,
        requestData: { audioUrl, language, prompt, temperature },
        responseData: { textLength: transcription.length },
        tokensUsed: 1000,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        text: transcription,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/audio/transcriptions',
        model,
        requestData: { audioUrl, language, prompt, temperature },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // AUDIO - TRANSLATE
  // =====================================================
  fastify.post('/audio/translate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Translate audio to English using Whisper',
      tags: ['ai-services'],
      body: z.object({
        audioUrl: z.string().url(),
        model: z.string().default('whisper-1'),
        prompt: z.string().optional(),
        temperature: z.number().min(0).max(1).default(0),
      }),
      response: {
        200: z.object({
          text: z.string(),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { audioUrl, model, prompt, temperature } = request.body as {
      audioUrl: string
      model: string
      prompt?: string
      temperature: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      // Fetch audio file
      const audioResponse = await fetch(audioUrl)
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio file')
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      const translationOptions: any = {
        model: model as 'whisper-1',
        temperature,
      }

      if (prompt !== undefined) {
        translationOptions.prompt = prompt
      }

      const translation = await openaiService.translateAudio(audioBuffer, translationOptions)

      // Calculate cost (Whisper API pricing is per minute, estimate 1000 tokens per minute)
      const cost = calculateOpenAICost(1000, 'whisper-1', 'input')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/audio/translations',
        model,
        requestData: { audioUrl, prompt, temperature },
        responseData: { textLength: translation.length },
        tokensUsed: 1000,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        text: translation,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/audio/translations',
        model,
        requestData: { audioUrl, prompt, temperature },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // SEMANTIC SEARCH
  // =====================================================
  fastify.post('/semantic/search', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Semantic similarity search using embeddings',
      tags: ['ai-services'],
      body: z.object({
        query: z.string().min(1),
        texts: z.array(z.string()).min(1).max(100),
        model: z.string().default('text-embedding-3-small'),
        topK: z.number().int().min(1).max(50).default(5),
      }),
      response: {
        200: z.object({
          results: z.array(z.object({
            text: z.string(),
            similarity: z.number(),
            index: z.number(),
          })),
          cost: z.number(),
          costFormatted: z.string(),
        }),
      },
    },
  }, async (request) => {
    const { query, texts, model, topK } = request.body as {
      query: string
      texts: string[]
      model: string
      topK: number
    }

    // Check rate limits
    const rateLimitStatus = await checkRateLimit(fastify.db, request.user!.id, 'openai')
    if (!rateLimitStatus.allowed) {
      throw new ForbiddenError(rateLimitStatus.reason || 'Rate limit exceeded')
    }

    const startTime = Date.now()

    try {
      const results = await openaiService.findSimilarTexts(query, texts, {
        model: model as 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002',
        topK,
      })

      // Calculate cost (embedding generation for query + all texts)
      const totalTokens = (texts.length + 1) * 100 // Approximate token count
      const cost = calculateOpenAICost(totalTokens, model, 'input')

      // Record usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings/semantic-search',
        model,
        requestData: { query, textCount: texts.length, topK },
        responseData: { resultCount: results.length },
        tokensUsed: totalTokens,
        cost,
        durationMs: Date.now() - startTime,
        status: 'success',
      })

      return {
        results,
        cost,
        costFormatted: formatCost(cost),
      }
    } catch (err) {
      // Record failed usage
      await recordUsage(fastify.db, request.user!.id, 'openai', {
        endpoint: '/embeddings/semantic-search',
        model,
        requestData: { query, textCount: texts.length, topK },
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })

      throw err
    }
  })

  // =====================================================
  // RECENT CALLS
  // =====================================================
  fastify.get('/calls/recent', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get recent AI service calls',
      tags: ['ai-services'],
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        service: z.enum(['openai', 'anthropic', 'meshy', 'elevenlabs']).optional(),
      }),
      response: {
        200: z.object({
          calls: z.array(z.object({
            id: z.string().uuid(),
            service: z.string(),
            endpoint: z.string(),
            model: z.string().nullable(),
            tokensUsed: z.number().nullable(),
            cost: z.number().nullable(),
            costFormatted: z.string(),
            durationMs: z.number().nullable(),
            status: z.string(),
            error: z.string().nullable(),
            createdAt: z.string().datetime(),
          })),
        }),
      },
    },
  }, async (request) => {
    const { limit, service } = request.query as {
      limit: number
      service?: string
    }

    const conditions = [eq(aiServiceCalls.userId, request.user!.id)]

    if (service) {
      conditions.push(eq(aiServiceCalls.service, service))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const calls = await fastify.db.query.aiServiceCalls.findMany({
      where: whereClause,
      limit,
      orderBy: [desc(aiServiceCalls.createdAt)],
    })

    return {
      calls: calls.map(call => ({
        ...serializeAllTimestamps(call),
        costFormatted: formatCost(call.cost || 0),
      })),
    }
  })
}

export default aiServicesRoutes
