/**
 * Embeddings API Routes
 * Search and manage vector embeddings for game content
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ContentEmbedderService } from '../services/content-embedder.service'
import { qdrantService } from '../services/qdrant.service'

// ============================================================================
// Schemas
// ============================================================================

const SearchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.7)
})

const SearchBodySchema = z.object({
  query: z.string().min(1),
  contentType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.7),
  projectId: z.string().min(1)
})

const BuildContextSchema = z.object({
  query: z.string().min(1),
  contentType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  threshold: z.coerce.number().min(0).max(1).default(0.7),
  projectId: z.string().min(1)
})

const EmbedContentSchema = z.object({
  contentType: z.enum(['lore', 'quest', 'npc']),
  contentId: z.string().min(1),
  projectId: z.string().min(1),
  data: z.record(z.string(), z.any())
})

const BatchEmbedSchema = z.object({
  contentType: z.enum(['lore', 'quest', 'npc']),
  projectId: z.string().min(1),
  items: z.array(z.object({
    id: z.string(),
    data: z.record(z.string(), z.any()),
    metadata: z.record(z.string(), z.any()).optional()
  }))
})

const SearchResponseSchema = z.object({
  query: z.string(),
  contentType: z.string(),
  results: z.array(z.any()),
  count: z.number(),
  duration: z.number()
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  message: z.string()
})

// ============================================================================
// Routes
// ============================================================================

const embeddingsRoutes: FastifyPluginAsync = async (server) => {
  const contentEmbedder = new ContentEmbedderService()

  /**
   * GET /api/embeddings/search
   * Search for similar content using semantic search
   */
  server.get('/search', {
    schema: {
      tags: ['embeddings'],
      description: 'Search for similar content using semantic search',
      querystring: SearchQuerySchema,
      response: {
        200: SearchResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { q: query, type: contentType, limit, threshold } = SearchQuerySchema.parse(request.query)

      server.log.info(`[Embeddings API] Searching for: "${query}" (type: ${contentType || 'all'}, limit: ${limit})`)

      const results = await contentEmbedder.findSimilar(query, {
        contentType: contentType as any || null,
        limit,
        threshold,
      })

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Found ${results.length} results (${duration}ms)`)

      return {
        query,
        contentType: contentType || 'all',
        results,
        count: results.length,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Search failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Search failed',
        code: 'EMBED_3001',
        message: error.message
      })
    }
  })

  /**
   * POST /api/embeddings/search
   * Search for similar content using semantic search (POST version)
   */
  server.post('/search', {
    schema: {
      tags: ['embeddings'],
      description: 'Search for similar content using semantic search',
      body: SearchBodySchema,
      response: {
        200: SearchResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { query, contentType, limit, threshold } = SearchBodySchema.parse(request.body)

      server.log.info(`[Embeddings API] Searching for: "${query}" (type: ${contentType || 'all'}, limit: ${limit})`)

      const results = await contentEmbedder.findSimilar(query, {
        contentType: contentType as any || null,
        limit,
        threshold,
      })

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Found ${results.length} results (${duration}ms)`)

      return {
        query,
        contentType: contentType || 'all',
        results,
        count: results.length,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Search failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Search failed',
        code: 'EMBED_3001',
        message: error.message
      })
    }
  })

  /**
   * POST /api/embeddings/build-context
   * Build AI context from similar content
   */
  server.post('/build-context', {
    schema: {
      tags: ['embeddings'],
      description: 'Build AI context from similar content',
      body: BuildContextSchema,
      response: {
        200: z.object({
          query: z.string(),
          hasContext: z.boolean(),
          context: z.string(),
          sources: z.array(z.object({
            type: z.string(),
            id: z.string(),
            similarity: z.number()
          })),
          duration: z.number()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { query, limit, threshold } = BuildContextSchema.parse(request.body)

      server.log.info(`[Embeddings API] Building context for: "${query}"`)

      const contextResult = await contentEmbedder.buildContext(query, {
        limit,
        threshold,
      })

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Built context with ${contextResult.sources.length} sources (${duration}ms)`)

      return {
        query,
        hasContext: contextResult.hasContext,
        context: contextResult.context,
        sources: contextResult.sources,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Context building failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Failed to build context',
        code: 'EMBED_3002',
        message: error.message
      })
    }
  })

  /**
   * GET /api/embeddings/stats
   * Get embedding statistics
   */
  server.get('/stats', {
    schema: {
      tags: ['embeddings'],
      description: 'Get embedding statistics',
      response: {
        200: z.object({
          stats: z.array(z.any()),
          duration: z.number()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (_request, reply) => {
    const startTime = Date.now()

    try {
      server.log.info('[Embeddings API] Fetching stats from Qdrant')

      const stats = await contentEmbedder.getStats()

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Retrieved stats for ${stats.length} content types (${duration}ms)`)

      return {
        stats,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Stats fetch failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Failed to fetch stats',
        code: 'EMBED_3003',
        message: error.message
      })
    }
  })

  /**
   * POST /api/embeddings/embed
   * Manually embed content
   */
  server.post('/embed', {
    schema: {
      tags: ['embeddings'],
      description: 'Manually embed content',
      body: EmbedContentSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          contentType: z.string(),
          contentId: z.string(),
          embeddingId: z.string(),
          duration: z.number()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { contentType, contentId, data } = EmbedContentSchema.parse(request.body)

      server.log.info(`[Embeddings API] Embedding ${contentType}:${contentId}`)

      // Use content-specific embedding methods
      let result
      if (contentType === 'lore') {
        result = await contentEmbedder.embedLore(contentId, data)
      } else if (contentType === 'quest') {
        result = await contentEmbedder.embedQuest(contentId, data)
      } else if (contentType === 'npc') {
        result = await contentEmbedder.embedNPC(contentId, data)
      } else {
        throw new Error(`Unsupported content type: ${contentType}`)
      }

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Embedded ${contentType}:${contentId} (${duration}ms)`)

      return {
        success: true,
        contentType,
        contentId,
        embeddingId: result?.id || contentId,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Embedding failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Failed to embed content',
        code: 'EMBED_3005',
        message: error.message
      })
    }
  })

  /**
   * POST /api/embeddings/batch
   * Batch embed multiple items
   */
  server.post('/batch', {
    schema: {
      tags: ['embeddings'],
      description: 'Batch embed multiple items',
      body: BatchEmbedSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          contentType: z.string(),
          count: z.number(),
          duration: z.number()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { contentType, items } = BatchEmbedSchema.parse(request.body)

      server.log.info(`[Embeddings API] Batch embedding ${items.length} ${contentType} items`)

      // Use batch embedding
      const result = await contentEmbedder.embedBatch(
        contentType as any,
        items
      )

      const duration = Date.now() - startTime

      server.log.info(`[Embeddings API] Batch embedded ${result.count} items (${duration}ms)`)

      return {
        success: result.success,
        contentType,
        count: result.count,
        duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Batch embedding failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Failed to batch embed content',
        code: 'EMBED_3006',
        message: error.message
      })
    }
  })

  /**
   * DELETE /api/embeddings/:contentType/:contentId
   * Delete embedding for content
   */
  server.delete('/:contentType/:contentId', {
    schema: {
      tags: ['embeddings'],
      description: 'Delete embedding for content',
      params: z.object({
        contentType: z.string(),
        contentId: z.string()
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          contentType: z.string(),
          contentId: z.string(),
          duration: z.number()
        }),
        404: z.object({
          error: z.string(),
          code: z.string(),
          contentType: z.string(),
          contentId: z.string()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()

    try {
      const { contentType, contentId } = request.params as { contentType: string; contentId: string }

      server.log.info(`[Embeddings API] Deleting embedding for ${contentType}:${contentId}`)

      const deleted = await contentEmbedder.deleteEmbedding(contentType as any, contentId)

      const duration = Date.now() - startTime

      if (deleted) {
        server.log.info(`[Embeddings API] Deleted embedding for ${contentType}:${contentId} (${duration}ms)`)
        return {
          success: true,
          contentType,
          contentId,
          duration
        }
      } else {
        server.log.info(`[Embeddings API] Embedding not found for ${contentType}:${contentId} (${duration}ms)`)
        return reply.status(404).send({
          error: 'Embedding not found',
          code: 'EMBED_3007',
          contentType,
          contentId
        })
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error(`[Embeddings API] Delete failed (${duration}ms):`, error.message)

      return reply.status(500).send({
        error: 'Failed to delete embedding',
        code: 'EMBED_3008',
        message: error.message
      })
    }
  })
}

export default embeddingsRoutes
